#!/usr/bin/env python3
"""Refresh recent NUFORC sightings for one or more target states.

This script reuses the live crawl/parsing helpers from `pull_intriguing_reports.py`
but broadens the intake criteria so it can backfill normal recent sightings,
not just long-form "intriguing" ones.
"""

from __future__ import annotations

import argparse
import sqlite3
import time
from collections import Counter
from datetime import datetime
from pathlib import Path

from pull_intriguing_reports import (
    DEFAULT_UA,
    START_URL,
    IntriguingReport,
    compute_detail_score,
    fetch_html,
    normalize_datetime_text,
    parse_date_page,
    parse_index_date_links,
    parse_iso_date,
    parse_report_text_and_metadata,
    upsert_reports_to_db,
)

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB = ROOT / "ufo_sightings.db"

US_STATE_CODES = {
    "ALABAMA": "AL",
    "ALASKA": "AK",
    "ARIZONA": "AZ",
    "ARKANSAS": "AR",
    "CALIFORNIA": "CA",
    "COLORADO": "CO",
    "CONNECTICUT": "CT",
    "DELAWARE": "DE",
    "FLORIDA": "FL",
    "GEORGIA": "GA",
    "HAWAII": "HI",
    "IDAHO": "ID",
    "ILLINOIS": "IL",
    "INDIANA": "IN",
    "IOWA": "IA",
    "KANSAS": "KS",
    "KENTUCKY": "KY",
    "LOUISIANA": "LA",
    "MAINE": "ME",
    "MARYLAND": "MD",
    "MASSACHUSETTS": "MA",
    "MICHIGAN": "MI",
    "MINNESOTA": "MN",
    "MISSISSIPPI": "MS",
    "MISSOURI": "MO",
    "MONTANA": "MT",
    "NEBRASKA": "NE",
    "NEVADA": "NV",
    "NEWHAMPSHIRE": "NH",
    "NEWJERSEY": "NJ",
    "NEWMEXICO": "NM",
    "NEWYORK": "NY",
    "NORTHCAROLINA": "NC",
    "NORTHDAKOTA": "ND",
    "OHIO": "OH",
    "OKLAHOMA": "OK",
    "OREGON": "OR",
    "PENNSYLVANIA": "PA",
    "RHODEISLAND": "RI",
    "SOUTHCAROLINA": "SC",
    "SOUTHDAKOTA": "SD",
    "TENNESSEE": "TN",
    "TEXAS": "TX",
    "UTAH": "UT",
    "VERMONT": "VT",
    "VIRGINIA": "VA",
    "WASHINGTON": "WA",
    "WESTVIRGINIA": "WV",
    "WISCONSIN": "WI",
    "WYOMING": "WY",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--states",
        nargs="+",
        required=True,
        help="Target states to refresh. Accepts abbreviations or full names.",
    )
    parser.add_argument(
        "--from-date",
        default="2015-01-01",
        help="Only include sightings on/after this date (YYYY-MM-DD). Default: 2015-01-01.",
    )
    parser.add_argument(
        "--to-date",
        help="Only include sightings on/before this date (YYYY-MM-DD).",
    )
    parser.add_argument(
        "--db",
        default=str(DEFAULT_DB),
        help=f"SQLite database path. Default: {DEFAULT_DB}",
    )
    parser.add_argument(
        "--target-per-state",
        type=int,
        default=20,
        help="Stop early once this many qualifying rows have been collected per state. Default: 20.",
    )
    parser.add_argument(
        "--max-date-pages",
        type=int,
        default=320,
        help="Maximum date index pages to scan. Default: 320.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=15.0,
        help="HTTP timeout in seconds. Default: 15.",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.05,
        help="Delay in seconds between report requests. Default: 0.05.",
    )
    parser.add_argument(
        "--min-words",
        type=int,
        default=1,
        help="Minimum parsed report word count. Default: 1.",
    )
    parser.add_argument(
        "--start-url",
        default=START_URL,
        help="NUFORC index URL to crawl from.",
    )
    parser.add_argument(
        "--user-agent",
        default=DEFAULT_UA,
        help="HTTP User-Agent string.",
    )
    parser.add_argument(
        "--no-jina",
        action="store_true",
        help="Disable fallback through r.jina.ai for blocked pages.",
    )
    parser.add_argument(
        "--skip-fts-rebuild",
        action="store_true",
        help="Skip rebuilding the `sightings_fts` index after import.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print progress while crawling.",
    )
    return parser.parse_args()


def normalize_state_code(value: str | None) -> str | None:
    if not value:
        return None
    compact = "".join(ch for ch in value.upper().strip() if ch.isalpha())
    if len(compact) == 2:
        return compact
    return US_STATE_CODES.get(compact)


def extract_year(value: str | None) -> int | None:
    if not value:
        return None
    text = value.strip()
    if len(text) >= 4 and text[:4].isdigit():
        return int(text[:4])
    return None


def rebuild_fts(db_path: Path) -> None:
    with sqlite3.connect(str(db_path), timeout=30) as conn:
        conn.execute("INSERT INTO sightings_fts(sightings_fts) VALUES('rebuild')")
        conn.commit()


