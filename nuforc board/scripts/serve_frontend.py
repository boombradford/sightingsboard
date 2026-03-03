#!/usr/bin/env python3
"""Serve a local frontend and JSON API for exploring UFO sightings."""

from __future__ import annotations

import argparse
import csv
import html
import json
import os
import random
import re
import sqlite3
import threading
import uuid
from datetime import datetime, timedelta
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT_DIR = Path(__file__).resolve().parent.parent
WEB_DIR = ROOT_DIR / "web"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1", help="Host interface to bind.")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on.")
    parser.add_argument(
        "--db",
        default=str(ROOT_DIR / "ufo_sightings.db"),
        help="Path to SQLite database file.",
    )
    parser.add_argument(
        "--enrichment-csv",
        default=str(ROOT_DIR / "exports/research_results_batch_0001_1000.csv"),
        help="Optional enrichment CSV to attach additional source details per sighting.",
    )
    parser.add_argument(
        "--ai-cache",
        default=str(ROOT_DIR / "data/ai_case_briefs.json"),
        help="Path to JSON cache file for AI-generated case briefs.",
    )
    parser.add_argument(
        "--openai-model",
        default=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        help="OpenAI model to use for case enrichment.",
    )
    return parser.parse_args()


def clean_text(value: str | None, *, collapse_whitespace: bool = True) -> str | None:
    if value is None:
        return None
    text = html.unescape(str(value)).replace("\x00", "").strip()
    if not text:
        return None
    if collapse_whitespace:
        text = " ".join(text.split())
    return text


def normalize_state(value: str | None) -> str | None:
    state = clean_text(value)
    if not state:
        return None
    state = state.upper()
    if state in {"--", "NA", "N/A", "NONE", "UNKNOWN", "UNK", "?"}:
        return None
    return state


def normalize_date(value: str | None) -> str | None:
    raw = clean_text(value)
    if not raw:
        return None

    if "24:00" in raw:
        adjusted = raw.replace("24:00:00", "00:00:00").replace("24:00", "00:00")
        for fmt in (
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%m/%d/%Y %H:%M:%S",
            "%m/%d/%Y %H:%M",
            "%m/%d/%y %H:%M:%S",
            "%m/%d/%y %H:%M",
        ):
            try:
                return (datetime.strptime(adjusted, fmt) + timedelta(days=1)).isoformat(
                    timespec="seconds"
                )
            except ValueError:
                continue

    try:
        return datetime.fromisoformat(raw).isoformat(timespec="seconds")
    except ValueError:
        pass

    for fmt in (
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M",
        "%m/%d/%Y",
        "%m/%d/%y %H:%M:%S",
        "%m/%d/%y %H:%M",
        "%m/%d/%y",
    ):
        try:
            return datetime.strptime(raw, fmt).isoformat(timespec="seconds")
        except ValueError:
            continue

    return raw


def normalize_fts_keyword(value: str | None) -> str | None:
    raw = clean_text(value)
    if not raw:
        return None
    # Convert free-text input into a conservative AND query to avoid FTS syntax errors.
    tokens = re.findall(r"[0-9A-Za-z]+(?:['-][0-9A-Za-z]+)*", raw)
    if not tokens:
        return None
    return " AND ".join(f'"{token}"' for token in tokens[:12])


def normalize_to_date_upper_bound(value: str | None) -> tuple[str | None, bool]:
    raw = clean_text(value)
    if not raw:
        return None, False

    normalized = normalize_date(raw)
    if not normalized:
        return None, False

    # Date-only values from HTML date inputs are intended to include the full day.
    date_only = len(raw) == 10 and raw[4] == "-" and raw[7] == "-" and raw.replace("-", "").isdigit()
    if date_only:
        try:
            return (datetime.fromisoformat(normalized) + timedelta(days=1)).isoformat(
                timespec="seconds"
            ), True
        except ValueError:
            return normalized, False
    return normalized, False


