"""Evidence CRUD operations."""

from __future__ import annotations

import sqlite3
from pathlib import Path
from urllib.parse import urlparse

from ..models import clean_text, is_http_url, parse_bool, utc_now_iso


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
