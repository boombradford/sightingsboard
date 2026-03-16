"""Event clustering — groups nearby sightings by time window and geographic radius."""

from __future__ import annotations

import math
import sqlite3
from pathlib import Path

from ..models import to_int


_EARTH_RADIUS_KM = 6371.0


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points in kilometres."""
    rlat1, rlon1, rlat2, rlon2 = (math.radians(v) for v in (lat1, lon1, lat2, lon2))
    dlat = rlat2 - rlat1
    dlon = rlon2 - rlon1
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2) ** 2
    return 2 * _EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(a)))


def _julianday_diff(dt_a: str, dt_b: str) -> float | None:
    """Approximate day difference between two ISO-ish date strings."""
    try:
        from datetime import datetime

        fmt_candidates = ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d")
        a = b = None
        for fmt in fmt_candidates:
            try:
                a = datetime.strptime(dt_a[:19], fmt)
                break
            except ValueError:
                continue
        for fmt in fmt_candidates:
            try:
                b = datetime.strptime(dt_b[:19], fmt)
                break
            except ValueError:
                continue
        if a is None or b is None:
            return None
        return abs((a - b).total_seconds()) / 86400.0
    except Exception:
        return None


def fetch_clusters(
    db_path: Path,
    query: dict[str, list[str]],
) -> dict[str, object]:
    """Cluster geocoded sightings by time + distance and return metadata.

    Query params:
        time_window_days  – max days between sightings in a cluster (default 30)
        radius_km         – max km from cluster centroid (default 80)
        min_cluster_size  – minimum sightings to form a cluster (default 3)
        limit             – max clusters returned (default 20)
        shape             – optional shape filter
        state             – optional state filter
        from_date         – optional start date
        to_date           – optional end date
    """
    time_window = to_int(query.get("time_window_days", [None])[0], default=30, minimum=1, maximum=365)
    radius_km = to_int(query.get("radius_km", [None])[0], default=80, minimum=5, maximum=500)
    min_size = to_int(query.get("min_cluster_size", [None])[0], default=3, minimum=2, maximum=50)
    limit = to_int(query.get("limit", [None])[0], default=20, minimum=1, maximum=100)

    # Build query for geocoded sightings
    sql_parts = [
        "SELECT s.sighting_id, s.date_time, s.city, s.state, s.shape,",
        "s.city_latitude, s.city_longitude, s.summary",
    ]

    # Join scores if available for story_score
    sql_parts.append(
        "FROM sightings s LEFT JOIN sighting_scores sc ON sc.sighting_id = s.sighting_id"
    )

    where = ["s.city_latitude IS NOT NULL", "s.city_longitude IS NOT NULL"]
    params: list[object] = []

    shape = (query.get("shape", [None])[0] or "").strip()
    if shape:
        where.append("LOWER(s.shape) = LOWER(?)")
        params.append(shape)

    state = (query.get("state", [None])[0] or "").strip()
    if state:
        where.append("UPPER(s.state) = UPPER(?)")
        params.append(state)

    from_date = (query.get("from_date", [None])[0] or "").strip()
    if from_date:
        where.append("s.date_time >= ?")
        params.append(from_date)

    to_date = (query.get("to_date", [None])[0] or "").strip()
    if to_date:
        where.append("s.date_time <= ?")
        params.append(to_date)

    sql_parts.append("WHERE " + " AND ".join(where))
    sql_parts.append("ORDER BY s.date_time ASC")

    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(" ".join(sql_parts), params).fetchall()

    # Parse rows into dicts for clustering
    points = []
    for row in rows:
        lat = row["city_latitude"]
        lon = row["city_longitude"]
        if lat is None or lon is None:
            continue
        try:
            lat = float(lat)
            lon = float(lon)
        except (TypeError, ValueError):
            continue
        points.append({
            "sighting_id": int(row["sighting_id"]),
            "date_time": row["date_time"] or "",
            "city": row["city"] or "",
            "state": row["state"] or "",
            "shape": (row["shape"] or "").lower(),
            "lat": lat,
            "lon": lon,
            "summary": row["summary"] or "",
        })

    # Greedy single-pass clustering (sorted by date)
    clusters: list[dict] = []
    assigned: set[int] = set()

    for i, seed in enumerate(points):
        if seed["sighting_id"] in assigned:
            continue

        members = [seed]
        assigned.add(seed["sighting_id"])

        # Centroid tracks running average
        c_lat = seed["lat"]
        c_lon = seed["lon"]

        for j in range(i + 1, len(points)):
            candidate = points[j]
            if candidate["sighting_id"] in assigned:
                continue

            # Check temporal proximity to seed
            day_diff = _julianday_diff(seed["date_time"], candidate["date_time"])
            if day_diff is None:
                continue  # can't assess temporally; skip but don't stop scanning
            if day_diff > time_window:
                break  # sorted by date, all subsequent are further away

            # Check geographic proximity to centroid
            dist = _haversine_km(c_lat, c_lon, candidate["lat"], candidate["lon"])
            if dist <= radius_km:
                members.append(candidate)
                assigned.add(candidate["sighting_id"])
                # Update centroid
                n = len(members)
                c_lat = c_lat + (candidate["lat"] - c_lat) / n
                c_lon = c_lon + (candidate["lon"] - c_lon) / n

        if len(members) >= min_size:
            clusters.append(_build_cluster_meta(members, c_lat, c_lon))

    # Sort by member count descending, take top N
    clusters.sort(key=lambda c: c["count"], reverse=True)
    clusters = clusters[:limit]

    # Assign stable IDs
    for idx, cluster in enumerate(clusters):
        cluster["id"] = f"cluster-{idx + 1}"

    return {
        "clusters": clusters,
        "params": {
            "time_window_days": time_window,
            "radius_km": radius_km,
            "min_cluster_size": min_size,
        },
        "total_geocoded": len(points),
    }


def _build_cluster_meta(
    members: list[dict], centroid_lat: float, centroid_lon: float
) -> dict[str, object]:
    """Build cluster metadata from member sightings."""
    dates = [m["date_time"] for m in members if m["date_time"] and m["date_time"] != "unknown-date"]
    dates.sort()

    # Dominant shapes
    shape_counts: dict[str, int] = {}
    for m in members:
        s = m["shape"] or "unknown"
        shape_counts[s] = shape_counts.get(s, 0) + 1
    dominant_shapes = sorted(shape_counts.items(), key=lambda x: x[1], reverse=True)[:3]

    # Dominant signals not available at this query level — we return shapes + locations
    # Location summary
    location_counts: dict[str, int] = {}
    for m in members:
        loc = f"{m['city']}, {m['state']}".strip(", ")
        if loc:
            location_counts[loc] = location_counts.get(loc, 0) + 1
    dominant_locations = sorted(location_counts.items(), key=lambda x: x[1], reverse=True)[:3]

    # Representative sighting IDs (top 5)
    sample_ids = [m["sighting_id"] for m in members[:5]]

    return {
        "id": "",  # filled in later
        "count": len(members),
        "centroid": {"lat": round(centroid_lat, 4), "lon": round(centroid_lon, 4)},
        "date_range": {
            "earliest": dates[0] if dates else None,
            "latest": dates[-1] if dates else None,
        },
        "dominant_shapes": [{"shape": s, "count": c} for s, c in dominant_shapes],
        "dominant_locations": [{"location": loc, "count": c} for loc, c in dominant_locations],
        "sample_ids": sample_ids,
    }