def parse_bool(value: object, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    raw = str(value).strip().lower()
    if raw in {"1", "true", "yes", "y", "on"}:
        return True
    if raw in {"0", "false", "no", "n", "off", ""}:
        return False
    return default


def to_int(value: str | None, default: int, minimum: int, maximum: int) -> int:
    if value is None:
        return default
    try:
        parsed = int(value)
    except ValueError:
        return default
    return max(minimum, min(parsed, maximum))


def to_float(value: str | None) -> float | None:
    try:
        return float(str(value).strip())
    except (ValueError, AttributeError):
        return None


def utc_now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def parse_stats_map(stats_raw: str | None) -> dict[str, str]:
    text = clean_text(stats_raw)
    if not text:
        return {}

    out: dict[str, str] = {}
    for chunk in re.split(r"(?:;|\|)\s*", text):
        part = chunk.strip()
        if not part:
            continue
        split_at = part.find("=")
        if split_at < 0:
            split_at = part.find(":")
        if split_at <= 0:
            continue
        key = part[:split_at].strip().lower().replace(" ", "_")
        value = part[split_at + 1 :].strip()
        if key and value and key not in out:
            out[key] = value
    return out


def parse_observer_count(stats_raw: str | None, report_text: str | None = None) -> int | None:
    stats_map = parse_stats_map(stats_raw)
    observer_raw = stats_map.get("no_of_observers") or stats_map.get("observers")
    if observer_raw:
        match = re.search(r"\d+", observer_raw)
        if match:
            try:
                return int(match.group(0))
            except ValueError:
                pass
    text = clean_text(report_text) or ""
    match = re.search(r"\b(\d{1,2})\s+(?:witness|people|person|observers?)\b", text, re.I)
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            return None
    return None


def has_media_marker(stats_raw: str | None, report_text: str | None = None) -> bool:
    stats_text = (clean_text(stats_raw) or "").lower()
    report_text_norm = (clean_text(report_text) or "").lower()
    markers = ("photo", "photos", "video", "image", "media", "recording")
    return any(marker in stats_text or marker in report_text_norm for marker in markers)


def detect_explainable_case(report_text: str | None, stats_raw: str | None = None) -> bool:
    text = f"{clean_text(report_text) or ''} {clean_text(stats_raw) or ''}".lower()
    explainable_markers = (
        "starlink",
        "balloon",
        "meteor",
        "fireball",
        "drone",
        "aircraft",
        "plane",
        "planet",
        "venus",
        "satellite",
        "rocket launch",
    )
    return any(marker in text for marker in explainable_markers)


SIGNAL_KEYS = [
    "lights_on_object",
    "no_sound",
    "hover",
    "formation",
    "aircraft_nearby",
    "color_white",
    "fast_acceleration",
    "camera_mismatch",
]


def extract_case_signals(shape: str | None, stats_raw: str | None, report_text: str | None) -> dict[str, bool]:
    text = f"{clean_text(report_text) or ''} {clean_text(stats_raw) or ''}".lower()
    shape_norm = (clean_text(shape) or "").lower()
    stats_map = parse_stats_map(stats_raw)
    characteristics = (stats_map.get("characteristics") or "").lower()

    return {
        "lights_on_object": "light" in shape_norm or "lights on object" in characteristics or "light" in text,
        "no_sound": "no sound" in text or "silent" in text,
        "hover": "hover" in text or "stationary" in text,
        "formation": "formation" in text or "line of lights" in text,
        "aircraft_nearby": "aircraft" in text or "plane" in text or "pilot" in text,
        "color_white": "white" in text,
        "fast_acceleration": "fast acceleration" in text or "shot away" in text or "sudden departure" in text,
        "camera_mismatch": "camera" in text and ("didn't show" in text or "not visible on camera" in text),
    }


def top_signal_percentages(rows: list[sqlite3.Row], *, limit: int = 5) -> list[dict[str, object]]:
    if not rows:
        return []

    counts = {key: 0 for key in SIGNAL_KEYS}
    for row in rows:
        signals = extract_case_signals(row["shape"], row["stats"], row["report_text"])
        for key, active in signals.items():
            if active:
                counts[key] += 1

    total = len(rows)
    ranked = sorted(counts.items(), key=lambda item: item[1], reverse=True)
    out: list[dict[str, object]] = []
    for key, count in ranked[:limit]:
        if count <= 0:
            continue
        out.append({"key": key, "pct": round((count / total) * 100, 1), "count": count})
    return out


def quality_label_for_case(
    *,
    row: sqlite3.Row | dict[str, object],
    evidence_count: int = 0,
    enrichment_count: int = 0,
) -> tuple[int, str]:
    duration = clean_text(row["duration"] if isinstance(row, sqlite3.Row) else row.get("duration"))
    stats = clean_text(row["stats"] if isinstance(row, sqlite3.Row) else row.get("stats"))
    report_text = clean_text(row["report_text"] if isinstance(row, sqlite3.Row) else row.get("report_text"))
    lat = row["city_latitude"] if isinstance(row, sqlite3.Row) else row.get("city_latitude")
    lon = row["city_longitude"] if isinstance(row, sqlite3.Row) else row.get("city_longitude")

    score = 0
    if lat is not None and lon is not None:
        score += 1
    if duration:
        score += 1
    if stats:
        score += 1
    if parse_observer_count(stats, report_text) is not None:
        score += 1
    if enrichment_count > 0 or evidence_count > 0:
        score += 1
    if has_media_marker(stats, report_text):
        score += 1

    if score <= 2:
        return score, "low"
    if score <= 4:
        return score, "medium"
    return score, "high"


def parse_filter_query(query: dict[str, list[str]]) -> dict[str, object]:
    keyword = clean_text(query.get("keyword", [None])[0])
    keyword_query = normalize_fts_keyword(keyword)
    state = normalize_state(query.get("state", [None])[0])
    shape = clean_text(query.get("shape", [None])[0])
    city = clean_text(query.get("city", [None])[0])
    from_date = normalize_date(query.get("from_date", [None])[0])
    to_date, to_date_exclusive = normalize_to_date_upper_bound(query.get("to_date", [None])[0])
    return {
        "keyword": keyword,
        "keyword_query": keyword_query,
        "state": state,
        "shape": shape,
        "city": city,
        "from_date": from_date,
        "to_date": to_date,
        "to_date_exclusive": to_date_exclusive,
    }


def parse_filter_payload(payload: dict[str, object] | None) -> dict[str, object]:
    if not isinstance(payload, dict):
        return parse_filter_query({})
    pseudo_query: dict[str, list[str]] = {}
    for key in ("keyword", "state", "shape", "city", "from_date", "to_date"):
        raw = payload.get(key)
        if raw is None:
            continue
        pseudo_query[key] = [str(raw)]
    return parse_filter_query(pseudo_query)


def merge_filters(base: dict[str, object], extra: dict[str, object]) -> dict[str, object]:
    merged = dict(base)
    for key in ("keyword", "keyword_query", "state", "shape", "city", "from_date", "to_date", "to_date_exclusive"):
        value = extra.get(key)
        if value in (None, ""):
            continue
        merged[key] = value
    return merged


def build_filter_parts(
    filters: dict[str, object],
    *,
    alias: str = "s",
    omit: set[str] | None = None,
) -> tuple[list[str], list[str], list[object]]:
    omit_keys = omit or set()
    joins: list[str] = []
    where: list[str] = []
    params: list[object] = []

    keyword = filters.get("keyword")
    keyword_query = filters.get("keyword_query")
    if keyword and not keyword_query:
        where.append("1 = 0")
    elif keyword_query and "keyword" not in omit_keys:
        joins.append(f"JOIN sightings_fts ON sightings_fts.rowid = {alias}.sighting_id")
        where.append("sightings_fts MATCH ?")
        params.append(keyword_query)

    if filters.get("state") and "state" not in omit_keys:
        where.append(f"UPPER({alias}.state) = ?")
        params.append(filters["state"])
    if filters.get("shape") and "shape" not in omit_keys:
        where.append(f"LOWER({alias}.shape) = LOWER(?)")
        params.append(filters["shape"])
    if filters.get("city") and "city" not in omit_keys:
        where.append(f"LOWER({alias}.city) = LOWER(?)")
        params.append(filters["city"])
    if filters.get("from_date") and "date" not in omit_keys:
        where.append(f"{alias}.date_time >= ?")
        params.append(filters["from_date"])
    if filters.get("to_date") and "date" not in omit_keys:
        where.append(f"{alias}.date_time < ?" if filters.get("to_date_exclusive") else f"{alias}.date_time <= ?")
        params.append(filters["to_date"])

    return joins, where, params


def parse_constraints(payload: dict[str, object] | None) -> dict[str, bool]:
    raw = payload if isinstance(payload, dict) else {}
    return {
        "has_coordinates": parse_bool(raw.get("has_coordinates"), default=False),
        "has_sources": parse_bool(raw.get("has_sources"), default=False),
        "has_media": parse_bool(raw.get("has_media"), default=False),
    }


def build_constraints_where(constraints: dict[str, bool], *, alias: str = "s") -> tuple[list[str], list[object]]:
    where: list[str] = []
    params: list[object] = []
    if constraints.get("has_coordinates"):
        where.append(f"{alias}.city_latitude IS NOT NULL AND {alias}.city_longitude IS NOT NULL")
    if constraints.get("has_media"):
        media_tokens = ["photo", "video", "image", "media", "recording"]
        token_clauses = []
        for _ in media_tokens:
            token_clauses.append(f"LOWER(COALESCE({alias}.stats,'')) LIKE ?")
            token_clauses.append(f"LOWER(COALESCE({alias}.report_text,'')) LIKE ?")
        where.append("(" + " OR ".join(token_clauses) + ")")
        for token in media_tokens:
            like = f"%{token}%"
            params.extend([like, like])
    return where, params


def is_http_url(value: str | None) -> bool:
    raw = clean_text(value)
    if not raw:
        return False
    parsed = urlparse(raw)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def fetch_evidence_count_map(db_path: Path, sighting_ids: list[int]) -> dict[int, int]:
    unique_ids = sorted({int(sid) for sid in sighting_ids if sid is not None})
    if not unique_ids:
        return {}
    placeholders = ",".join("?" for _ in unique_ids)
    sql = (
        "SELECT sighting_id, COUNT(*) AS c FROM evidence_links "
        f"WHERE sighting_id IN ({placeholders}) "
        "GROUP BY sighting_id"
    )
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(sql, unique_ids).fetchall()
    return {int(row["sighting_id"]): int(row["c"]) for row in rows}


def fetch_evidence_sighting_ids(db_path: Path) -> set[int]:
    with sqlite3.connect(str(db_path)) as conn:
        rows = conn.execute("SELECT DISTINCT sighting_id FROM evidence_links").fetchall()
    return {int(row[0]) for row in rows}


def ensure_vnext_schema(db_path: Path) -> None:
    with sqlite3.connect(str(db_path)) as conn:
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS sample_sets (
                set_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                base_filters_json TEXT NOT NULL,
                strategy_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS sample_set_items (
                set_id TEXT NOT NULL,
                sighting_id INTEGER NOT NULL,
                rank INTEGER NOT NULL,
                quality_label TEXT,
                explainable INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(set_id, sighting_id)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS evidence_links (
                evidence_id INTEGER PRIMARY KEY AUTOINCREMENT,
                sighting_id INTEGER NOT NULL,
                source_title TEXT NOT NULL,
                source_url TEXT,
                domain TEXT,
                stance TEXT NOT NULL,
                match_time INTEGER NOT NULL DEFAULT 0,
                match_location INTEGER NOT NULL DEFAULT 0,
                match_visual INTEGER NOT NULL DEFAULT 0,
                notes TEXT NOT NULL,
                excerpt TEXT,
                attachment_path TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_brief_versions (
                brief_id INTEGER PRIMARY KEY AUTOINCREMENT,
                sighting_id INTEGER NOT NULL,
                version_num INTEGER NOT NULL,
                generated_at TEXT NOT NULL,
                model_label TEXT NOT NULL,
                brief_json TEXT NOT NULL,
                citations_json TEXT NOT NULL,
                source_snapshot_json TEXT NOT NULL
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_brief_issues (
                issue_id INTEGER PRIMARY KEY AUTOINCREMENT,
                brief_id INTEGER NOT NULL,
                sighting_id INTEGER NOT NULL,
                reason_code TEXT NOT NULL,
                notes TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sample_sets_created_at ON sample_sets(created_at)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_evidence_links_sighting_id ON evidence_links(sighting_id)")
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_ai_brief_versions_sighting_id_version ON ai_brief_versions(sighting_id, version_num)"
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_ai_brief_issues_brief_id ON ai_brief_issues(brief_id)")
        conn.commit()


def load_enrichment_index(path: Path) -> dict[int, list[dict[str, object]]]:
    if not path.exists():
        return {}

    index: dict[int, list[dict[str, object]]] = {}
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            try:
                sighting_id = int(str(row.get("sighting_id", "")).strip())
            except ValueError:
                continue

            entry = {
                "source_url": clean_text(row.get("source_url")),
                "source_title": clean_text(row.get("source_title")) or "Untitled source",
                "publisher": clean_text(row.get("publisher")) or "",
                "published_date": clean_text(row.get("published_date")) or "",
                "why_relevant": clean_text(row.get("why_relevant")) or "",
                "supports_or_contradicts": clean_text(row.get("supports_or_contradicts")) or "unknown",
                "confidence_0_to_1": to_float(row.get("confidence_0_to_1")),
                "notes": clean_text(row.get("notes")) or "",
                "mirror_sighting_id": clean_text(row.get("mirror_sighting_id")) or "",
            }
            index.setdefault(sighting_id, []).append(entry)

    for sighting_id, items in index.items():
        items.sort(key=lambda item: item.get("confidence_0_to_1") or 0.0, reverse=True)
    return index


def load_ai_cache(path: Path) -> dict[str, dict[str, object]]:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    if not isinstance(payload, dict):
        return {}
    clean: dict[str, dict[str, object]] = {}
    for key, value in payload.items():
        if isinstance(key, str) and isinstance(value, dict):
            clean[key] = value
    return clean


def save_ai_cache(path: Path, cache: dict[str, dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, indent=2, ensure_ascii=True), encoding="utf-8")


def build_case_fingerprint(
    *,
    report_link: str | None,
    date_time: str | None,
    city: str | None,
    state: str | None,
    shape: str | None,
    duration: str | None,
) -> str:
    normalized_state = normalize_state(state) or ""
    parts = [
        clean_text(report_link) or "",
        clean_text(date_time) or "",
        clean_text(city) or "",
        normalized_state,
        clean_text(shape) or "",
        clean_text(duration) or "",
    ]
    return "|".join(parts)


def cache_entry_matches_case(
    cache_entry: dict[str, object] | None,
    *,
    report_link: str | None,
    fingerprint: str,
) -> bool:
    if not isinstance(cache_entry, dict):
        return False

    cached_link = clean_text(cache_entry.get("report_link"))
    if report_link:
        return cached_link == report_link

    cached_fp = clean_text(cache_entry.get("fingerprint"))
    return bool(cached_fp and cached_fp == fingerprint)


def build_fingerprint_from_payload(case_payload: dict[str, object]) -> str:
    return build_case_fingerprint(
        report_link=case_payload.get("report_link") if isinstance(case_payload.get("report_link"), str) else None,
        date_time=case_payload.get("date_time") if isinstance(case_payload.get("date_time"), str) else None,
        city=case_payload.get("city") if isinstance(case_payload.get("city"), str) else None,
        state=case_payload.get("state") if isinstance(case_payload.get("state"), str) else None,
        shape=case_payload.get("shape") if isinstance(case_payload.get("shape"), str) else None,
        duration=case_payload.get("duration") if isinstance(case_payload.get("duration"), str) else None,
    )


def get_case_payload(
    db_path: Path,
    enrichment_index: dict[int, list[dict[str, object]]],
    sighting_id: int,
) -> dict[str, object] | None:
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            """
            SELECT
              sighting_id,
              date_time,
              city,
              state,
              shape,
              duration,
              summary,
              report_text,
              stats,
              report_link,
              posted,
              city_latitude,
              city_longitude
            FROM sightings
            WHERE sighting_id = ?
            """,
            (sighting_id,),
        ).fetchone()
    if row is None:
        return None

    return {
        "sighting_id": row["sighting_id"],
        "date_time": normalize_date(row["date_time"]),
        "city": clean_text(row["city"]),
        "state": normalize_state(row["state"]),
        "shape": clean_text(row["shape"]),
        "duration": clean_text(row["duration"]),
        "summary": clean_text(row["summary"]),
        "report_text": clean_text(row["report_text"], collapse_whitespace=False),
        "stats": clean_text(row["stats"]),
        "report_link": clean_text(row["report_link"]),
        "posted": normalize_date(row["posted"]),
        "city_latitude": row["city_latitude"],
        "city_longitude": row["city_longitude"],
        "linked_sources": enrichment_index.get(sighting_id, [])[:10],
    }


def fetch_case_file(
    db_path: Path,
    enrichment_index: dict[int, list[dict[str, object]]],
    ai_cache: dict[str, dict[str, object]],
    sighting_id: int,
) -> dict[str, object] | None:
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            """
            SELECT
              sighting_id,
              date_time,
              city,
              state,
              shape,
              duration,
              summary,
              report_text,
              stats,
              report_link,
              posted,
              city_latitude,
              city_longitude
            FROM sightings
            WHERE sighting_id = ?
            """,
            (sighting_id,),
        ).fetchone()
        if row is None:
            return None
        latest_brief = conn.execute(
            """
            SELECT brief_id, version_num, generated_at, model_label, brief_json, citations_json
            FROM ai_brief_versions
            WHERE sighting_id = ?
            ORDER BY version_num DESC
            LIMIT 1
            """,
            (sighting_id,),
        ).fetchone()

    evidence = list_case_evidence(db_path, sighting_id)
    serialized = _serialize_case_row(
        row,
        enrichment_index=enrichment_index,
        ai_cache=ai_cache,
        evidence_count=len(evidence),
    )
    serialized["linked_sources"] = enrichment_index.get(sighting_id, [])[:10]
    serialized["evidence"] = evidence
    if latest_brief is None:
        serialized["latest_brief"] = None
    else:
        serialized["latest_brief"] = {
            "brief_id": latest_brief["brief_id"],
            "version_num": latest_brief["version_num"],
            "generated_at": latest_brief["generated_at"],
            "model_label": latest_brief["model_label"],
            "brief": json.loads(latest_brief["brief_json"]),
            "citations": json.loads(latest_brief["citations_json"]),
        }
    return serialized


def parse_json_maybe(text: str) -> dict[str, object]:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        stripped = stripped.replace("json\n", "", 1).strip()
    payload = json.loads(stripped)
    if not isinstance(payload, dict):
        raise ValueError("AI response must be a JSON object.")
    return payload


def generate_ai_case_brief(api_key: str, model: str, case_payload: dict[str, object]) -> dict[str, object]:
    system_prompt = (
        "You are a UFO case intelligence analyst. "
        "Given one sighting record and linked sources, output strict JSON only."
    )
    user_prompt = (
        "Produce this JSON object exactly with these keys:\n"
        "{\n"
        '  "case_summary": "2-4 sentence neutral summary",\n'
        '  "likely_explanations": [\n'
        '    {"label": "short label", "why": "one sentence", "confidence_0_to_1": 0.0}\n'
        "  ],\n"
        '  "research_leads": ["actionable lead 1", "actionable lead 2"],\n'
        '  "source_based_notes": ["key source-backed point 1", "key source-backed point 2"],\n'
        '  "overall_confidence_0_to_1": 0.0\n'
        "}\n\n"
        "Rules: remain evidence-based, do not invent named events, keep confidence calibrated.\n\n"
        f"Case JSON:\n{json.dumps(case_payload, ensure_ascii=True)}"
    )

    body = {
        "model": model,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    req = Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urlopen(req, timeout=90) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"OpenAI HTTP error {exc.code}: {detail[:400]}") from exc
    except URLError as exc:
        raise RuntimeError(f"OpenAI request failed: {exc}") from exc

    content = (
        payload.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )
    if not content:
        raise RuntimeError("OpenAI returned an empty completion.")
    return parse_json_maybe(content)


def fetch_sightings(
    db_path: Path,
    enrichment_index: dict[int, list[dict[str, object]]],
    ai_cache: dict[str, dict[str, object]],
    query: dict[str, list[str]],
) -> dict[str, object]:
    keyword = clean_text(query.get("keyword", [None])[0])
    keyword_query = normalize_fts_keyword(keyword)
    state = normalize_state(query.get("state", [None])[0])
    shape = clean_text(query.get("shape", [None])[0])
    city = clean_text(query.get("city", [None])[0])
    from_date = normalize_date(query.get("from_date", [None])[0])
    to_date, to_date_exclusive = normalize_to_date_upper_bound(query.get("to_date", [None])[0])
    order = (query.get("order", ["recent"])[0] or "recent").lower()
    limit = to_int(query.get("limit", [None])[0], default=20, minimum=1, maximum=500)
    offset = to_int(query.get("offset", [None])[0], default=0, minimum=0, maximum=200000)

    if order not in {"recent", "oldest", "random"}:
        order = "recent"

    joins = []
    where = []
    params: list[object] = []

    if keyword and not keyword_query:
        return {
            "meta": {
                "limit": limit,
                "offset": offset,
                "returned": 0,
                "total": 0,
                "order": order,
            },
            "items": [],
        }
    if keyword_query:
        joins.append("JOIN sightings_fts ON sightings_fts.rowid = s.sighting_id")
        where.append("sightings_fts MATCH ?")
        params.append(keyword_query)
    if state:
        where.append("UPPER(s.state) = ?")
        params.append(state)
    if shape:
        where.append("LOWER(s.shape) = LOWER(?)")
        params.append(shape)
    if city:
        where.append("LOWER(s.city) = LOWER(?)")
        params.append(city)
    if from_date:
        where.append("s.date_time >= ?")
        params.append(from_date)
    if to_date:
        where.append("s.date_time < ?" if to_date_exclusive else "s.date_time <= ?")
        params.append(to_date)

    from_clause = "FROM sightings s " + " ".join(joins)
    where_clause = ("WHERE " + " AND ".join(where)) if where else ""

    if order == "random":
        order_clause = "ORDER BY RANDOM()"
    elif order == "oldest":
        order_clause = "ORDER BY s.date_time ASC NULLS LAST, s.sighting_id ASC"
    else:
        order_clause = "ORDER BY s.date_time DESC NULLS LAST, s.sighting_id DESC"

    data_sql = f"""
        SELECT
            s.sighting_id,
            s.date_time,
            s.city,
            s.state,
            s.shape,
            s.duration,
            s.summary,
            s.report_text,
            s.stats,
            s.report_link,
            s.posted,
            s.city_latitude,
            s.city_longitude
        {from_clause}
        {where_clause}
        {order_clause}
        LIMIT ? OFFSET ?
    """

    count_sql = f"SELECT COUNT(*) {from_clause} {where_clause}"

    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(data_sql, params + [limit, offset]).fetchall()
        total = int(conn.execute(count_sql, params).fetchone()[0])
        signal_rows = conn.execute(
            f"""
            SELECT s.shape, s.stats, s.report_text
            {from_clause}
            {where_clause}
            ORDER BY s.date_time DESC NULLS LAST
            LIMIT 3000
            """,
            params,
        ).fetchall()
    evidence_count_map = fetch_evidence_count_map(
        db_path,
        [int(row["sighting_id"]) for row in rows],
    )

    sightings: list[dict[str, object]] = []
    for row in rows:
        text = clean_text(row["report_text"], collapse_whitespace=False)
        summary = clean_text(row["summary"]) or (
            text[:217] + "..." if text and len(text) > 220 else text
        )
        normalized_date_time = normalize_date(row["date_time"])
        normalized_state = normalize_state(row["state"]) or "--"
        row_report_link = clean_text(row["report_link"])
        row_duration = clean_text(row["duration"]) or ""
        cache_key = str(row["sighting_id"])
        cache_entry = ai_cache.get(cache_key)
        row_fingerprint = build_case_fingerprint(
            report_link=row_report_link,
            date_time=normalized_date_time,
            city=clean_text(row["city"]),
            state=normalized_state,
            shape=clean_text(row["shape"]),
            duration=row_duration,
        )
        ai_brief = None
        if cache_entry and cache_entry_matches_case(
            cache_entry,
            report_link=row_report_link,
            fingerprint=row_fingerprint,
        ):
            brief = cache_entry.get("brief")
            if isinstance(brief, dict):
                ai_brief = brief
        enrichment_count = len(enrichment_index.get(row["sighting_id"], []))
        evidence_count = evidence_count_map.get(int(row["sighting_id"]), 0)
        quality_score, quality_label = quality_label_for_case(
            row=row,
            evidence_count=evidence_count,
            enrichment_count=enrichment_count,
        )
        signals = extract_case_signals(row["shape"], row["stats"], text)

        sightings.append(
            {
                "sighting_id": row["sighting_id"],
                "date_time": normalized_date_time or "unknown-date",
                "city": clean_text(row["city"]) or "unknown-city",
                "state": normalized_state,
                "shape": clean_text(row["shape"]) or "unknown-shape",
                "duration": row_duration,
                "summary": summary or "",
                "report_text": text or "",
                "stats": clean_text(row["stats"]) or "",
                "report_link": row_report_link,
                "posted": normalize_date(row["posted"]),
                "city_latitude": row["city_latitude"],
                "city_longitude": row["city_longitude"],
                "enrichment_sources": enrichment_index.get(row["sighting_id"], [])[:6],
                "enrichment_count": enrichment_count,
                "evidence_count": evidence_count,
                "ai_brief": ai_brief,
                "ai_brief_status": "available" if ai_brief else "none",
                "quality_score": quality_score,
                "quality_label": quality_label,
                "observer_count": parse_observer_count(row["stats"], text),
                "explainable": detect_explainable_case(text, row["stats"]),
                "signals": [key for key, active in signals.items() if active],
            }
        )

    return {
        "meta": {
            "limit": limit,
            "offset": offset,
            "returned": len(sightings),
            "total": total,
            "order": order,
            "slice_signals": top_signal_percentages(signal_rows),
            "updated_at": utc_now_iso(),
        },
        "items": sightings,
    }


def fetch_options(db_path: Path) -> dict[str, object]:
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        states_raw = conn.execute(
            "SELECT DISTINCT state FROM sightings WHERE state IS NOT NULL AND TRIM(state) <> ''"
        ).fetchall()
        shapes_raw = conn.execute(
            "SELECT DISTINCT shape FROM sightings WHERE shape IS NOT NULL AND TRIM(shape) <> ''"
        ).fetchall()

    states = sorted({s for row in states_raw if (s := normalize_state(row["state"]))})
    shapes = sorted(
        {s for row in shapes_raw if (s := clean_text(row["shape"]))},
        key=lambda value: value.lower(),
    )
    return {"states": states, "shapes": shapes}


def fetch_stats(db_path: Path) -> dict[str, object]:
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        total = int(conn.execute("SELECT COUNT(*) AS n FROM sightings").fetchone()["n"])
        geocoded = int(
            conn.execute(
                """
                SELECT COUNT(*) AS n
                FROM sightings
                WHERE city_latitude IS NOT NULL AND city_longitude IS NOT NULL
                """
            ).fetchone()["n"]
        )
        min_date, max_date = conn.execute(
            "SELECT MIN(date_time), MAX(date_time) FROM sightings WHERE date_time IS NOT NULL"
        ).fetchone()
        top_shapes = [
            {"shape": clean_text(row["shape"]) or "unknown", "count": row["count"]}
            for row in conn.execute(
                """
                SELECT shape, COUNT(*) AS count
                FROM sightings
                WHERE shape IS NOT NULL AND TRIM(shape) <> ''
                GROUP BY shape
                ORDER BY count DESC
                LIMIT 8
                """
            ).fetchall()
        ]
        top_states = [
            {"state": normalize_state(row["state"]) or "--", "count": row["count"]}
            for row in conn.execute(
                """
                SELECT state, COUNT(*) AS count
                FROM sightings
                WHERE state IS NOT NULL AND TRIM(state) <> ''
                GROUP BY state
                ORDER BY count DESC
                LIMIT 8
                """
            ).fetchall()
        ]

    return {
        "total_sightings": total,
        "geocoded_sightings": geocoded,
        "date_range": {
            "min": normalize_date(min_date),
            "max": normalize_date(max_date),
        },
        "top_shapes": top_shapes,
        "top_states": top_states,
    }


def fetch_pivot(
    db_path: Path,
    query: dict[str, list[str]],
) -> dict[str, object]:
    filters = parse_filter_query(query)
    pinned = {clean_text(value) or "" for value in query.get("pinned", [])}
    date_bucket = (clean_text(query.get("date_bucket", ["month"])[0]) or "month").lower()
    if date_bucket not in {"month", "year"}:
        date_bucket = "month"

    def query_bins(
        *,
        group_sql: str,
        key_name: str,
        limit: int,
        omit: set[str] | None = None,
    ) -> list[dict[str, object]]:
        joins, where, params = build_filter_parts(filters, omit=omit)
        from_clause = "FROM sightings s " + " ".join(joins)
        where_clause = ("WHERE " + " AND ".join(where)) if where else ""
        sql = f"""
            SELECT {group_sql} AS key, COUNT(*) AS count
            {from_clause}
            {where_clause}
            GROUP BY key
            ORDER BY count DESC
            LIMIT ?
        """
        with sqlite3.connect(str(db_path)) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(sql, params + [limit]).fetchall()
        out = []
        for row in rows:
            key = clean_text(row["key"]) or "unknown"
            out.append({key_name: key, "key": key, "count": int(row["count"])})
        return out

    def count_slice() -> int:
        joins, where, params = build_filter_parts(filters)
        from_clause = "FROM sightings s " + " ".join(joins)
        where_clause = ("WHERE " + " AND ".join(where)) if where else ""
        with sqlite3.connect(str(db_path)) as conn:
            total = conn.execute(f"SELECT COUNT(*) {from_clause} {where_clause}", params).fetchone()[0]
        return int(total)

    shape_omit = set() if "shape" in pinned else {"shape"}
    place_omit = set() if "place" in pinned else {"state", "city"}
    date_omit = set() if "date" in pinned else {"date"}

    date_group_sql = "SUBSTR(s.date_time, 1, 7)" if date_bucket == "month" else "SUBSTR(s.date_time, 1, 4)"

    return {
        "slice_total": count_slice(),
        "shape_bins": query_bins(group_sql="COALESCE(NULLIF(TRIM(s.shape),''), 'unknown')", key_name="shape", limit=16, omit=shape_omit),
        "state_bins": query_bins(group_sql="COALESCE(NULLIF(TRIM(s.state),''), '--')", key_name="state", limit=20, omit=place_omit),
        "city_bins": query_bins(group_sql="COALESCE(NULLIF(TRIM(s.city),''), 'unknown-city')", key_name="city", limit=20, omit=place_omit),
        "date_bins": query_bins(group_sql=date_group_sql, key_name="date", limit=48, omit=date_omit),
        "date_bucket": date_bucket,
    }


def _fetch_candidate_rows(
    db_path: Path,
    filters: dict[str, object],
    constraints: dict[str, bool],
    *,
    limit: int = 20000,
) -> list[sqlite3.Row]:
    joins, where, params = build_filter_parts(filters)
    c_where, c_params = build_constraints_where(constraints)
    where.extend(c_where)
    params.extend(c_params)
    from_clause = "FROM sightings s " + " ".join(joins)
    where_clause = ("WHERE " + " AND ".join(where)) if where else ""
    sql = f"""
        SELECT
            s.sighting_id,
            s.date_time,
            s.city,
            s.state,
            s.shape,
            s.duration,
            s.summary,
            s.report_text,
            s.stats,
            s.report_link,
            s.posted,
            s.city_latitude,
            s.city_longitude
        {from_clause}
        {where_clause}
        ORDER BY s.date_time DESC NULLS LAST, s.sighting_id DESC
        LIMIT ?
    """
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(sql, params + [limit]).fetchall()
    return rows


def _sample_rows(rows: list[sqlite3.Row], *, size: int, strategy: str, stratify_by: str | None) -> list[sqlite3.Row]:
    if not rows:
        return []
    if size >= len(rows):
        return list(rows)
    if strategy == "uniform":
        return random.sample(rows, size)

    def group_key(row: sqlite3.Row) -> str:
        if stratify_by == "decade":
            date_time = clean_text(row["date_time"]) or ""
            year_match = re.match(r"(\d{4})", date_time)
            if year_match:
                year = int(year_match.group(1))
                return f"{(year // 10) * 10}s"
            return "unknown"
        return (clean_text(row["shape"]) or "unknown").lower()

    groups: dict[str, list[sqlite3.Row]] = {}
    for row in rows:
        groups.setdefault(group_key(row), []).append(row)

    if strategy == "stratified":
        selected: list[sqlite3.Row] = []
        total = len(rows)
        allocated = 0
        ordered_keys = sorted(groups.keys())
        for key in ordered_keys:
            group = groups[key]
            target = max(1, round((len(group) / total) * size))
            pick = min(target, len(group))
            selected.extend(random.sample(group, pick))
            allocated += pick
        if allocated > size:
            selected = random.sample(selected, size)
        elif allocated < size:
            leftovers = [row for row in rows if row not in selected]
            if leftovers:
                selected.extend(random.sample(leftovers, min(size - allocated, len(leftovers))))
        return selected[:size]

    # rarity_weighted
    weighted_pool: list[tuple[sqlite3.Row, float]] = []
    for key, group in groups.items():
        weight = 1.0 / max(1, len(group))
        for row in group:
            weighted_pool.append((row, weight))
    selected: list[sqlite3.Row] = []
    available = list(weighted_pool)
    for _ in range(size):
        if not available:
            break
        total_weight = sum(weight for _, weight in available)
        choice = random.random() * total_weight
        running = 0.0
        idx = 0
        for i, (_, weight) in enumerate(available):
            running += weight
            if running >= choice:
                idx = i
                break
        row, _ = available.pop(idx)
        selected.append(row)
    return selected


def _serialize_case_row(
    row: sqlite3.Row,
    *,
    enrichment_index: dict[int, list[dict[str, object]]],
    ai_cache: dict[str, dict[str, object]],
    evidence_count: int = 0,
) -> dict[str, object]:
    sid = int(row["sighting_id"])
    report_text = clean_text(row["report_text"], collapse_whitespace=False) or ""
    summary = clean_text(row["summary"]) or (report_text[:217] + "..." if report_text and len(report_text) > 220 else report_text)
    state = normalize_state(row["state"]) or "--"
    date_time = normalize_date(row["date_time"]) or "unknown-date"
    report_link = clean_text(row["report_link"])
    duration = clean_text(row["duration"]) or ""
    row_fingerprint = build_case_fingerprint(
        report_link=report_link,
        date_time=date_time,
        city=clean_text(row["city"]),
        state=state,
        shape=clean_text(row["shape"]),
        duration=duration,
    )
    ai_brief = None
    cache_entry = ai_cache.get(str(sid))
    if cache_entry and cache_entry_matches_case(cache_entry, report_link=report_link, fingerprint=row_fingerprint):
        brief = cache_entry.get("brief")
        if isinstance(brief, dict):
            ai_brief = brief

    enrichment_count = len(enrichment_index.get(sid, []))
    quality_score, quality_label = quality_label_for_case(
        row=row,
        enrichment_count=enrichment_count,
        evidence_count=evidence_count,
    )
    observers = parse_observer_count(row["stats"], report_text)

    return {
        "sighting_id": sid,
        "date_time": date_time,
        "city": clean_text(row["city"]) or "unknown-city",
        "state": state,
        "shape": clean_text(row["shape"]) or "unknown-shape",
        "duration": duration,
        "summary": summary or "",
        "report_text": report_text,
        "stats": clean_text(row["stats"]) or "",
        "report_link": report_link,
        "posted": normalize_date(row["posted"]),
        "city_latitude": row["city_latitude"],
        "city_longitude": row["city_longitude"],
        "enrichment_sources": enrichment_index.get(sid, [])[:6],
        "enrichment_count": enrichment_count,
        "ai_brief": ai_brief,
        "ai_brief_status": "available" if ai_brief else "none",
        "quality_score": quality_score,
        "quality_label": quality_label,
        "observer_count": observers,
        "explainable": detect_explainable_case(report_text, row["stats"]),
        "signals": [key for key, active in extract_case_signals(row["shape"], row["stats"], report_text).items() if active],
    }


def generate_sample(
    db_path: Path,
    enrichment_index: dict[int, list[dict[str, object]]],
    ai_cache: dict[str, dict[str, object]],
    payload: dict[str, object],
) -> dict[str, object]:
    base_filters = parse_filter_payload(payload.get("base_filters") if isinstance(payload, dict) else None)
    constraints = parse_constraints(payload.get("constraints") if isinstance(payload, dict) else None)
    size = to_int(str(payload.get("size") if isinstance(payload, dict) else None), default=10, minimum=1, maximum=100)
    strategy = (clean_text(payload.get("strategy") if isinstance(payload, dict) else None) or "uniform").lower()
    if strategy not in {"uniform", "stratified", "rarity_weighted"}:
        strategy = "uniform"
    stratify_by = (clean_text(payload.get("stratify_by") if isinstance(payload, dict) else None) or "shape").lower()
    if stratify_by not in {"shape", "decade"}:
        stratify_by = "shape"

    candidates = _fetch_candidate_rows(db_path, base_filters, constraints)
    if constraints.get("has_sources"):
        evidence_sighting_ids = fetch_evidence_sighting_ids(db_path)
        candidates = [
            row
            for row in candidates
            if len(enrichment_index.get(int(row["sighting_id"]), [])) > 0
            or int(row["sighting_id"]) in evidence_sighting_ids
        ]
    sampled_rows = _sample_rows(
        candidates,
        size=size,
        strategy=strategy,
        stratify_by=stratify_by if strategy in {"stratified", "rarity_weighted"} else None,
    )

    items = [_serialize_case_row(row, enrichment_index=enrichment_index, ai_cache=ai_cache) for row in sampled_rows]
    warnings: list[str] = []
    if len(candidates) < size:
        warnings.append(
            f"Requested {size} rows, but only {len(candidates)} matched the current slice and constraints."
        )
    return {
        "generated_at": utc_now_iso(),
        "items": items,
        "meta": {
            "strategy": strategy,
            "stratify_by": stratify_by,
            "requested": size,
            "returned": len(items),
            "candidate_count": len(candidates),
            "constraints": constraints,
            "warnings": warnings,
        },
    }


def create_sample_set(db_path: Path, payload: dict[str, object]) -> dict[str, object]:
    name = clean_text(payload.get("name")) if isinstance(payload, dict) else None
    if not name:
        raise ValueError("name is required")
    items = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(items, list) or not items:
        raise ValueError("items must be a non-empty array")

    set_id = uuid.uuid4().hex[:12]
    now = utc_now_iso()
    base_filters = payload.get("base_filters", {}) if isinstance(payload, dict) else {}
    strategy_meta = payload.get("strategy", {}) if isinstance(payload, dict) else {}

    with sqlite3.connect(str(db_path)) as conn:
        conn.execute(
            """
            INSERT INTO sample_sets(set_id, name, base_filters_json, strategy_json, created_at, updated_at)
            VALUES(?, ?, ?, ?, ?, ?)
            """,
            (
                set_id,
                name,
                json.dumps(base_filters, ensure_ascii=True),
                json.dumps(strategy_meta, ensure_ascii=True),
                now,
                now,
            ),
        )
        for rank, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            try:
                sighting_id = int(item.get("sighting_id"))
            except (TypeError, ValueError):
                continue
            quality_label = clean_text(item.get("quality_label")) or clean_text(item.get("quality")) or "medium"
            explainable = 1 if parse_bool(item.get("explainable"), default=False) else 0
            conn.execute(
                """
                INSERT OR REPLACE INTO sample_set_items(set_id, sighting_id, rank, quality_label, explainable)
                VALUES(?, ?, ?, ?, ?)
                """,
                (set_id, sighting_id, rank, quality_label, explainable),
            )
        conn.commit()

    return {"set_id": set_id, "name": name, "created_at": now}


def list_sample_sets(db_path: Path, limit: int) -> dict[str, object]:
    safe_limit = max(1, min(limit, 100))
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT s.set_id, s.name, s.created_at, s.updated_at, COUNT(i.sighting_id) AS item_count
            FROM sample_sets s
            LEFT JOIN sample_set_items i ON i.set_id = s.set_id
            GROUP BY s.set_id
            ORDER BY s.created_at DESC
            LIMIT ?
            """,
            (safe_limit,),
        ).fetchall()
    return {"items": [dict(row) for row in rows]}


def get_sample_set(
    db_path: Path,
    enrichment_index: dict[int, list[dict[str, object]]],
    ai_cache: dict[str, dict[str, object]],
    set_id: str,
) -> dict[str, object] | None:
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        header = conn.execute(
            "SELECT set_id, name, base_filters_json, strategy_json, created_at, updated_at FROM sample_sets WHERE set_id = ?",
            (set_id,),
        ).fetchone()
        if header is None:
            return None

        rows = conn.execute(
            """
            SELECT i.rank, i.quality_label, i.explainable,
                   s.sighting_id, s.date_time, s.city, s.state, s.shape, s.duration, s.summary,
                   s.report_text, s.stats, s.report_link, s.posted, s.city_latitude, s.city_longitude
            FROM sample_set_items i
            JOIN sightings s ON s.sighting_id = i.sighting_id
            WHERE i.set_id = ?
            ORDER BY i.rank ASC
            """,
            (set_id,),
        ).fetchall()

    items = [_serialize_case_row(row, enrichment_index=enrichment_index, ai_cache=ai_cache) for row in rows]
    for row, item in zip(rows, items):
        item["quality_label"] = clean_text(row["quality_label"]) or item.get("quality_label")
        item["explainable"] = bool(row["explainable"])
        item["rank"] = int(row["rank"])

    return {
        "set_id": header["set_id"],
        "name": header["name"],
        "base_filters": json.loads(header["base_filters_json"]),
        "strategy": json.loads(header["strategy_json"]),
        "created_at": header["created_at"],
        "updated_at": header["updated_at"],
        "items": items,
    }


def _extract_domain(url: str | None) -> str | None:
    raw = clean_text(url)
    if not raw:
        return None
    parsed = urlparse(raw)
    return parsed.netloc.lower() if parsed.netloc else None


def list_case_evidence(db_path: Path, sighting_id: int) -> list[dict[str, object]]:
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT evidence_id, sighting_id, source_title, source_url, domain, stance,
                   match_time, match_location, match_visual, notes, excerpt, attachment_path, created_at
            FROM evidence_links
            WHERE sighting_id = ?
            ORDER BY evidence_id DESC
            """,
            (sighting_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def create_case_evidence(db_path: Path, sighting_id: int, payload: dict[str, object]) -> dict[str, object]:
    source_title = clean_text(payload.get("source_title")) if isinstance(payload, dict) else None
    if not source_title:
        raise ValueError("source_title is required")
    notes = clean_text(payload.get("notes")) if isinstance(payload, dict) else None
    if not notes:
        raise ValueError("notes is required")
    stance = (clean_text(payload.get("stance")) if isinstance(payload, dict) else None) or "contextual"
    stance_norm = stance.lower()
    if stance_norm not in {"supports", "contradicts", "contextual"}:
        raise ValueError("stance must be supports, contradicts, or contextual")
    source_url = clean_text(payload.get("source_url")) if isinstance(payload, dict) else None
    if source_url and not is_http_url(source_url):
        raise ValueError("source_url must be a valid http(s) URL")
    created_at = utc_now_iso()
    with sqlite3.connect(str(db_path)) as conn:
        cur = conn.execute(
            """
            INSERT INTO evidence_links(
              sighting_id, source_title, source_url, domain, stance,
              match_time, match_location, match_visual, notes, excerpt, attachment_path, created_at
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                sighting_id,
                source_title,
                source_url,
                _extract_domain(source_url),
                stance_norm,
                1 if parse_bool(payload.get("match_time"), default=False) else 0,
                1 if parse_bool(payload.get("match_location"), default=False) else 0,
                1 if parse_bool(payload.get("match_visual"), default=False) else 0,
                notes,
                clean_text(payload.get("excerpt")) if isinstance(payload, dict) else None,
                clean_text(payload.get("attachment_path")) if isinstance(payload, dict) else None,
                created_at,
            ),
        )
        conn.commit()
        evidence_id = int(cur.lastrowid)
    return {
        "evidence_id": evidence_id,
        "sighting_id": sighting_id,
        "source_title": source_title,
        "source_url": source_url,
        "domain": _extract_domain(source_url),
        "stance": stance_norm,
        "match_time": parse_bool(payload.get("match_time"), default=False),
        "match_location": parse_bool(payload.get("match_location"), default=False),
        "match_visual": parse_bool(payload.get("match_visual"), default=False),
        "notes": notes,
        "excerpt": clean_text(payload.get("excerpt")) if isinstance(payload, dict) else None,
        "attachment_path": clean_text(payload.get("attachment_path")) if isinstance(payload, dict) else None,
        "created_at": created_at,
    }


def update_case_evidence(db_path: Path, sighting_id: int, evidence_id: int, payload: dict[str, object]) -> dict[str, object] | None:
    fields: list[str] = []
    params: list[object] = []
    editable = {
        "source_title": lambda value: clean_text(value),
        "source_url": lambda value: clean_text(value),
        "stance": lambda value: (clean_text(value) or "").lower(),
        "notes": lambda value: clean_text(value),
        "excerpt": lambda value: clean_text(value),
        "attachment_path": lambda value: clean_text(value),
    }
    for key, normalizer in editable.items():
        if key not in payload:
            continue
        normalized = normalizer(payload.get(key))
        if key == "stance" and normalized and normalized not in {"supports", "contradicts", "contextual"}:
            raise ValueError("stance must be supports, contradicts, or contextual")
        if key == "source_url" and normalized and not is_http_url(normalized):
            raise ValueError("source_url must be a valid http(s) URL")
        if key == "source_url":
            fields.append("domain = ?")
            params.append(_extract_domain(normalized))
        fields.append(f"{key} = ?")
        params.append(normalized)

    for key in ("match_time", "match_location", "match_visual"):
        if key in payload:
            fields.append(f"{key} = ?")
            params.append(1 if parse_bool(payload.get(key), default=False) else 0)

    if not fields:
        raise ValueError("No updatable fields provided")

    with sqlite3.connect(str(db_path)) as conn:
        conn.execute(
            f"UPDATE evidence_links SET {', '.join(fields)} WHERE evidence_id = ? AND sighting_id = ?",
            params + [evidence_id, sighting_id],
        )
        conn.commit()
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            """
            SELECT evidence_id, sighting_id, source_title, source_url, domain, stance,
                   match_time, match_location, match_visual, notes, excerpt, attachment_path, created_at
            FROM evidence_links
            WHERE evidence_id = ? AND sighting_id = ?
            """,
            (evidence_id, sighting_id),
        ).fetchone()
    return dict(row) if row else None


def generate_ai_case_brief_vnext(api_key: str, model: str, case_payload: dict[str, object]) -> dict[str, object]:
    system_prompt = (
        "You are a UFO case analyst. Return strict JSON only. "
        "Every claim must include supporting citations from provided fields or linked sources."
    )
    user_prompt = (
        "Return exactly this JSON shape:\n"
        "{\n"
        '  "summary": {\n'
        '    "synopsis_bullets": ["5-7 concise bullets"],\n'
        '    "witness_claims": ["short quoted snippets"],\n'
        '    "conventional_hypotheses": [\n'
        '      {"label":"hypothesis","why":"one sentence","confidence_0_to_1":0.0}\n'
        "    ]\n"
        "  },\n"
        '  "signals": [\n'
        '    {"key":"signal_key","label":"Signal Label","why":"short reason"}\n'
        "  ],\n"
        '  "citations": [\n'
        '    {"claim":"claim text","field_keys":["shape","duration"],"narrative_excerpt":"short quote","source_urls":["https://..."]}\n'
        "  ],\n"
        '  "overall_confidence_0_to_1": 0.0\n'
        "}\n\n"
        "Rules: no fabricated events, confidence calibrated, evidence-first.\n\n"
        f"Case JSON:\n{json.dumps(case_payload, ensure_ascii=True)}"
    )

    body = {
        "model": model,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    req = Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urlopen(req, timeout=90) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"OpenAI HTTP error {exc.code}: {detail[:400]}") from exc
    except URLError as exc:
        raise RuntimeError(f"OpenAI request failed: {exc}") from exc

    content = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not content:
        raise RuntimeError("OpenAI returned an empty completion.")
    parsed = parse_json_maybe(content)
    if "summary" not in parsed:
        parsed["summary"] = {
            "synopsis_bullets": [],
            "witness_claims": [],
            "conventional_hypotheses": [],
        }
    if "signals" not in parsed:
        parsed["signals"] = []
    if "citations" not in parsed:
        parsed["citations"] = []
    return parsed


def list_case_brief_versions(db_path: Path, sighting_id: int) -> list[dict[str, object]]:
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT brief_id, sighting_id, version_num, generated_at, model_label,
                   brief_json, citations_json, source_snapshot_json
            FROM ai_brief_versions
            WHERE sighting_id = ?
            ORDER BY version_num DESC
            """,
            (sighting_id,),
        ).fetchall()
    out: list[dict[str, object]] = []
    for row in rows:
        out.append(
            {
                "brief_id": row["brief_id"],
                "sighting_id": row["sighting_id"],
                "version_num": row["version_num"],
                "generated_at": row["generated_at"],
                "model_label": row["model_label"],
                "brief": json.loads(row["brief_json"]),
                "citations": json.loads(row["citations_json"]),
                "source_snapshot": json.loads(row["source_snapshot_json"]),
            }
        )
    return out


def create_case_brief_version(
    db_path: Path,
    enrichment_index: dict[int, list[dict[str, object]]],
    sighting_id: int,
    model: str,
    api_key: str,
) -> dict[str, object]:
    case_payload = get_case_payload(db_path, enrichment_index, sighting_id)
    if case_payload is None:
        raise ValueError(f"sighting_id {sighting_id} not found")
    brief = generate_ai_case_brief_vnext(api_key, model, case_payload)
    citations = brief.get("citations") if isinstance(brief, dict) else []
    if not isinstance(citations, list):
        citations = []

    with sqlite3.connect(str(db_path)) as conn:
        next_version = int(
            conn.execute(
                "SELECT COALESCE(MAX(version_num), 0) + 1 FROM ai_brief_versions WHERE sighting_id = ?",
                (sighting_id,),
            ).fetchone()[0]
        )
        cur = conn.execute(
            """
            INSERT INTO ai_brief_versions(
              sighting_id, version_num, generated_at, model_label, brief_json, citations_json, source_snapshot_json
            ) VALUES(?, ?, ?, ?, ?, ?, ?)
            """,
            (
                sighting_id,
                next_version,
                utc_now_iso(),
                model,
                json.dumps(brief, ensure_ascii=True),
                json.dumps(citations, ensure_ascii=True),
                json.dumps(case_payload.get("linked_sources", []), ensure_ascii=True),
            ),
        )
        conn.commit()
        brief_id = int(cur.lastrowid)
    return {
        "brief_id": brief_id,
        "sighting_id": sighting_id,
        "version_num": next_version,
        "model_label": model,
        "brief": brief,
        "citations": citations,
    }


def compare_case_briefs(db_path: Path, sighting_id: int, left_id: int, right_id: int) -> dict[str, object] | None:
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        left = conn.execute(
            "SELECT brief_json, version_num, generated_at FROM ai_brief_versions WHERE sighting_id = ? AND brief_id = ?",
            (sighting_id, left_id),
        ).fetchone()
        right = conn.execute(
            "SELECT brief_json, version_num, generated_at FROM ai_brief_versions WHERE sighting_id = ? AND brief_id = ?",
            (sighting_id, right_id),
        ).fetchone()
    if left is None or right is None:
        return None
    left_json = json.loads(left["brief_json"])
    right_json = json.loads(right["brief_json"])
    changed_keys = []
    for key in sorted(set(left_json.keys()) | set(right_json.keys())):
        if left_json.get(key) != right_json.get(key):
            changed_keys.append(
                {
                    "key": key,
                    "left": left_json.get(key),
                    "right": right_json.get(key),
                }
            )
    return {
        "left": {"brief_id": left_id, "version_num": left["version_num"], "generated_at": left["generated_at"]},
        "right": {"brief_id": right_id, "version_num": right["version_num"], "generated_at": right["generated_at"]},
        "changes": changed_keys,
    }


def create_brief_issue(db_path: Path, sighting_id: int, brief_id: int, payload: dict[str, object]) -> dict[str, object]:
    reason_code = (clean_text(payload.get("reason_code")) if isinstance(payload, dict) else None) or "other"
    notes = clean_text(payload.get("notes")) if isinstance(payload, dict) else None
    created_at = utc_now_iso()
    with sqlite3.connect(str(db_path)) as conn:
        cur = conn.execute(
            """
            INSERT INTO ai_brief_issues(brief_id, sighting_id, reason_code, notes, created_at)
            VALUES(?, ?, ?, ?, ?)
            """,
            (brief_id, sighting_id, reason_code, notes, created_at),
        )
        conn.commit()
        issue_id = int(cur.lastrowid)
    return {
        "issue_id": issue_id,
        "brief_id": brief_id,
        "sighting_id": sighting_id,
        "reason_code": reason_code,
        "notes": notes,
        "created_at": created_at,
    }


def compare_cohorts(
    db_path: Path,
    enrichment_index: dict[int, list[dict[str, object]]],
    ai_cache: dict[str, dict[str, object]],
    payload: dict[str, object],
) -> dict[str, object]:
    base_filters = parse_filter_payload(payload.get("base_filters") if isinstance(payload, dict) else None)
    include_baseline = parse_bool(payload.get("include_baseline") if isinstance(payload, dict) else False, default=False)
    sample_size = to_int(str(payload.get("sample_size") if isinstance(payload, dict) else None), default=10, minimum=1, maximum=50)
    cohorts = payload.get("cohorts") if isinstance(payload, dict) else None
    if not isinstance(cohorts, list) or len(cohorts) < 2:
        raise ValueError("cohorts must include at least two entries")

    out_cohorts: list[dict[str, object]] = []
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        for cohort in cohorts[:2]:
            if not isinstance(cohort, dict):
                continue
            cohort_filter = parse_filter_payload(cohort.get("filter") if isinstance(cohort, dict) else None)
            merged = merge_filters(base_filters, cohort_filter)
            joins, where, params = build_filter_parts(merged)
            from_clause = "FROM sightings s " + " ".join(joins)
            where_clause = ("WHERE " + " AND ".join(where)) if where else ""
            total = int(conn.execute(f"SELECT COUNT(*) {from_clause} {where_clause}", params).fetchone()[0])
            geocoded = int(
                conn.execute(
                    f"SELECT COUNT(*) {from_clause} {where_clause} "
                    + (" AND " if where_clause else "WHERE ")
                    + "s.city_latitude IS NOT NULL AND s.city_longitude IS NOT NULL",
                    params,
                ).fetchone()[0]
            )
            signal_rows = conn.execute(
                f"""
                SELECT s.shape, s.stats, s.report_text
                {from_clause}
                {where_clause}
                ORDER BY s.date_time DESC NULLS LAST
                LIMIT 3000
                """,
                params,
            ).fetchall()
            sampled_rows = conn.execute(
                f"""
                SELECT
                    s.sighting_id, s.date_time, s.city, s.state, s.shape, s.duration, s.summary,
                    s.report_text, s.stats, s.report_link, s.posted, s.city_latitude, s.city_longitude
                {from_clause}
                {where_clause}
                ORDER BY RANDOM()
                LIMIT ?
                """,
                params + [sample_size],
            ).fetchall()
            sampled_cases = [
                _serialize_case_row(row, enrichment_index=enrichment_index, ai_cache=ai_cache) for row in sampled_rows
            ]
            out_cohorts.append(
                {
                    "id": clean_text(cohort.get("id")) or f"cohort-{len(out_cohorts)+1}",
                    "label": clean_text(cohort.get("label")) or f"Cohort {len(out_cohorts)+1}",
                    "total": total,
                    "geocoded_pct": round((geocoded / total) * 100, 1) if total else 0.0,
                    "top_signals": top_signal_percentages(signal_rows),
                    "sampled_cases": sampled_cases,
                }
            )

        baseline = None
        if include_baseline:
            joins, where, params = build_filter_parts(base_filters)
            from_clause = "FROM sightings s " + " ".join(joins)
            where_clause = ("WHERE " + " AND ".join(where)) if where else ""
            total = int(conn.execute(f"SELECT COUNT(*) {from_clause} {where_clause}", params).fetchone()[0])
            baseline = {"total": total}

    return {"cohorts": out_cohorts, "baseline": baseline}


class UFORequestHandler(SimpleHTTPRequestHandler):
    server_version = "UFOBoard/1.0"

    def __init__(self, *args, directory: str | None = None, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    @property
    def db_path(self) -> Path:
        return self.server.db_path  # type: ignore[attr-defined]

    @property
    def enrichment_index(self) -> dict[int, list[dict[str, object]]]:
        return self.server.enrichment_index  # type: ignore[attr-defined]

    @property
    def ai_cache(self) -> dict[str, dict[str, object]]:
        return self.server.ai_cache  # type: ignore[attr-defined]

    @property
    def ai_cache_path(self) -> Path:
        return self.server.ai_cache_path  # type: ignore[attr-defined]

    @property
    def ai_cache_lock(self) -> threading.Lock:
        return self.server.ai_cache_lock  # type: ignore[attr-defined]

    @property
    def openai_model(self) -> str:
        return self.server.openai_model  # type: ignore[attr-defined]

    def log_message(self, format: str, *args) -> None:
        return super().log_message(format, *args)

    def _send_json(self, payload: dict[str, object], status: int = 200) -> None:
        raw = json.dumps(payload, ensure_ascii=True).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _read_json_body(self) -> dict[str, object]:
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(content_length) if content_length > 0 else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError("Invalid JSON body") from exc
        if not isinstance(payload, dict):
            raise ValueError("JSON body must be an object")
        return payload

    def _handle_legacy_enrich(self, payload: dict[str, object]) -> None:
        try:
            sighting_id = int(payload.get("sighting_id"))
        except (TypeError, ValueError):
            self._send_json({"error": "sighting_id must be an integer"}, status=400)
            return
        force = parse_bool(payload.get("force"), default=False)

        case_payload = get_case_payload(self.db_path, self.enrichment_index, sighting_id)
        if case_payload is None:
            self._send_json({"error": f"sighting_id {sighting_id} not found"}, status=404)
            return

        raw_case_report_link = case_payload.get("report_link")
        report_link = clean_text(raw_case_report_link) if isinstance(raw_case_report_link, str) else None
        case_fingerprint = build_fingerprint_from_payload(case_payload)

        cache_key = str(sighting_id)
        with self.ai_cache_lock:
            cached = self.ai_cache.get(cache_key)
        if (
            cached
            and not force
            and cache_entry_matches_case(
                cached,
                report_link=report_link,
                fingerprint=case_fingerprint,
            )
            and isinstance(cached.get("brief"), dict)
        ):
            self._send_json(
                {"ok": True, "cached": True, "sighting_id": sighting_id, "brief": cached.get("brief")}
            )
            return

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            self._send_json(
                {"error": "OPENAI_API_KEY is not set. Set it in your shell before starting the server."},
                status=400,
            )
            return

        try:
            brief = generate_ai_case_brief(api_key, self.openai_model, case_payload)
        except RuntimeError as exc:
            self._send_json({"error": str(exc)}, status=502)
            return
        except Exception as exc:  # defensive fallback
            self._send_json({"error": f"AI enrichment failed: {exc}"}, status=500)
            return

        entry = {
            "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
            "model": self.openai_model,
            "report_link": report_link,
            "fingerprint": case_fingerprint,
            "brief": brief,
        }
        with self.ai_cache_lock:
            self.ai_cache[cache_key] = entry
            save_ai_cache(self.ai_cache_path, self.ai_cache)

        self._send_json({"ok": True, "cached": False, "sighting_id": sighting_id, "brief": brief})

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        if path == "/favicon.ico":
            self.send_response(HTTPStatus.NO_CONTENT)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if path == "/api/health":
            self._send_json({"ok": True})
            return
        if path == "/api/sightings":
            try:
                payload = fetch_sightings(self.db_path, self.enrichment_index, self.ai_cache, query)
                self._send_json(payload)
            except sqlite3.OperationalError as exc:
                message = str(exc)
                status = 400 if "fts" in message.lower() else 500
                self._send_json({"error": message}, status=status)
            return
        if path == "/api/options":
            self._send_json(fetch_options(self.db_path))
            return
        if path == "/api/stats":
            self._send_json(fetch_stats(self.db_path))
            return
        if path == "/api/pivot":
            self._send_json(fetch_pivot(self.db_path, query))
            return
        if path == "/api/sample-sets":
            limit = to_int(query.get("limit", [None])[0], default=20, minimum=1, maximum=100)
            self._send_json(list_sample_sets(self.db_path, limit))
            return

        sample_match = re.fullmatch(r"/api/sample-sets/([A-Za-z0-9_-]+)", path)
        if sample_match:
            payload = get_sample_set(
                self.db_path,
                self.enrichment_index,
                self.ai_cache,
                sample_match.group(1),
            )
            if payload is None:
                self._send_json({"error": "Sample set not found"}, status=404)
                return
            self._send_json(payload)
            return

        case_match = re.fullmatch(r"/api/cases/(\d+)", path)
        if case_match:
            sighting_id = int(case_match.group(1))
            payload = fetch_case_file(self.db_path, self.enrichment_index, self.ai_cache, sighting_id)
            if payload is None:
                self._send_json({"error": f"sighting_id {sighting_id} not found"}, status=404)
                return
            self._send_json(payload)
            return

        evidence_match = re.fullmatch(r"/api/cases/(\d+)/evidence", path)
        if evidence_match:
            sighting_id = int(evidence_match.group(1))
            self._send_json({"items": list_case_evidence(self.db_path, sighting_id)})
            return

        compare_match = re.fullmatch(r"/api/cases/(\d+)/briefs/compare", path)
        if compare_match:
            sighting_id = int(compare_match.group(1))
            try:
                left_id = int(query.get("left", [None])[0])
                right_id = int(query.get("right", [None])[0])
            except (TypeError, ValueError):
                self._send_json({"error": "left and right brief IDs are required"}, status=400)
                return
            result = compare_case_briefs(self.db_path, sighting_id, left_id, right_id)
            if result is None:
                self._send_json({"error": "Brief version not found"}, status=404)
                return
            self._send_json(result)
            return

        briefs_match = re.fullmatch(r"/api/cases/(\d+)/briefs", path)
        if briefs_match:
            sighting_id = int(briefs_match.group(1))
            self._send_json({"items": list_case_brief_versions(self.db_path, sighting_id)})
            return

        if path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        if not path.startswith("/api/"):
            self._send_json({"error": "Not found"}, status=404)
            return

        try:
            payload = self._read_json_body()
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status=400)
            return

        if path == "/api/enrich":
            self._handle_legacy_enrich(payload)
            return
        if path == "/api/compare":
            try:
                result = compare_cohorts(self.db_path, self.enrichment_index, self.ai_cache, payload)
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=400)
                return
            self._send_json(result)
            return
        if path == "/api/samples/generate":
            result = generate_sample(self.db_path, self.enrichment_index, self.ai_cache, payload)
            self._send_json(result)
            return
        if path == "/api/sample-sets":
            try:
                result = create_sample_set(self.db_path, payload)
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=400)
                return
            self._send_json(result, status=201)
            return

        evidence_match = re.fullmatch(r"/api/cases/(\d+)/evidence", path)
        if evidence_match:
            sighting_id = int(evidence_match.group(1))
            try:
                result = create_case_evidence(self.db_path, sighting_id, payload)
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=400)
                return
            self._send_json(result, status=201)
            return

        briefs_match = re.fullmatch(r"/api/cases/(\d+)/briefs", path)
        if briefs_match:
            sighting_id = int(briefs_match.group(1))
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                self._send_json(
                    {"error": "OPENAI_API_KEY is not set. Set it in your shell before starting the server."},
                    status=400,
                )
                return
            try:
                result = create_case_brief_version(
                    self.db_path,
                    self.enrichment_index,
                    sighting_id,
                    self.openai_model,
                    api_key,
                )
            except ValueError as exc:
                status = 404 if "not found" in str(exc).lower() else 400
                self._send_json({"error": str(exc)}, status=status)
                return
            except RuntimeError as exc:
                self._send_json({"error": str(exc)}, status=502)
                return
            self._send_json(result, status=201)
            return

        issue_match = re.fullmatch(r"/api/cases/(\d+)/briefs/(\d+)/issues", path)
        if issue_match:
            sighting_id = int(issue_match.group(1))
            brief_id = int(issue_match.group(2))
            result = create_brief_issue(self.db_path, sighting_id, brief_id, payload)
            self._send_json(result, status=201)
            return

        self._send_json({"error": "Not found"}, status=404)

    def do_PATCH(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        patch_match = re.fullmatch(r"/api/cases/(\d+)/evidence/(\d+)", path)
        if not patch_match:
            self._send_json({"error": "Not found"}, status=404)
            return

        try:
            payload = self._read_json_body()
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status=400)
            return

        try:
            sighting_id = int(patch_match.group(1))
            evidence_id = int(patch_match.group(2))
            updated = update_case_evidence(self.db_path, sighting_id, evidence_id, payload)
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status=400)
            return
        if updated is None:
            self._send_json({"error": "Evidence not found"}, status=404)
            return

        self._send_json(updated)

    def send_error(self, code: int, message: str | None = None, explain: str | None = None) -> None:
        if code == HTTPStatus.NOT_FOUND:
            self._send_json({"error": "Not found"}, status=404)
            return
        return super().send_error(code, message, explain)


def main() -> int:
    args = parse_args()
    db_path = Path(args.db).expanduser().resolve()
    enrichment_csv = Path(args.enrichment_csv).expanduser().resolve()
    ai_cache_path = Path(args.ai_cache).expanduser().resolve()
    if not db_path.exists():
        raise SystemExit(f"Database file not found: {db_path}")
    if not WEB_DIR.exists():
        raise SystemExit(f"Web directory not found: {WEB_DIR}")

    ensure_vnext_schema(db_path)
    enrichment_index = load_enrichment_index(enrichment_csv)
    ai_cache = load_ai_cache(ai_cache_path)
    try:
        server = ThreadingHTTPServer((args.host, args.port), UFORequestHandler)
    except OSError as exc:
        if exc.errno in {48, 98}:  # macOS/Linux "Address already in use"
            raise SystemExit(
                f"Port {args.port} is already in use on {args.host}. "
                f"Try a different port, e.g. --port {args.port + 1}"
            ) from exc
        raise SystemExit(f"Could not start server: {exc}") from exc

    server.db_path = db_path  # type: ignore[attr-defined]
    server.enrichment_index = enrichment_index  # type: ignore[attr-defined]
    server.ai_cache = ai_cache  # type: ignore[attr-defined]
    server.ai_cache_path = ai_cache_path  # type: ignore[attr-defined]
    server.ai_cache_lock = threading.Lock()  # type: ignore[attr-defined]
    server.openai_model = args.openai_model  # type: ignore[attr-defined]

    print(f"Serving frontend: http://{args.host}:{args.port}", flush=True)
    print(f"Using database:   {db_path}", flush=True)
    print(
        "Enrichment CSV:  "
        f"{enrichment_csv if enrichment_csv.exists() else 'not found (running without extra source rows)'}"
        ,
        flush=True,
    )
    print(f"Enriched IDs:     {len(enrichment_index):,}", flush=True)
    print(f"AI cache entries: {len(ai_cache):,}", flush=True)
    print(f"AI model:         {args.openai_model}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
