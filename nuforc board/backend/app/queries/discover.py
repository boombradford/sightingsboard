"""Discover story operations."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from ..models import clean_text, normalize_fts_keyword, to_int, utc_now_iso
from ..db import fetch_evidence_count_map
from .cases import _serialize_case_row


def fetch_discover(
    db_path: Path,
    enrichment_index: dict[int, list[dict[str, object]]],
    ai_cache: dict[str, dict[str, object]],
    query: dict[str, list[str]],
) -> dict[str, object]:
    """Discover compelling un-bookmarked, un-dismissed sightings."""
    limit = to_int(query.get("limit", [None])[0], default=20, minimum=1, maximum=100)
    theme = clean_text(query.get("theme", [None])[0])

    sql_parts = [
        "SELECT s.sighting_id, s.date_time, s.city, s.state, s.shape, s.duration, s.summary,",
        "s.report_text, s.stats, s.report_link, s.posted, s.city_latitude, s.city_longitude,",
        "sc.story_score",
        "FROM sighting_scores sc",
        "JOIN sightings s ON s.sighting_id = sc.sighting_id",
        "LEFT JOIN bookmarks b ON b.sighting_id = s.sighting_id",
        "LEFT JOIN dismissed_discoveries dd ON dd.sighting_id = s.sighting_id",
    ]
    params: list[object] = []

    where = ["b.sighting_id IS NULL", "dd.sighting_id IS NULL", "sc.story_score >= 30"]

    if theme:
        keyword_query = normalize_fts_keyword(theme)
        if keyword_query:
            sql_parts.append("JOIN sightings_fts ON sightings_fts.rowid = s.sighting_id")
            where.append("sightings_fts MATCH ?")
            params.append(keyword_query)

    sql_parts.append("WHERE " + " AND ".join(where))
    sql_parts.append("ORDER BY RANDOM()")
    sql_parts.append("LIMIT ?")
    params.append(limit)

    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(" ".join(sql_parts), params).fetchall()

    sighting_ids = [int(row["sighting_id"]) for row in rows]
    evidence_map = fetch_evidence_count_map(db_path, sighting_ids)

    items = []
    for row in rows:
        sid = int(row["sighting_id"])
        evidence_count = evidence_map.get(sid, 0)
        serialized = _serialize_case_row(row, enrichment_index=enrichment_index, ai_cache=ai_cache, evidence_count=evidence_count)
        serialized["story_score"] = row["story_score"] or 0
        items.append(serialized)

    items.sort(key=lambda x: x.get("story_score", 0), reverse=True)

    return {"items": items, "theme": theme}


def dismiss_discovery(db_path: Path, sighting_id: int) -> dict[str, object]:
    """Dismiss a sighting from discover results."""
    now = utc_now_iso()
    with sqlite3.connect(str(db_path)) as conn:
        conn.execute(
            "INSERT OR REPLACE INTO dismissed_discoveries(sighting_id, dismissed_at) VALUES(?, ?)",
            (sighting_id, now),
        )
        conn.commit()
    return {"sighting_id": sighting_id, "dismissed_at": now}


def undismiss_discovery(db_path: Path, sighting_id: int) -> bool:
    """Remove a sighting from the dismissed list."""
    with sqlite3.connect(str(db_path)) as conn:
        cur = conn.execute("DELETE FROM dismissed_discoveries WHERE sighting_id = ?", (sighting_id,))
        conn.commit()
    return cur.rowcount > 0
