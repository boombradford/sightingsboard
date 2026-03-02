#!/usr/bin/env python3
"""Query the local NUFORC SQLite database with basic filters."""

from __future__ import annotations

import argparse
import html
import re
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default="ufo_sightings.db", help="SQLite database path.")
    parser.add_argument("--state", help="2-letter state filter, e.g. CA.")
    parser.add_argument("--shape", help="Object shape filter, e.g. circle.")
    parser.add_argument("--from-date", dest="from_date", help="Lower date_time bound (ISO 8601).")
    parser.add_argument("--to-date", dest="to_date", help="Upper date_time bound (ISO 8601).")
    parser.add_argument("--keyword", help="Keyword search against summary/report text (FTS5).")
    parser.add_argument(
        "--order",
        choices=["recent", "oldest", "random"],
        default="recent",
        help="Result ordering strategy (default: recent).",
    )
    parser.add_argument("--limit", type=int, default=20, help="Max rows returned.")
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


def normalize_state(value: str | None) -> str:
    state = clean_text(value)
    if not state:
        return "--"
    state = state.upper()
    if state in {"--", "NA", "N/A", "NONE", "UNKNOWN", "UNK", "?"}:
        return "--"
    return state


def normalize_date_for_display(value: str | None) -> str:
    raw = clean_text(value)
    if not raw:
        return "unknown-date"

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
    tokens = re.findall(r"[0-9A-Za-z]+(?:['-][0-9A-Za-z]+)*", raw)
    if not tokens:
        return None
    return " AND ".join(f'"{token}"' for token in tokens[:12])


def normalize_to_date_upper_bound(value: str | None) -> tuple[str | None, bool]:
    raw = clean_text(value)
    if not raw:
        return None, False

    normalized = normalize_date_for_display(raw)
    if not normalized:
        return None, False

    date_only = len(raw) == 10 and raw[4] == "-" and raw[7] == "-" and raw.replace("-", "").isdigit()
    if date_only:
        try:
            return (datetime.fromisoformat(normalized) + timedelta(days=1)).isoformat(
                timespec="seconds"
            ), True
        except ValueError:
            return normalized, False
    return normalized, False


def main() -> int:
    args = parse_args()
    db_path = Path(args.db).expanduser().resolve()
    if not db_path.exists():
        raise SystemExit(f"Database not found: {db_path}")

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    joins = []
    where = []
    params: list[object] = []

    fts_keyword = normalize_fts_keyword(args.keyword)
    if args.keyword and not fts_keyword:
        print("No results.")
        return 0
    if fts_keyword:
        joins.append("JOIN sightings_fts ON sightings_fts.rowid = s.sighting_id")
        where.append("sightings_fts MATCH ?")
        params.append(fts_keyword)
    if args.state:
        where.append("UPPER(s.state) = UPPER(?)")
        params.append(args.state)
    if args.shape:
        where.append("LOWER(s.shape) = LOWER(?)")
        params.append(args.shape)
    if args.from_date:
        normalized_from = normalize_date_for_display(args.from_date)
        if normalized_from:
            where.append("s.date_time >= ?")
            params.append(normalized_from)
    if args.to_date:
        normalized_to, is_exclusive = normalize_to_date_upper_bound(args.to_date)
        if normalized_to:
            where.append("s.date_time < ?" if is_exclusive else "s.date_time <= ?")
            params.append(normalized_to)

    sql = [
        "SELECT s.sighting_id, s.date_time, s.city, s.state, s.shape, s.summary, s.report_link",
        "FROM sightings s",
    ]
    sql.extend(joins)
    if where:
        sql.append("WHERE " + " AND ".join(where))
    if args.order == "random":
        sql.append("ORDER BY RANDOM()")
    elif args.order == "oldest":
        sql.append("ORDER BY s.date_time ASC NULLS LAST, s.sighting_id ASC")
    else:
        sql.append("ORDER BY s.date_time DESC NULLS LAST, s.sighting_id DESC")
    sql.append("LIMIT ?")
    params.append(args.limit)

    rows = cur.execute("\n".join(sql), params).fetchall()
    if not rows:
        print("No results.")
        return 0

    for row in rows:
        summary = clean_text(row["summary"]) or ""
        if len(summary) > 140:
            summary = summary[:137] + "..."
        display_date = normalize_date_for_display(row["date_time"])
        display_city = clean_text(row["city"]) or "unknown-city"
        display_state = normalize_state(row["state"])
        display_shape = clean_text(row["shape"]) or "unknown-shape"
        print(
            f"[{row['sighting_id']}] {display_date} "
            f"{display_city}, {display_state} "
            f"| {display_shape}"
        )
        print(f"  {summary}")
        link = clean_text(row["report_link"])
        if link:
            print(f"  {link}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
