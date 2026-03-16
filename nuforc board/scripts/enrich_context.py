#!/usr/bin/env python3
"""Offline enrichment script for sighting_context table.

Usage:
    python3 scripts/enrich_context.py --db ufo_sightings.db
    python3 scripts/enrich_context.py --db ufo_sightings.db --skip-weather
    python3 scripts/enrich_context.py --db ufo_sightings.db --batch-size 50
    python3 scripts/enrich_context.py --db ufo_sightings.db --only fireball
"""

from __future__ import annotations

import argparse
import json
import math
import sqlite3
import sys
import time
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
BASES_PATH = SCRIPT_DIR / "data" / "military_bases.json"

FIREBALL_API = "https://ssd-api.jpl.nasa.gov/fireball.api"
OPEN_METEO_API = "https://archive-api.open-meteo.com/v1/archive"
# NOAA Kp index: daily Ap/Kp from GFZ Potsdam (public, no key)
KP_API = "https://kp.gfz-potsdam.de/app/files/Kp_ap_Ap_SN_F107_since_1932.txt"


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------------------------------------------------------------------------
# Data source: Military Bases (static)
# ---------------------------------------------------------------------------

def load_bases() -> list[dict]:
    if not BASES_PATH.exists():
        print(f"  [WARN] Military bases file not found: {BASES_PATH}")
        return []
    with open(BASES_PATH, "r") as f:
        return json.load(f)


def nearest_base(lat: float, lon: float, bases: list[dict]) -> tuple[str | None, float | None]:
    if not bases or lat is None or lon is None:
        return None, None
    best_name, best_dist = None, float("inf")
    for base in bases:
        d = haversine_km(lat, lon, base["lat"], base["lon"])
        if d < best_dist:
            best_dist = d
            best_name = base["name"]
    return best_name, round(best_dist, 1)


# ---------------------------------------------------------------------------
# Data source: NASA Fireball API
# ---------------------------------------------------------------------------

