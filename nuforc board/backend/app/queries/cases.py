"""Case file operations."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from urllib.parse import urlparse

from ..models import (
    build_filter_parts,
    clean_text,
    detect_explainable_case,
    extract_case_signals,
    normalize_date,
    normalize_state,
    parse_observer_count,
)
from ..scoring import compute_story_score, quality_label_for_case
from ..db import fetch_score_map


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
    story_scores = compute_story_score(row, evidence_count, enrichment_count)

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
        "story_score": story_scores["story_score"],
        "is_bookmarked": False,
    }


def fetch_case_file(
    db_path: Path,
    enrichment_index: dict[int, list[dict[str, object]]],
    ai_cache: dict[str, dict[str, object]],
    sighting_id: int,
) -> dict[str, object] | None:
    from .evidence import list_case_evidence

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
    with sqlite3.connect(str(db_path)) as conn:
        bm_row = conn.execute("SELECT sighting_id, notes, status FROM bookmarks WHERE sighting_id = ?", (sighting_id,)).fetchone()
    serialized["is_bookmarked"] = bm_row is not None
    serialized["bookmark_notes"] = bm_row[1] if bm_row else None
    serialized["bookmark_status"] = bm_row[2] if bm_row else None
    score_rows = fetch_score_map(db_path, [sighting_id])
    score_data = score_rows.get(sighting_id)
    if score_data:
        serialized["story_score"] = score_data.get("story_score", serialized.get("story_score", 0))
        serialized["score_breakdown"] = {
            k: score_data.get(k, 0) for k in [
                "description_richness", "signal_density", "witness_strength",
                "corroboration", "location_specificity", "media_mention", "shape_rarity",
            ]
        }
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
