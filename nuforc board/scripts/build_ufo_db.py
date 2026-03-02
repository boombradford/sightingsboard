#!/usr/bin/env python3
"""Build a local SQLite database from NUFORC processed CSV or raw JSONL data."""

from __future__ import annotations

import argparse
import csv
import html
import json
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        default="nuforc_sightings_data/data/processed/nuforc_reports.csv",
        help="Path to NUFORC processed CSV or raw JSONL input file.",
    )
    parser.add_argument(
        "--format",
        default="auto",
        choices=["auto", "csv", "jsonl", "planetsig"],
        help="Input format. Defaults to file-extension auto-detection.",
    )
    parser.add_argument(
        "--db",
        default="ufo_sightings.db",
        help="Output SQLite database path.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=2000,
        help="Batch size for inserts.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional max rows to ingest (useful for quick tests).",
    )
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="Drop/recreate schema before loading.",
    )
    return parser.parse_args()


def detect_format(input_path: Path, provided: str) -> str:
    if provided != "auto":
        return provided

    suffix = input_path.suffix.lower()
    if suffix == ".csv":
        return "csv"
    if suffix in {".jsonl", ".json"}:
        return "jsonl"
    raise ValueError(
        f"Could not infer format from extension '{suffix}'. Set --format explicitly."
    )


def clean_text(value: str | None, *, collapse_whitespace: bool = True) -> str | None:
    if value is None:
        return None
    text = html.unescape(str(value))
    text = text.replace("\x00", "")
    text = text.strip()
    if not text:
        return None
    if collapse_whitespace:
        text = " ".join(text.split())
    return text


def clean_state(value: str | None) -> str | None:
    state = clean_text(value)
    if state is None:
        return None
    state = state.upper()
    if state in {"--", "NA", "N/A", "NONE", "UNKNOWN", "UNK", "?"}:
        return None
    return state


def parse_datetime(value: str | None) -> str | None:
    if value is None:
        return None
    raw = value.strip()
    if not raw:
        return None

    timezone_tokens = {
        "local",
        "pacific",
        "eastern",
        "central",
        "mountain",
        "utc",
        "pst",
        "est",
        "cst",
        "mst",
        "pdt",
        "edt",
        "cdt",
        "mdt",
    }
    parts = raw.split()
    if parts and parts[-1].lower() in timezone_tokens:
        raw = " ".join(parts[:-1]).strip()

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
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
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


def parse_location(location: str | None) -> tuple[str | None, str | None]:
    if not location:
        return None, None
    parts = [part.strip() for part in location.split(",")]
    city = parts[0] if parts else None
    state = parts[1] if len(parts) >= 2 else None
    return city or None, state or None


def summarize_text(text: str | None) -> str | None:
    text = clean_text(text)
    if not text:
        return None
    return text if len(text) <= 220 else text[:217] + "..."


def get_value(row: dict[str, str], *keys: str) -> str | None:
    lowered = {str(k).strip().lower(): v for k, v in row.items() if k is not None}
    for key in keys:
        value = lowered.get(key.lower())
        if value is not None and str(value).strip() != "":
            return str(value).strip()
    return None


def parse_float(value: str | None) -> float | None:
    if value is None:
        return None
    value = str(value).strip()
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def normalize_row(row: dict[str, str], source_format: str, ingested_at: str) -> tuple:
    summary = clean_text(row.get("summary"))
    city = clean_text(row.get("city"))
    state = clean_state(row.get("state"))
    date_time = parse_datetime(clean_text(row.get("date_time")))
    shape = clean_text(row.get("shape"))
    duration = clean_text(row.get("duration"))
    stats = clean_text(row.get("stats"))
    report_link = clean_text(row.get("report_link"))
    report_text = clean_text(row.get("text"), collapse_whitespace=False)
    posted = parse_datetime(clean_text(row.get("posted")))
    return (
        summary,
        city,
        state,
        date_time,
        shape,
        duration,
        stats,
        report_link,
        report_text,
        posted,
        parse_float(row.get("city_latitude")),
        parse_float(row.get("city_longitude")),
        source_format,
        ingested_at,
    )


