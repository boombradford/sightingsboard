"""Sample generation and sample set management."""

from __future__ import annotations

import json
import random
import re
import sqlite3
import uuid
from pathlib import Path

from ..models import (
    build_constraints_where,
    build_filter_parts,
    clean_text,
    parse_bool,
    parse_constraints,
    parse_filter_payload,
    to_int,
    utc_now_iso,
)
from ..db import fetch_evidence_sighting_ids
from .cases import _serialize_case_row


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
