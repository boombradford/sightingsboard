#!/usr/bin/env python3
"""Find the most detailed UFO sightings from the local SQLite database."""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

WORD_RE = re.compile(r"[A-Za-z0-9']+")
SENTENCE_RE = re.compile(r"[.!?]+")
UNKNOWN_VALUES = {"", "--", "unknown", "n/a", "na", "none", "nil", "unk", "?"}


@dataclass
class ScoredReport:
    row: sqlite3.Row
    narrative: str
    score: float
    words: int
    chars: int
    sentences: int
    metadata_points: float
    lexical_ratio: float


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default="ufo_sightings.db", help="SQLite database path.")
    parser.add_argument("--state", help="2-letter state filter, e.g. CA.")
    parser.add_argument("--shape", help="Object shape filter, e.g. triangle.")
    parser.add_argument("--from-date", dest="from_date", help="Lower date_time bound (ISO 8601).")
    parser.add_argument("--to-date", dest="to_date", help="Upper date_time bound (ISO 8601).")
    parser.add_argument("--keyword", help="Keyword search against summary/report text (FTS5).")
    parser.add_argument("--limit", type=int, default=20, help="Max rows returned.")
    parser.add_argument("--offset", type=int, default=0, help="Rows to skip after ranking.")
    parser.add_argument(
        "--order",
        choices=["detail", "recent", "random"],
        default="detail",
        help="Result ordering after scoring (default: detail).",
    )
    parser.add_argument("--min-score", type=float, help="Only keep rows scoring at least this value.")
    parser.add_argument("--min-words", type=int, help="Only keep rows with at least this many words.")
    parser.add_argument(
        "--max-scan",
        type=int,
        default=0,
        help="Optional cap on rows scanned for ranking (0 = scan all matches).",
    )
    parser.add_argument(
        "--format",
        choices=["text", "jsonl", "csv"],
        default="text",
        help="Output format (default: text).",
    )
    parser.add_argument(
        "--out",
        help="Optional output path. If omitted, writes to stdout.",
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


def normalize_for_presence(value: str | None) -> str:
    text = clean_text(value)
    if not text:
        return ""
    return text.lower()


def has_meaningful_value(value: str | None) -> bool:
    normalized = normalize_for_presence(value)
    return normalized not in UNKNOWN_VALUES


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


def pick_narrative(row: sqlite3.Row) -> str:
    summary = clean_text(row["summary"]) or ""
    report_text = clean_text(row["report_text"]) or ""
    if len(report_text) >= len(summary):
        return report_text
    return summary


def score_report(row: sqlite3.Row) -> ScoredReport:
    narrative = pick_narrative(row)
    words = WORD_RE.findall(narrative.lower())
    word_count = len(words)
    unique_words = len(set(words))
    lexical_ratio = (unique_words / word_count) if word_count else 0.0
    sentence_chunks = [
        chunk.strip()
        for chunk in SENTENCE_RE.split(narrative)
        if len(WORD_RE.findall(chunk)) >= 3
    ]
    sentences = len(sentence_chunks)
    if word_count > 0 and sentences == 0:
        sentences = 1
    chars = len(narrative)

    metadata_points = 0.0
    if has_meaningful_value(row["duration"]):
        metadata_points += 3.0
    if has_meaningful_value(row["stats"]):
        metadata_points += 4.0
    if has_meaningful_value(row["posted"]):
        metadata_points += 1.0
    if row["city_latitude"] is not None and row["city_longitude"] is not None:
        metadata_points += 1.0
    if has_meaningful_value(row["report_link"]):
        metadata_points += 1.0
    if has_meaningful_value(row["summary"]) and has_meaningful_value(row["report_text"]):
        if clean_text(row["summary"]) != clean_text(row["report_text"]):
            metadata_points += 1.0

    # Weighted blend:
    # - narrative size and sentence structure
    # - lexical diversity (more varied vocabulary)
    # - supporting metadata completeness
    score = (
        (word_count * 2.0)
        + (min(chars, 450) * 0.05)
        + (sentences * 2.0)
        + (lexical_ratio * 10.0)
        + metadata_points
    )

    return ScoredReport(
        row=row,
        narrative=narrative,
        score=round(score, 2),
        words=word_count,
        chars=chars,
        sentences=sentences,
        metadata_points=round(metadata_points, 2),
        lexical_ratio=round(lexical_ratio, 3),
    )


def build_query(args: argparse.Namespace) -> tuple[str, list[object]]:
    joins = []
    where = []
    params: list[object] = []

    if args.keyword:
        joins.append("JOIN sightings_fts ON sightings_fts.rowid = s.sighting_id")
        where.append("sightings_fts MATCH ?")
        params.append(args.keyword)
    if args.state:
        where.append("UPPER(s.state) = UPPER(?)")
        params.append(args.state)
    if args.shape:
        where.append("LOWER(s.shape) = LOWER(?)")
        params.append(args.shape)
    if args.from_date:
        where.append("s.date_time >= ?")
        params.append(args.from_date)
    if args.to_date:
        where.append("s.date_time <= ?")
        params.append(args.to_date)

    sql = [
        "SELECT s.sighting_id, s.date_time, s.city, s.state, s.shape,",
        "       s.summary, s.report_text, s.duration, s.stats, s.report_link,",
        "       s.posted, s.city_latitude, s.city_longitude",
        "FROM sightings s",
    ]
    sql.extend(joins)
    if where:
        sql.append("WHERE " + " AND ".join(where))

    if args.order == "recent":
        sql.append("ORDER BY s.date_time DESC NULLS LAST, s.sighting_id DESC")
    elif args.order == "random":
        sql.append("ORDER BY RANDOM()")
    else:
        # For detail mode we still pre-sort by newest to break ties predictably.
        sql.append("ORDER BY s.date_time DESC NULLS LAST, s.sighting_id DESC")

    if args.max_scan and args.max_scan > 0:
        sql.append("LIMIT ?")
        params.append(args.max_scan)

    return "\n".join(sql), params


def get_top_reports(conn: sqlite3.Connection, args: argparse.Namespace) -> list[ScoredReport]:
    sql, params = build_query(args)
    rows = conn.execute(sql, params).fetchall()

    scored: list[ScoredReport] = []
    for row in rows:
        scored_row = score_report(row)
        if args.min_words is not None and scored_row.words < args.min_words:
            continue
        if args.min_score is not None and scored_row.score < args.min_score:
            continue
        scored.append(scored_row)

    if args.order == "detail":
        scored.sort(
            key=lambda item: (
                item.score,
                item.words,
                item.sentences,
                item.chars,
                item.row["date_time"] or "",
            ),
            reverse=True,
        )
    elif args.order == "recent":
        scored.sort(
            key=lambda item: (
                item.row["date_time"] or "",
                item.score,
            ),
            reverse=True,
        )

    if args.offset:
        scored = scored[args.offset :]
    if args.limit is not None and args.limit >= 0:
        scored = scored[: args.limit]
    return scored


def serialize_entry(item: ScoredReport) -> dict[str, object]:
    row = item.row
    return {
        "sighting_id": row["sighting_id"],
        "date_time": normalize_date_for_display(row["date_time"]),
        "city": clean_text(row["city"]) or "unknown-city",
        "state": normalize_state(row["state"]),
        "shape": clean_text(row["shape"]) or "unknown-shape",
        "detail_score": item.score,
        "word_count": item.words,
        "char_count": item.chars,
        "sentence_count": item.sentences,
        "metadata_points": item.metadata_points,
        "lexical_ratio": item.lexical_ratio,
        "duration": clean_text(row["duration"]),
        "stats": clean_text(row["stats"]),
        "summary": clean_text(row["summary"]),
        "report_text": clean_text(row["report_text"]),
        "report_link": clean_text(row["report_link"]),
    }


def write_text(items: list[ScoredReport]) -> str:
    lines: list[str] = []
    for item in items:
        row = item.row
        display_date = normalize_date_for_display(row["date_time"])
        display_city = clean_text(row["city"]) or "unknown-city"
        display_state = normalize_state(row["state"])
        display_shape = clean_text(row["shape"]) or "unknown-shape"
        summary = clean_text(row["summary"]) or ""
        if len(summary) > 220:
            summary = summary[:217] + "..."
        lines.append(
            f"[{row['sighting_id']}] score={item.score} "
            f"(words={item.words}, sentences={item.sentences}, metadata={item.metadata_points})"
        )
        lines.append(f"  {display_date} {display_city}, {display_state} | {display_shape}")
        lines.append(f"  {summary}")
        if has_meaningful_value(row["duration"]):
            lines.append(f"  duration: {clean_text(row['duration'])}")
        if has_meaningful_value(row["stats"]):
            lines.append(f"  stats: {clean_text(row['stats'])}")
        link = clean_text(row["report_link"])
        if link:
            lines.append(f"  {link}")
    return "\n".join(lines)


def write_jsonl(items: list[ScoredReport]) -> str:
    return "\n".join(json.dumps(serialize_entry(item), ensure_ascii=True) for item in items)


class _ListWriter(list[str]):
    def write(self, text: str) -> int:
        self.append(text)
        return len(text)


def render_output(items: list[ScoredReport], fmt: str) -> str:
    if fmt == "jsonl":
        return write_jsonl(items)
    if fmt == "csv":
        buffer = _ListWriter()
        writer = csv.DictWriter(
            buffer,
            fieldnames=[
                "sighting_id",
                "date_time",
                "city",
                "state",
                "shape",
                "detail_score",
                "word_count",
                "char_count",
                "sentence_count",
                "metadata_points",
                "lexical_ratio",
                "duration",
                "stats",
                "summary",
                "report_text",
                "report_link",
            ],
        )
        writer.writeheader()
        for item in items:
            writer.writerow(serialize_entry(item))
        return "".join(buffer)
    return write_text(items)


def main() -> int:
    args = parse_args()
    db_path = Path(args.db).expanduser().resolve()
    if not db_path.exists():
        raise SystemExit(f"Database not found: {db_path}")
    if args.limit < 0:
        raise SystemExit("--limit must be >= 0")
    if args.offset < 0:
        raise SystemExit("--offset must be >= 0")
    if args.max_scan < 0:
        raise SystemExit("--max-scan must be >= 0")

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    items = get_top_reports(conn, args)
    if not items:
        message = "No results."
        if args.out:
            Path(args.out).expanduser().resolve().write_text(message + "\n", encoding="utf-8")
        else:
            print(message)
        return 0

    rendered = render_output(items, args.format)
    if args.out:
        output_path = Path(args.out).expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(rendered + ("\n" if not rendered.endswith("\n") else ""), encoding="utf-8")
        print(f"Wrote {len(items)} rows to {output_path}")
    else:
        print(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