def map_generic_csv_row(row: dict[str, str]) -> dict[str, str]:
    city = get_value(row, "city")
    state = get_value(row, "state")

    if not city or not state:
        parsed_city, parsed_state = parse_location(get_value(row, "location"))
        city = city or parsed_city
        state = state or parsed_state

    text = get_value(row, "text", "report", "description")
    summary = get_value(row, "summary") or summarize_text(text)

    return {
        "summary": summary,
        "city": city,
        "state": state,
        "date_time": get_value(row, "date_time", "occurred", "datetime"),
        "shape": get_value(row, "shape"),
        "duration": get_value(row, "duration"),
        "stats": get_value(row, "stats", "characteristics", "no of observers"),
        "report_link": get_value(row, "report_link", "link", "url"),
        "text": text,
        "posted": get_value(row, "posted", "reported"),
        "city_latitude": get_value(row, "city_latitude", "latitude", "lat"),
        "city_longitude": get_value(row, "city_longitude", "longitude", "lon", "lng"),
    }


def iter_generic_csv_rows(path: Path) -> Iterable[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            yield map_generic_csv_row(row)


def iter_planetsig_rows(path: Path) -> Iterable[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        for row in reader:
            if not row:
                continue
            if row[0].strip().lower() in {"datetime", "date_time", "occurred"}:
                continue
            if len(row) < 8:
                continue

            text = row[7].strip() if len(row) > 7 else None
            duration_seconds = row[5].strip() if len(row) > 5 else ""
            country = row[3].strip() if len(row) > 3 else ""
            stats_parts = []
            if country:
                stats_parts.append(f"country={country}")
            if duration_seconds:
                stats_parts.append(f"duration_seconds={duration_seconds}")

            yield {
                "summary": summarize_text(text),
                "city": row[1].strip() if len(row) > 1 else None,
                "state": row[2].strip() if len(row) > 2 else None,
                "date_time": row[0].strip() if len(row) > 0 else None,
                "shape": row[4].strip() if len(row) > 4 else None,
                "duration": row[6].strip() if len(row) > 6 else None,
                "stats": "; ".join(stats_parts) if stats_parts else None,
                "report_link": None,
                "text": text,
                "posted": row[8].strip() if len(row) > 8 else None,
                "city_latitude": row[9].strip() if len(row) > 9 else None,
                "city_longitude": row[10].strip() if len(row) > 10 else None,
            }


def iter_jsonl_rows(path: Path) -> Iterable[dict[str, str]]:
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            yield {
                "summary": row.get("summary"),
                "city": row.get("city"),
                "state": row.get("state"),
                "date_time": row.get("date_time"),
                "shape": row.get("shape"),
                "duration": row.get("duration"),
                "stats": row.get("stats"),
                "report_link": row.get("report_link"),
                "text": row.get("text"),
                "posted": row.get("posted"),
                "city_latitude": row.get("city_latitude"),
                "city_longitude": row.get("city_longitude"),
            }


def detect_csv_mode(path: Path) -> str:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        first_row = next(reader, [])
    if not first_row:
        return "csv"

    lowered = {cell.strip().lower() for cell in first_row}
    likely_header = bool(
        lowered
        & {
            "summary",
            "city",
            "state",
            "shape",
            "occurred",
            "sighting",
            "date_time",
            "report",
        }
    )
    if likely_header:
        return "csv"

    # Planetsig rows are typically 10-11 columns and start with a date/time value.
    first_cell = first_row[0].strip()
    looks_like_datetime = (
        ("/" in first_cell and ":" in first_cell)
        or ("-" in first_cell and ":" in first_cell)
        or ("/" in first_cell and len(first_cell) >= 8)
    )
    if len(first_row) >= 10 and looks_like_datetime:
        return "planetsig"
    return "csv"


def prepare_row_iter(path: Path, source_format: str) -> tuple[Iterable[dict[str, str]], str]:
    if source_format == "jsonl":
        return iter_jsonl_rows(path), "jsonl"
    if source_format == "planetsig":
        return iter_planetsig_rows(path), "planetsig"

    csv_mode = detect_csv_mode(path)
    if csv_mode == "planetsig":
        return iter_planetsig_rows(path), "planetsig"
    return iter_generic_csv_rows(path), "csv"


def create_schema(conn: sqlite3.Connection, rebuild: bool) -> None:
    cur = conn.cursor()
    if rebuild:
        cur.execute("DROP TABLE IF EXISTS sightings")
        cur.execute("DROP TABLE IF EXISTS ingestion_runs")
        cur.execute("DROP TABLE IF EXISTS sightings_fts")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS sightings (
            sighting_id INTEGER PRIMARY KEY AUTOINCREMENT,
            summary TEXT,
            city TEXT,
            state TEXT,
            date_time TEXT,
            shape TEXT,
            duration TEXT,
            stats TEXT,
            report_link TEXT UNIQUE,
            report_text TEXT,
            posted TEXT,
            city_latitude REAL,
            city_longitude REAL,
            source_format TEXT NOT NULL,
            ingested_at TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS ingestion_runs (
            run_id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_path TEXT NOT NULL,
            source_format TEXT NOT NULL,
            started_at TEXT NOT NULL,
            finished_at TEXT,
            rows_read INTEGER NOT NULL DEFAULT 0,
            rows_inserted INTEGER NOT NULL DEFAULT 0
        )
        """
    )

    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_sightings_date_time ON sightings(date_time)"
    )
    cur.execute("CREATE INDEX IF NOT EXISTS idx_sightings_posted ON sightings(posted)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_sightings_shape ON sightings(shape)")
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_sightings_state_city ON sightings(state, city)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_sightings_report_link ON sightings(report_link)"
    )
    conn.commit()


def rebuild_fts(conn: sqlite3.Connection) -> bool:
    cur = conn.cursor()
    cur.execute("DROP TABLE IF EXISTS sightings_fts")

    try:
        cur.execute(
            """
            CREATE VIRTUAL TABLE sightings_fts USING fts5(
                summary,
                report_text,
                content='sightings',
                content_rowid='sighting_id'
            )
            """
        )
    except sqlite3.OperationalError:
        conn.commit()
        return False

    cur.execute(
        """
        INSERT INTO sightings_fts(rowid, summary, report_text)
        SELECT sighting_id, summary, report_text FROM sightings
        """
    )
    conn.commit()
    return True


def insert_run(
    conn: sqlite3.Connection, source_path: str, source_format: str, started_at: str
) -> int:
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO ingestion_runs (source_path, source_format, started_at)
        VALUES (?, ?, ?)
        """,
        (source_path, source_format, started_at),
    )
    conn.commit()
    return int(cur.lastrowid)


def finish_run(
    conn: sqlite3.Connection, run_id: int, finished_at: str, rows_read: int, rows_inserted: int
) -> None:
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE ingestion_runs
        SET finished_at = ?, rows_read = ?, rows_inserted = ?
        WHERE run_id = ?
        """,
        (finished_at, rows_read, rows_inserted, run_id),
    )
    conn.commit()


def main() -> int:
    args = parse_args()
    input_path = Path(args.input).expanduser().resolve()
    db_path = Path(args.db).expanduser().resolve()

    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")

    source_format = detect_format(input_path, args.format)
    row_iter, detected_format = prepare_row_iter(input_path, source_format)

    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA temp_store = MEMORY")
    conn.execute("PRAGMA foreign_keys = ON")

    create_schema(conn, rebuild=args.rebuild)

    started_at = datetime.now(timezone.utc).isoformat()
    run_id = insert_run(conn, str(input_path), detected_format, started_at)

    insert_sql = """
        INSERT OR IGNORE INTO sightings (
            summary, city, state, date_time, shape, duration, stats, report_link,
            report_text, posted, city_latitude, city_longitude, source_format, ingested_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    rows_read = 0
    rows_inserted = 0
    batch: list[tuple] = []
    ingested_at = datetime.now(timezone.utc).isoformat()
    prior_changes = conn.total_changes

    for row in row_iter:
        rows_read += 1
        batch.append(normalize_row(row, detected_format, ingested_at))

        if args.limit is not None and rows_read >= args.limit:
            break

        if len(batch) >= args.batch_size:
            conn.executemany(insert_sql, batch)
            rows_inserted += conn.total_changes - prior_changes
            prior_changes = conn.total_changes
            batch.clear()

    if batch:
        conn.executemany(insert_sql, batch)
        rows_inserted += conn.total_changes - prior_changes

    conn.commit()
    fts_enabled = rebuild_fts(conn)

    finished_at = datetime.now(timezone.utc).isoformat()
    finish_run(conn, run_id, finished_at, rows_read, rows_inserted)
    conn.close()

    print(f"Database: {db_path}")
    print(f"Source:   {input_path} ({detected_format})")
    print(f"Read:     {rows_read:,}")
    print(f"Inserted: {rows_inserted:,}")
    print(f"FTS5:     {'enabled' if fts_enabled else 'not available in this SQLite build'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