def fetch_fireballs() -> list[dict]:
    print("  Fetching NASA fireball data...")
    try:
        req = urllib.request.Request(FIREBALL_API, headers={"User-Agent": "nuforc-enrichment/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        print(f"  [WARN] Failed to fetch fireballs: {e}")
        return []

    fields = data.get("fields", [])
    rows = data.get("data", [])
    fireballs = []
    for row in rows:
        entry = dict(zip(fields, row))
        try:
            lat = float(entry.get("lat", 0))
            lon = float(entry.get("lon", 0))
            lat_dir = entry.get("lat-dir", "N")
            lon_dir = entry.get("lon-dir", "E")
            if lat_dir == "S":
                lat = -lat
            if lon_dir == "W":
                lon = -lon
            dt = datetime.strptime(entry["date"], "%Y-%m-%d %H:%M:%S")
            energy = float(entry.get("energy", 0)) if entry.get("energy") else None
            fireballs.append({"lat": lat, "lon": lon, "dt": dt, "date": entry["date"][:10], "energy": energy})
        except (ValueError, KeyError, TypeError):
            continue
    print(f"  Loaded {len(fireballs)} fireball events")
    return fireballs


def match_fireball(lat: float, lon: float, dt_str: str, fireballs: list[dict]) -> tuple[str | None, float | None, float | None]:
    if not fireballs or lat is None or lon is None or not dt_str:
        return None, None, None
    try:
        sighting_dt = datetime.fromisoformat(dt_str.replace("Z", ""))
    except ValueError:
        return None, None, None

    best_date, best_dist, best_energy = None, float("inf"), None
    for fb in fireballs:
        time_diff = abs((sighting_dt - fb["dt"]).total_seconds())
        if time_diff > 86400:  # 24 hours
            continue
        dist = haversine_km(lat, lon, fb["lat"], fb["lon"])
        if dist <= 200 and dist < best_dist:
            best_date = fb["date"]
            best_dist = round(dist, 1)
            best_energy = fb["energy"]

    return best_date, best_dist if best_date else None, best_energy


# ---------------------------------------------------------------------------
# Data source: NOAA Kp Index
# ---------------------------------------------------------------------------

def fetch_kp_index() -> dict[str, float]:
    """Download Kp index table from GFZ Potsdam, return {date_str: daily_max_kp}."""
    print("  Fetching Kp index data from GFZ Potsdam...")
    try:
        req = urllib.request.Request(KP_API, headers={"User-Agent": "nuforc-enrichment/1.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            text = resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"  [WARN] Failed to fetch Kp index: {e}")
        return {}

    kp_map: dict[str, float] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) < 11:
            continue
        try:
            year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
            date_str = f"{year:04d}-{month:02d}-{day:02d}"
            # Kp values are in columns 7-14 (8 three-hourly values per day)
            kp_values = []
            for i in range(7, 15):
                if i < len(parts):
                    val = float(parts[i])
                    if val >= 0:  # -1 means missing
                        kp_values.append(val)
            if kp_values:
                kp_map[date_str] = max(kp_values)
        except (ValueError, IndexError):
            continue

    print(f"  Loaded Kp data for {len(kp_map)} days")
    return kp_map


def lookup_kp(dt_str: str, kp_map: dict[str, float]) -> float | None:
    if not dt_str or not kp_map:
        return None
    date_part = dt_str[:10]
    return kp_map.get(date_part)


# ---------------------------------------------------------------------------
# Data source: Open-Meteo Weather Archive
# ---------------------------------------------------------------------------

def fetch_weather(lat: float, lon: float, date_str: str, hour: int = 12) -> dict | None:
    """Fetch historical hourly weather for a single sighting."""
    if lat is None or lon is None or not date_str:
        return None

    date_part = date_str[:10]
    params = (
        f"?latitude={lat}&longitude={lon}"
        f"&start_date={date_part}&end_date={date_part}"
        f"&hourly=cloud_cover,visibility,wind_speed_10m,temperature_2m"
    )
    url = OPEN_METEO_API + params
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "nuforc-enrichment/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
    except Exception:
        return None

    hourly = data.get("hourly", {})
    times = hourly.get("time", [])
    if not times:
        return None

    # Pick the hour closest to sighting time
    idx = min(hour, len(times) - 1)

    def safe_get(key: str) -> float | None:
        arr = hourly.get(key, [])
        return arr[idx] if idx < len(arr) and arr[idx] is not None else None

    return {
        "cloud_cover_pct": safe_get("cloud_cover"),
        "visibility_m": safe_get("visibility"),
        "wind_speed_ms": safe_get("wind_speed_10m"),
        "temperature_c": safe_get("temperature_2m"),
    }


# ---------------------------------------------------------------------------
# Main enrichment logic
# ---------------------------------------------------------------------------

def get_pending_sightings(conn: sqlite3.Connection, batch_size: int) -> list[dict]:
    """Get sightings that don't yet have a context row."""
    rows = conn.execute(
        """
        SELECT s.sighting_id, s.date_time, s.city_latitude, s.city_longitude
        FROM sightings s
        LEFT JOIN sighting_context ctx ON ctx.sighting_id = s.sighting_id
        WHERE ctx.sighting_id IS NULL
          AND s.city_latitude IS NOT NULL
          AND s.city_longitude IS NOT NULL
        ORDER BY s.sighting_id
        LIMIT ?
        """,
        (batch_size,),
    ).fetchall()
    return [
        {
            "sighting_id": r[0],
            "date_time": r[1],
            "lat": r[2],
            "lon": r[3],
        }
        for r in rows
    ]


def extract_hour(dt_str: str) -> int:
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", ""))
        return dt.hour
    except (ValueError, AttributeError):
        return 12


def enrich_batch(
    conn: sqlite3.Connection,
    sightings: list[dict],
    *,
    bases: list[dict],
    fireballs: list[dict],
    kp_map: dict[str, float],
    skip_weather: bool = False,
) -> int:
    inserted = 0
    total = len(sightings)
    for i, s in enumerate(sightings):
        sid = s["sighting_id"]
        lat, lon = s["lat"], s["lon"]
        dt_str = s["date_time"] or ""

        # Military base
        base_name, base_km = nearest_base(lat, lon, bases)

        # Fireball
        fb_date, fb_dist, fb_energy = match_fireball(lat, lon, dt_str, fireballs)

        # Kp index
        kp = lookup_kp(dt_str, kp_map)

        # Weather (optional, rate-limited)
        cloud, vis, wind, temp = None, None, None, None
        if not skip_weather:
            hour = extract_hour(dt_str)
            weather = fetch_weather(lat, lon, dt_str, hour)
            if weather:
                cloud = weather["cloud_cover_pct"]
                vis = weather["visibility_m"]
                wind = weather["wind_speed_ms"]
                temp = weather["temperature_c"]
            time.sleep(0.25)  # Rate limit for Open-Meteo

        now = datetime.utcnow().isoformat(timespec="seconds") + "Z"
        conn.execute(
            """
            INSERT OR REPLACE INTO sighting_context
            (sighting_id, cloud_cover_pct, visibility_m, wind_speed_ms, temperature_c,
             nearest_base_name, nearest_base_km, fireball_match_date, fireball_distance_km,
             fireball_energy, kp_index, context_updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (sid, cloud, vis, wind, temp, base_name, base_km, fb_date, fb_dist, fb_energy, kp, now),
        )
        inserted += 1

        if (i + 1) % 100 == 0 or (i + 1) == total:
            conn.commit()
            print(f"  Progress: {i + 1}/{total} sightings enriched")

    conn.commit()
    return inserted


def main():
    parser = argparse.ArgumentParser(description="Enrich sighting_context table")
    parser.add_argument("--db", required=True, help="Path to SQLite database")
    parser.add_argument("--batch-size", type=int, default=500, help="Number of sightings per batch")
    parser.add_argument("--skip-weather", action="store_true", help="Skip Open-Meteo weather lookups")
    parser.add_argument("--only", choices=["fireball", "base", "kp", "weather"], help="Only run one source")
    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        print(f"Database not found: {db_path}")
        sys.exit(1)

    conn = sqlite3.connect(str(db_path))

    # Ensure table exists
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sighting_context (
            sighting_id INTEGER PRIMARY KEY,
            cloud_cover_pct REAL,
            visibility_m REAL,
            wind_speed_ms REAL,
            temperature_c REAL,
            nearest_base_name TEXT,
            nearest_base_km REAL,
            fireball_match_date TEXT,
            fireball_distance_km REAL,
            fireball_energy REAL,
            kp_index REAL,
            context_updated_at TEXT
        )
    """)
    conn.commit()

    print(f"Database: {db_path}")
    pending = get_pending_sightings(conn, args.batch_size)
    print(f"Pending sightings: {len(pending)}")

    if not pending:
        print("Nothing to enrich.")
        conn.close()
        return

    # Load data sources
    bases = load_bases() if not args.only or args.only == "base" else []
    fireballs = fetch_fireballs() if not args.only or args.only == "fireball" else []
    kp_map = fetch_kp_index() if not args.only or args.only == "kp" else {}

    skip_weather = args.skip_weather or (args.only is not None and args.only != "weather")

    print(f"\nEnriching {len(pending)} sightings...")
    if skip_weather:
        print("  (Weather lookups SKIPPED)")

    inserted = enrich_batch(
        conn,
        pending,
        bases=bases,
        fireballs=fireballs,
        kp_map=kp_map,
        skip_weather=skip_weather,
    )

    print(f"\nDone. Enriched {inserted} sightings.")

    # Quick stats
    stats = conn.execute("""
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN nearest_base_km IS NOT NULL THEN 1 ELSE 0 END) AS has_base,
            SUM(CASE WHEN fireball_match_date IS NOT NULL THEN 1 ELSE 0 END) AS has_fireball,
            SUM(CASE WHEN kp_index IS NOT NULL THEN 1 ELSE 0 END) AS has_kp,
            SUM(CASE WHEN cloud_cover_pct IS NOT NULL THEN 1 ELSE 0 END) AS has_weather
        FROM sighting_context
    """).fetchone()
    print(f"\nContext table stats:")
    print(f"  Total rows:     {stats[0]}")
    print(f"  With base data: {stats[1]}")
    print(f"  With fireball:  {stats[2]}")
    print(f"  With Kp index:  {stats[3]}")
    print(f"  With weather:   {stats[4]}")

    conn.close()


if __name__ == "__main__":
    main()
