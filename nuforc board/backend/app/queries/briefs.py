"""Brief version CRUD operations."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from ..models import clean_text, utc_now_iso
from .cases import get_case_payload


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
    from ..ai import generate_ai_case_brief_vnext

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
