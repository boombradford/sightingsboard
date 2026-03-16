"""Sighting list, options, stats, and pivot queries."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from ..models import (
    build_filter_parts,
    clean_text,
    detect_explainable_case,
    extract_case_signals,
    normalize_date,
    normalize_fts_keyword,
    normalize_state,
    normalize_to_date_upper_bound,
    parse_bool,
    parse_filter_query,
    parse_observer_count,
    to_int,
    utc_now_iso,
)
from ..scoring import quality_label_for_case, top_signal_percentages
from ..db import fetch_bookmark_set, fetch_evidence_count_map, fetch_score_map
from .cases import build_case_fingerprint, cache_entry_matches_case


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
    has_description = parse_bool(query.get("has_description", [None])[0], default=False)
    order = (query.get("order", ["recent"])[0] or "recent").lower()
    limit = to_int(query.get("limit", [None])[0], default=20, minimum=1, maximum=500)
    offset = to_int(query.get("offset", [None])[0], default=0, minimum=0, maximum=200000)

    if order not in {"recent", "oldest", "random", "story_score", "content_potential"}:
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
    if has_description:
        where.append("s.report_text IS NOT NULL AND LENGTH(s.report_text) > 100")

    if order in ("story_score", "content_potential"):
        joins.append("LEFT JOIN sighting_scores sc ON sc.sighting_id = s.sighting_id")

    from_clause = "FROM sightings s " + " ".join(joins)
    where_clause = ("WHERE " + " AND ".join(where)) if where else ""

    # Content potential: reweights story_score components for YouTube-worthy cases.
    # Heavily favors long narratives (material to script), high-strangeness signals,
    # multiple witnesses, corroborating evidence, and penalises explainable cases.
    content_potential_expr = """(
        CASE WHEN LENGTH(COALESCE(s.report_text,'')) >= 2000 THEN 30
             WHEN LENGTH(COALESCE(s.report_text,'')) >= 1000 THEN 24
             WHEN LENGTH(COALESCE(s.report_text,'')) >= 500  THEN 16
             WHEN LENGTH(COALESCE(s.report_text,'')) >= 200  THEN 8
             ELSE 2 END
      + CAST(MIN(COALESCE(sc.signal_density,0) * 1.5, 30) AS INTEGER)
      + CAST(COALESCE(sc.witness_strength,0) * 1.3 AS INTEGER)
      + MIN(COALESCE(sc.corroboration,0), 15)
      + COALESCE(sc.location_specificity, 0)
      + CAST(COALESCE(sc.media_mention,0) * 1.2 AS INTEGER)
      + COALESCE(sc.shape_rarity, 0)
      - CASE WHEN LOWER(COALESCE(s.report_text,'')) LIKE '%starlink%'
              OR LOWER(COALESCE(s.report_text,'')) LIKE '%balloon%'
              OR LOWER(COALESCE(s.report_text,'')) LIKE '%drone%'
              OR LOWER(COALESCE(s.report_text,'')) LIKE '%satellite%'
              OR LOWER(COALESCE(s.report_text,'')) LIKE '%rocket launch%'
              OR LOWER(COALESCE(s.report_text,'')) LIKE '%meteor%'
              OR LOWER(COALESCE(s.report_text,'')) LIKE '%fireball%'
         THEN 20 ELSE 0 END
    )"""

    if order == "random":
        order_clause = "ORDER BY RANDOM()"
    elif order == "oldest":
        order_clause = "ORDER BY s.date_time ASC NULLS LAST, s.sighting_id ASC"
    elif order == "story_score":
        order_clause = "ORDER BY COALESCE(sc.story_score, 0) DESC, s.sighting_id DESC"
    elif order == "content_potential":
        order_clause = f"ORDER BY {content_potential_expr} DESC, s.sighting_id DESC"
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
    sighting_ids = [int(row["sighting_id"]) for row in rows]
    evidence_count_map = fetch_evidence_count_map(db_path, sighting_ids)
    score_map = fetch_score_map(db_path, sighting_ids)
    bookmark_set = fetch_bookmark_set(db_path, sighting_ids)

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
                "story_score": score_map.get(int(row["sighting_id"]), {}).get("story_score", 0),
                "is_bookmarked": int(row["sighting_id"]) in bookmark_set,
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


def compare_cohorts(
    db_path: Path,
    enrichment_index: dict[int, list[dict[str, object]]],
    ai_cache: dict[str, dict[str, object]],
    payload: dict[str, object],
) -> dict[str, object]:
    from ..models import merge_filters, parse_filter_payload
    from ..scoring import top_signal_percentages
    from .cases import _serialize_case_row

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
