"""Database schema management and data loading utilities."""

from __future__ import annotations

import csv
import json
import sqlite3
from pathlib import Path

from .models import clean_text, normalize_state, to_float


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
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS sighting_scores (
                sighting_id INTEGER PRIMARY KEY,
                story_score INTEGER NOT NULL DEFAULT 0,
                description_richness INTEGER NOT NULL DEFAULT 0,
                signal_density INTEGER NOT NULL DEFAULT 0,
                witness_strength INTEGER NOT NULL DEFAULT 0,
                corroboration INTEGER NOT NULL DEFAULT 0,
                location_specificity INTEGER NOT NULL DEFAULT 0,
                media_mention INTEGER NOT NULL DEFAULT 0,
                shape_rarity INTEGER NOT NULL DEFAULT 0,
                computed_at TEXT NOT NULL
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS bookmarks (
                bookmark_id INTEGER PRIMARY KEY AUTOINCREMENT,
                sighting_id INTEGER NOT NULL UNIQUE,
                notes TEXT,
                status TEXT NOT NULL DEFAULT 'new',
                created_at TEXT NOT NULL
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS collections (
                collection_id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS collection_items (
                collection_id INTEGER NOT NULL,
                sighting_id INTEGER NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(collection_id, sighting_id)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS dismissed_discoveries (
                sighting_id INTEGER PRIMARY KEY,
                dismissed_at TEXT NOT NULL
            )
            """
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sighting_scores_score ON sighting_scores(story_score DESC)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_bookmarks_sighting_id ON bookmarks(sighting_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_bookmarks_status ON bookmarks(status)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON collection_items(collection_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sample_sets_created_at ON sample_sets(created_at)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_evidence_links_sighting_id ON evidence_links(sighting_id)")
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_ai_brief_versions_sighting_id_version ON ai_brief_versions(sighting_id, version_num)"
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_ai_brief_issues_brief_id ON ai_brief_issues(brief_id)")
        cur.execute(
            """
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
            """
        )
        conn.commit()


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


def fetch_score_map(db_path: Path, sighting_ids: list[int]) -> dict[int, dict[str, int]]:
    unique_ids = sorted({int(sid) for sid in sighting_ids if sid is not None})
    if not unique_ids:
        return {}
    placeholders = ",".join("?" for _ in unique_ids)
    sql = (
        "SELECT sighting_id, story_score, description_richness, signal_density, "
        "witness_strength, corroboration, location_specificity, media_mention, shape_rarity "
        f"FROM sighting_scores WHERE sighting_id IN ({placeholders})"
    )
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(sql, unique_ids).fetchall()
    return {int(row["sighting_id"]): dict(row) for row in rows}


def fetch_bookmark_set(db_path: Path, sighting_ids: list[int]) -> set[int]:
    unique_ids = sorted({int(sid) for sid in sighting_ids if sid is not None})
    if not unique_ids:
        return set()
    placeholders = ",".join("?" for _ in unique_ids)
    sql = f"SELECT sighting_id FROM bookmarks WHERE sighting_id IN ({placeholders})"
    with sqlite3.connect(str(db_path)) as conn:
        rows = conn.execute(sql, unique_ids).fetchall()
    return {int(row[0]) for row in rows}


def fetch_evidence_sighting_ids(db_path: Path) -> set[int]:
    with sqlite3.connect(str(db_path)) as conn:
        rows = conn.execute("SELECT DISTINCT sighting_id FROM evidence_links").fetchall()
    return {int(row[0]) for row in rows}


def fetch_context_map(db_path: Path, sighting_ids: list[int]) -> dict[int, dict[str, object]]:
    unique_ids = sorted({int(sid) for sid in sighting_ids if sid is not None})
    if not unique_ids:
        return {}
    placeholders = ",".join("?" for _ in unique_ids)
    sql = (
        "SELECT sighting_id, cloud_cover_pct, visibility_m, wind_speed_ms, temperature_c, "
        "nearest_base_name, nearest_base_km, fireball_match_date, fireball_distance_km, "
        "fireball_energy, kp_index, context_updated_at "
        f"FROM sighting_context WHERE sighting_id IN ({placeholders})"
    )
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(sql, unique_ids).fetchall()
    return {int(row["sighting_id"]): dict(row) for row in rows}


def fetch_context_row(db_path: Path, sighting_id: int) -> dict[str, object] | None:
    sql = (
        "SELECT sighting_id, cloud_cover_pct, visibility_m, wind_speed_ms, temperature_c, "
        "nearest_base_name, nearest_base_km, fireball_match_date, fireball_distance_km, "
        "fireball_energy, kp_index, context_updated_at "
        "FROM sighting_context WHERE sighting_id = ?"
    )
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(sql, (sighting_id,)).fetchone()
    return dict(row) if row else None


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
