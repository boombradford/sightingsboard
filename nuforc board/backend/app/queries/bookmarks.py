"""Bookmark and collection CRUD operations."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from ..models import clean_text, normalize_date, normalize_state, to_int, utc_now_iso


def list_bookmarks(db_path: Path, status: str | None = None) -> list[dict[str, object]]:
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        if status:
            rows = conn.execute(
                """
                SELECT b.bookmark_id, b.sighting_id, b.notes, b.status, b.created_at,
                       s.date_time, s.city, s.state, s.shape, s.duration, s.summary,
                       s.report_text, s.stats, s.report_link, s.city_latitude, s.city_longitude
                FROM bookmarks b
                JOIN sightings s ON s.sighting_id = b.sighting_id
                WHERE b.status = ?
                ORDER BY b.created_at DESC
                """,
                (status,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT b.bookmark_id, b.sighting_id, b.notes, b.status, b.created_at,
                       s.date_time, s.city, s.state, s.shape, s.duration, s.summary,
                       s.report_text, s.stats, s.report_link, s.city_latitude, s.city_longitude
                FROM bookmarks b
                JOIN sightings s ON s.sighting_id = b.sighting_id
                ORDER BY b.created_at DESC
                """,
            ).fetchall()
    out = []
    for row in rows:
        out.append({
            "bookmark_id": row["bookmark_id"],
            "sighting_id": row["sighting_id"],
            "notes": row["notes"],
            "status": row["status"],
            "created_at": row["created_at"],
            "date_time": normalize_date(row["date_time"]),
            "city": clean_text(row["city"]) or "unknown-city",
            "state": normalize_state(row["state"]) or "--",
            "shape": clean_text(row["shape"]) or "unknown-shape",
            "duration": clean_text(row["duration"]) or "",
            "summary": clean_text(row["summary"]) or "",
        })
    return out


def create_bookmark(db_path: Path, payload: dict[str, object]) -> dict[str, object]:
    try:
        sighting_id = int(payload.get("sighting_id"))
    except (TypeError, ValueError):
        raise ValueError("sighting_id is required")
    notes = clean_text(payload.get("notes")) if isinstance(payload, dict) else None
    status = (clean_text(payload.get("status")) or "new").lower()
    if status not in {"new", "scripted", "filmed", "published"}:
        status = "new"
    created_at = utc_now_iso()
    with sqlite3.connect(str(db_path)) as conn:
        conn.execute(
            "INSERT OR REPLACE INTO bookmarks(sighting_id, notes, status, created_at) VALUES(?, ?, ?, ?)",
            (sighting_id, notes, status, created_at),
        )
        conn.commit()
    return {"sighting_id": sighting_id, "notes": notes, "status": status, "created_at": created_at}


def update_bookmark(db_path: Path, sighting_id: int, payload: dict[str, object]) -> dict[str, object] | None:
    fields: list[str] = []
    params: list[object] = []
    if "notes" in payload:
        fields.append("notes = ?")
        params.append(clean_text(payload.get("notes")))
    if "status" in payload:
        status = (clean_text(payload.get("status")) or "new").lower()
        if status not in {"new", "scripted", "filmed", "published"}:
            raise ValueError("status must be new, scripted, filmed, or published")
        fields.append("status = ?")
        params.append(status)
    if not fields:
        raise ValueError("No updatable fields provided")
    with sqlite3.connect(str(db_path)) as conn:
        conn.execute(f"UPDATE bookmarks SET {', '.join(fields)} WHERE sighting_id = ?", params + [sighting_id])
        conn.commit()
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM bookmarks WHERE sighting_id = ?", (sighting_id,)).fetchone()
    return dict(row) if row else None


def delete_bookmark(db_path: Path, sighting_id: int) -> bool:
    with sqlite3.connect(str(db_path)) as conn:
        cur = conn.execute("DELETE FROM bookmarks WHERE sighting_id = ?", (sighting_id,))
        conn.commit()
    return cur.rowcount > 0


def list_collections(db_path: Path) -> list[dict[str, object]]:
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT c.collection_id, c.name, c.description, c.created_at,
                   COUNT(ci.sighting_id) AS item_count
            FROM collections c
            LEFT JOIN collection_items ci ON ci.collection_id = c.collection_id
            GROUP BY c.collection_id
            ORDER BY c.created_at DESC
            """,
        ).fetchall()
    return [dict(row) for row in rows]


def create_collection(db_path: Path, payload: dict[str, object]) -> dict[str, object]:
    name = clean_text(payload.get("name")) if isinstance(payload, dict) else None
    if not name:
        raise ValueError("name is required")
    description = clean_text(payload.get("description")) if isinstance(payload, dict) else None
    created_at = utc_now_iso()
    with sqlite3.connect(str(db_path)) as conn:
        cur = conn.execute(
            "INSERT INTO collections(name, description, created_at) VALUES(?, ?, ?)",
            (name, description, created_at),
        )
        conn.commit()
    return {"collection_id": cur.lastrowid, "name": name, "description": description, "created_at": created_at}


def list_collection_items(db_path: Path, collection_id: int) -> list[dict[str, object]]:
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT ci.sort_order, s.sighting_id, s.date_time, s.city, s.state, s.shape,
                   s.duration, s.summary, s.report_text, s.stats
            FROM collection_items ci
            JOIN sightings s ON s.sighting_id = ci.sighting_id
            WHERE ci.collection_id = ?
            ORDER BY ci.sort_order ASC
            """,
            (collection_id,),
        ).fetchall()
    out = []
    for row in rows:
        out.append({
            "sighting_id": row["sighting_id"],
            "sort_order": row["sort_order"],
            "date_time": normalize_date(row["date_time"]),
            "city": clean_text(row["city"]) or "unknown-city",
            "state": normalize_state(row["state"]) or "--",
            "shape": clean_text(row["shape"]) or "unknown-shape",
            "duration": clean_text(row["duration"]) or "",
            "summary": clean_text(row["summary"]) or "",
        })
    return out


def add_collection_item(db_path: Path, collection_id: int, payload: dict[str, object]) -> dict[str, object]:
    try:
        sighting_id = int(payload.get("sighting_id"))
    except (TypeError, ValueError):
        raise ValueError("sighting_id is required")
    sort_order = to_int(str(payload.get("sort_order", 0)), default=0, minimum=0, maximum=99999)
    with sqlite3.connect(str(db_path)) as conn:
        conn.execute(
            "INSERT OR REPLACE INTO collection_items(collection_id, sighting_id, sort_order) VALUES(?, ?, ?)",
            (collection_id, sighting_id, sort_order),
        )
        conn.commit()
    return {"collection_id": collection_id, "sighting_id": sighting_id, "sort_order": sort_order}


def delete_collection_item(db_path: Path, collection_id: int, sighting_id: int) -> bool:
    with sqlite3.connect(str(db_path)) as conn:
        cur = conn.execute(
            "DELETE FROM collection_items WHERE collection_id = ? AND sighting_id = ?",
            (collection_id, sighting_id),
        )
        conn.commit()
    return cur.rowcount > 0