def collect_reports(args: argparse.Namespace, target_states: set[str]) -> tuple[list[IntriguingReport], Counter[str], dict[str, int]]:
    from_date = parse_iso_date(args.from_date, "--from-date")
    to_date = parse_iso_date(args.to_date, "--to-date")

    index_html = fetch_html(
        args.start_url,
        args.timeout,
        args.user_agent,
        allow_jina=not args.no_jina,
    )
    if not index_html:
        raise SystemExit(f"Failed to fetch index URL: {args.start_url}")

    date_links = parse_index_date_links(index_html, from_date=from_date, to_date=to_date)
    if not date_links:
        raise SystemExit("No date index links matched the requested range.")

    collected: list[IntriguingReport] = []
    counts: Counter[str] = Counter()
    stats = {
        "visited_date_pages": 0,
        "rows_seen": 0,
        "report_fetches": 0,
        "failed_reports": 0,
    }
    seen_links: set[str] = set()

    for date_index, date_url in date_links:
        if stats["visited_date_pages"] >= args.max_date_pages:
            break
        if all(counts[state] >= args.target_per_state for state in target_states):
            if args.verbose:
                print(f"Stopping early after reaching targets: {dict(counts)}")
            break

        stats["visited_date_pages"] += 1
        page_html = fetch_html(
            date_url,
            args.timeout,
            args.user_agent,
            allow_jina=not args.no_jina,
        )
        if not page_html:
            continue

        rows = parse_date_page(page_html, date_url)
        if not rows:
            continue

        for row in rows:
            stats["rows_seen"] += 1
            state_code = normalize_state_code(row.state)
            if state_code not in target_states:
                continue

            normalized_date_time = normalize_datetime_text(row.date_time)
            occurred_value = normalized_date_time or row.date_time
            year = extract_year(occurred_value)
            if year is None:
                continue
            if from_date and occurred_value and occurred_value < from_date.isoformat(timespec="seconds"):
                continue
            if to_date and occurred_value and occurred_value > to_date.isoformat(timespec="seconds"):
                continue
            if year < 1900:
                continue

            if not row.report_link or row.report_link in seen_links:
                continue
            seen_links.add(row.report_link)

            stats["report_fetches"] += 1
            report_html = fetch_html(
                row.report_link,
                args.timeout,
                args.user_agent,
                allow_jina=not args.no_jina,
            )
            if not report_html:
                stats["failed_reports"] += 1
                continue

            report_text, metadata = parse_report_text_and_metadata(report_html)
            score, word_count, char_count, sentence_count = compute_detail_score(report_text, len(metadata))
            if word_count < args.min_words:
                continue

            normalized_posted = normalize_datetime_text(
                metadata.get("reported") or metadata.get("posted") or row.posted
            )
            collected.append(
                IntriguingReport(
                    date_index=date_index,
                    source_date_page=date_url,
                    date_time=occurred_value,
                    city=row.city,
                    state=state_code,
                    country=row.country,
                    shape=row.shape,
                    summary=row.summary,
                    posted=normalized_posted or row.posted,
                    duration=metadata.get("duration"),
                    report_link=row.report_link,
                    report_text=report_text,
                    metadata=metadata,
                    score=score,
                    word_count=word_count,
                    char_count=char_count,
                    sentence_count=sentence_count,
                )
            )
            counts[state_code] += 1

            if args.delay:
                time.sleep(args.delay)

        if args.verbose and stats["visited_date_pages"] % 20 == 0:
            print(
                "Progress:",
                {
                    "visited_date_pages": stats["visited_date_pages"],
                    "rows_seen": stats["rows_seen"],
                    "collected": len(collected),
                    "counts": dict(counts),
                },
            )

    return collected, counts, stats


def main() -> int:
    args = parse_args()
    if args.target_per_state <= 0:
        raise SystemExit("--target-per-state must be > 0")
    if args.max_date_pages <= 0:
        raise SystemExit("--max-date-pages must be > 0")
    if args.min_words <= 0:
        raise SystemExit("--min-words must be > 0")
    if args.delay < 0:
        raise SystemExit("--delay must be >= 0")

    target_states = {code for code in (normalize_state_code(value) for value in args.states) if code}
    if not target_states:
        raise SystemExit("No valid state codes were provided.")

    db_path = Path(args.db).expanduser().resolve()
    if not db_path.exists():
        raise SystemExit(f"DB file not found: {db_path}")

    print(f"Refreshing states: {', '.join(sorted(target_states))}")
    print(f"Using database: {db_path}")
    print(f"From date: {args.from_date}")
    if args.to_date:
        print(f"To date: {args.to_date}")

    collected, counts, stats = collect_reports(args, target_states)
    if not collected:
        print("No matching reports were collected.")
        return 0

    upserted = upsert_reports_to_db(db_path, collected)
    print(f"Collected {len(collected)} qualifying reports")
    print(f"Upserted {upserted} reports into {db_path}")

    if not args.skip_fts_rebuild:
        rebuild_fts(db_path)
        print("Rebuilt sightings_fts")

    print("Summary:")
    print(f"  visited_date_pages={stats['visited_date_pages']}")
    print(f"  rows_seen={stats['rows_seen']}")
    print(f"  report_fetches={stats['report_fetches']}")
    print(f"  failed_reports={stats['failed_reports']}")
    for state in sorted(target_states):
        print(f"  {state}={counts[state]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
