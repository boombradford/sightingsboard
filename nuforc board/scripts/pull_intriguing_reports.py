#!/usr/bin/env python3
"""Pull rich NUFORC reports from live index pages and rank the most intriguing sightings.

This script mirrors the traversal approach used in:
`nuforc_sightings_data/nuforc_reports/.../nuforc_report_spider.py`
but runs with only Python stdlib.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import socket
import sqlite3
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent

START_URL = "https://www.nuforc.org/ndx/?id=post"
BASE_URL = "https://www.nuforc.org"
DEFAULT_UA = "Mozilla/5.0 (compatible; nuforc-intriguing-puller/1.0)"
JINA_PREFIX = "https://r.jina.ai/http://"

TAG_RE = re.compile(r"<[^>]+>", flags=re.IGNORECASE)
ROW_RE = re.compile(r"<tr[^>]*>(.*?)</tr>", flags=re.IGNORECASE | re.DOTALL)
CELL_RE = re.compile(r"<td[^>]*>(.*?)</td>", flags=re.IGNORECASE | re.DOTALL)
HREF_RE = re.compile(r'href\s*=\s*["\']?([^"\'>\s]+)["\']?', flags=re.IGNORECASE)
DATE_LINK_RE = re.compile(
    r'<a[^>]+href\s*=\s*["\']?(?P<href>[^"\'>\s]+)["\']?[^>]*>(?P<date>\d{4}-\d{2}-\d{2})</a>',
    flags=re.IGNORECASE,
)
CONTENT_RE = re.compile(
    r'<div[^>]*class=["\'][^"\']*content-area[^"\']*["\'][^>]*>(.*?)</div>',
    flags=re.IGNORECASE | re.DOTALL,
)
MD_DATE_LINK_RE = re.compile(
    r"\|\s*\[(?P<date>\d{4}-\d{2}-\d{2})\]\((?P<href>https?://[^)]+)\)\s*\|",
    flags=re.IGNORECASE,
)
MD_LINK_RE = re.compile(r"\[[^\]]+\]\((https?://[^)]+)\)")
MD_FIELD_RE = re.compile(r"^\*\*(.+?):\*\*\s*(.+)$")
WORD_RE = re.compile(r"[A-Za-z0-9']+")
SPLIT_SENTENCE_RE = re.compile(r"[.!?]+")

FIELD_LABELS = {
    "occurred",
    "reported",
    "posted",
    "location",
    "location details",
    "shape",
    "duration",
    "no of observers",
    "date",
    "time",
    "color",
    "estimated size",
    "viewed from",
    "direction from viewer",
    "angle of elevation",
    "closest distance",
    "estimated speed",
    "characteristics",
    "media",
    "explanation",
}
TIMEZONE_TOKENS = {
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


@dataclass
class ReportRow:
    date_time: str | None
    report_link: str | None
    city: str | None
    state: str | None
    country: str | None
    shape: str | None
    summary: str | None
    posted: str | None


@dataclass
class IntriguingReport:
    date_index: str
    source_date_page: str
    date_time: str | None
    city: str | None
    state: str | None
    country: str | None
    shape: str | None
    summary: str | None
    posted: str | None
    duration: str | None
    report_link: str
    report_text: str
    metadata: dict[str, str]
    score: float
    word_count: int
    char_count: int
    sentence_count: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--start-url",
        default=START_URL,
        help="NUFORC index URL to crawl from.",
    )
    parser.add_argument(
        "--from-date",
        dest="from_date",
        help="Only include index pages on/after this date (YYYY-MM-DD).",
    )
    parser.add_argument(
        "--to-date",
        dest="to_date",
        help="Only include index pages on/before this date (YYYY-MM-DD).",
    )
    parser.add_argument(
        "--max-date-pages",
        type=int,
        default=10,
        help="Maximum index date pages to crawl (default: 10).",
    )
    parser.add_argument(
        "--max-reports",
        type=int,
        default=250,
        help="Maximum report pages to fetch (default: 250).",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.7,
        help="Delay in seconds between report requests (default: 0.7).",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=20.0,
        help="HTTP timeout seconds (default: 20).",
    )
    parser.add_argument(
        "--min-words",
        type=int,
        default=80,
        help="Minimum extracted words for a report to qualify as intriguing.",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=100,
        help="How many top results to emit after ranking.",
    )
    parser.add_argument(
        "--format",
        choices=["text", "csv", "jsonl"],
        default="text",
        help="Output format for top results.",
    )
    parser.add_argument(
        "--out",
        help="Optional output file path. If omitted, writes to stdout.",
    )
    parser.add_argument(
        "--db",
        help="Optional SQLite DB path. If set, qualifying reports are upserted into sightings.",
    )
    parser.add_argument(
        "--user-agent",
        default=DEFAULT_UA,
        help="HTTP User-Agent string.",
    )
    parser.add_argument(
        "--no-jina",
        action="store_true",
        help="Disable fallback through r.jina.ai for pages blocked by Cloudflare.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print crawl progress.",
    )
    parser.add_argument(
        "--full-text",
        action="store_true",
        help="In text output, print full report text (not truncated).",
    )
    parser.add_argument(
        "--text-chars",
        type=int,
        default=1200,
        help="In text output, max report characters shown when --full-text is not set (default: 1200).",
    )
    return parser.parse_args()


def parse_iso_date(value: str | None, label: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise SystemExit(f"Invalid {label}: {value!r}. Expected YYYY-MM-DD.") from exc


def normalize_datetime_text(value: str | None) -> str | None:
    raw = clean_text(value)
    if not raw:
        return None

    parts = raw.split()
    if parts and parts[-1].lower() in TIMEZONE_TOKENS:
        raw = " ".join(parts[:-1]).strip()
    if not raw:
        return None

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


def to_jina_url(url: str) -> str:
    if url.startswith("https://r.jina.ai/"):
        return url
    if url.startswith("https://"):
        return JINA_PREFIX + url.removeprefix("https://")
    if url.startswith("http://"):
        return JINA_PREFIX + url.removeprefix("http://")
    return JINA_PREFIX + url


def fetch_html(url: str, timeout: float, user_agent: str, *, allow_jina: bool) -> str | None:
    request = Request(url, headers={"User-Agent": user_agent})
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.read().decode("utf-8", errors="ignore")
    except (HTTPError, URLError, TimeoutError, socket.timeout):
        if not allow_jina:
            return None
    # Cloudflare frequently blocks direct access; jina proxy returns markdown snapshot.
    proxy_url = to_jina_url(url)
    proxy_request = Request(proxy_url, headers={"User-Agent": user_agent})
    try:
        with urlopen(proxy_request, timeout=timeout) as response:
            return response.read().decode("utf-8", errors="ignore")
    except (HTTPError, URLError, TimeoutError, socket.timeout):
        return None


def clean_text(value: str | None, *, collapse_whitespace: bool = True) -> str | None:
    if value is None:
        return None
    text = html.unescape(value).replace("\x00", "").strip()
    if not text:
        return None
    if collapse_whitespace:
        text = " ".join(text.split())
    return text


def html_fragment_to_text(fragment: str, *, collapse_whitespace: bool = True) -> str:
    text = re.sub(r"(?i)<br\s*/?>", "\n", fragment)
    text = re.sub(r"(?i)</(p|div|tr|li|ul|ol|table|h\d)\s*>", "\n", text)
    text = TAG_RE.sub(" ", text)
    text = html.unescape(text).replace("\x00", "")
    if collapse_whitespace:
        text = " ".join(text.split())
    return text.strip()


def parse_index_date_links(index_html: str, *, from_date: datetime | None, to_date: datetime | None) -> list[tuple[str, str]]:
    seen: set[str] = set()
    items: list[tuple[str, str]] = []

    def _add_match(page_date: str, href: str) -> None:
        if page_date in seen:
            return
        try:
            dt = datetime.strptime(page_date, "%Y-%m-%d")
        except ValueError:
            return
        if from_date and dt < from_date:
            return
        if to_date and dt > to_date:
            return
        seen.add(page_date)
        items.append((page_date, urljoin(BASE_URL, href)))

    for match in DATE_LINK_RE.finditer(index_html):
        _add_match(match.group("date"), match.group("href"))
    for match in MD_DATE_LINK_RE.finditer(index_html):
        _add_match(match.group("date"), match.group("href"))

    items.sort(key=lambda item: item[0], reverse=True)
    return items


def parse_report_row(row_html: str, page_url: str) -> ReportRow | None:
    cells = CELL_RE.findall(row_html)
    if len(cells) < 7:
        return None

    report_href_match = HREF_RE.search(cells[0] or "")
    report_href = report_href_match.group(1) if report_href_match else None
    report_link = urljoin(page_url, report_href) if report_href else None

    posted_candidates: list[str] = []
    if len(cells) > 7:
        posted_candidates.append(clean_text(html_fragment_to_text(cells[7])) or "")
    if len(cells) > 8:
        posted_candidates.append(clean_text(html_fragment_to_text(cells[8])) or "")
    posted = next((value for value in posted_candidates if _looks_date_like(value)), None)
    if posted is None:
        posted = next((value for value in posted_candidates if value), None)

    return ReportRow(
        date_time=clean_text(html_fragment_to_text(cells[1])),
        report_link=report_link,
        city=clean_text(html_fragment_to_text(cells[2])),
        state=clean_text(html_fragment_to_text(cells[3])),
        country=clean_text(html_fragment_to_text(cells[4])),
        shape=clean_text(html_fragment_to_text(cells[5])),
        summary=clean_text(html_fragment_to_text(cells[6])),
        posted=posted,
    )


def _looks_date_like(value: str | None) -> bool:
    text = clean_text(value)
    if not text:
        return False
    return bool(re.search(r"\d{1,4}[-/]\d{1,2}[-/]\d{1,4}", text))


def parse_date_page(date_page_html: str, page_url: str) -> list[ReportRow]:
    rows: list[ReportRow] = []
    for row_html in ROW_RE.findall(date_page_html):
        row = parse_report_row(row_html, page_url)
        if row and row.report_link:
            rows.append(row)
    if rows:
        return rows

    # Fallback parser for r.jina.ai markdown tables.
    for line in date_page_html.splitlines():
        stripped = line.strip()
        if not stripped.startswith("| [Open"):
            continue
        columns = [col.strip() for col in stripped.strip("|").split("|")]
        if len(columns) < 8:
            continue
        link_match = MD_LINK_RE.search(columns[0])
        report_link = link_match.group(1) if link_match else None
        if not report_link:
            continue
        row = ReportRow(
            date_time=clean_text(columns[1]),
            report_link=report_link,
            city=clean_text(columns[2]),
            state=clean_text(columns[3]),
            country=clean_text(columns[4]),
            shape=clean_text(columns[5]),
            summary=clean_text(columns[6]),
            posted=clean_text(columns[7]),
        )
        rows.append(row)
    return rows


def extract_content_fragment(report_html: str) -> str | None:
    match = CONTENT_RE.search(report_html)
    if match:
        return match.group(1)
    return None


def parse_report_text_and_metadata(report_html: str) -> tuple[str, dict[str, str]]:
    fragment = extract_content_fragment(report_html)
    if not fragment:
        # Fallback parser for r.jina.ai markdown export.
        metadata: dict[str, str] = {}
        detail_lines: list[str] = []
        for raw_line in report_html.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            if line.startswith(("Title:", "URL Source:", "Published Time:", "Markdown Content:")):
                continue
            if line.startswith("[Skip to content]"):
                continue
            if set(line) <= {"=", "-", "|", " "}:
                continue
            field_match = MD_FIELD_RE.match(line)
            if field_match:
                key = " ".join(field_match.group(1).lower().split())
                value = clean_text(strip_markdown(field_match.group(2)))
                if value:
                    metadata[key] = value
                continue
            if line.startswith("_Posted ") and line.endswith("_"):
                posted_value = clean_text(strip_markdown(line)).removeprefix("Posted ").strip()
                if posted_value:
                    metadata["posted"] = posted_value
                continue
            if line.startswith("*   [") or line.startswith("[Menu Close]"):
                continue
            cleaned_line = clean_text(strip_markdown(line))
            if cleaned_line:
                if re.match(r"^NUFORC UFO Sighting \d+$", cleaned_line):
                    continue
                detail_lines.append(cleaned_line)
        detail_text = clean_text(" ".join(detail_lines), collapse_whitespace=True) or ""
        return detail_text, metadata

    raw_lines = html_fragment_to_text(fragment, collapse_whitespace=False).splitlines()
    lines = [clean_text(line) for line in raw_lines]
    lines = [line for line in lines if line]

    metadata: dict[str, str] = {}
    detail_lines: list[str] = []

    for line in lines:
        if ":" in line:
            key, value = line.split(":", 1)
            key_norm = " ".join(key.lower().split())
            if key_norm in FIELD_LABELS:
                clean_value = clean_text(value)
                if clean_value:
                    metadata[key_norm] = clean_value
                continue
        if re.match(r"^NUFORC UFO Sighting \d+$", line):
            continue
        detail_lines.append(line)

    detail_text = clean_text(" ".join(detail_lines), collapse_whitespace=True) or ""
    if not detail_text:
        detail_text = clean_text(html_fragment_to_text(fragment), collapse_whitespace=True) or ""

    return detail_text, metadata


def strip_markdown(value: str) -> str:
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", value)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = text.replace("**", "").replace("__", "").replace("*", "").replace("_", "")
    text = text.replace("`", "")
    return text


def compute_detail_score(text: str, metadata_count: int) -> tuple[float, int, int, int]:
    words = WORD_RE.findall(text.lower())
    word_count = len(words)
    chars = len(text)
    sentence_chunks = [
        chunk.strip()
        for chunk in SPLIT_SENTENCE_RE.split(text)
        if len(WORD_RE.findall(chunk)) >= 3
    ]
    sentence_count = len(sentence_chunks) if sentence_chunks else (1 if word_count else 0)
    lexical_ratio = (len(set(words)) / word_count) if word_count else 0.0

    score = (
        (word_count * 2.2)
        + (min(chars, 2000) * 0.04)
        + (sentence_count * 1.8)
        + (lexical_ratio * 12.0)
        + (metadata_count * 1.5)
    )
    return round(score, 2), word_count, chars, sentence_count


def serialize_report(report: IntriguingReport) -> dict[str, object]:
    return {
        "date_index": report.date_index,
        "source_date_page": report.source_date_page,
        "date_time": report.date_time,
        "city": report.city,
        "state": report.state,
        "country": report.country,
        "shape": report.shape,
        "summary": report.summary,
        "posted": report.posted,
        "duration": report.duration,
        "report_link": report.report_link,
        "report_text": report.report_text,
        "word_count": report.word_count,
        "char_count": report.char_count,
        "sentence_count": report.sentence_count,
        "detail_score": report.score,
        "metadata": report.metadata,
    }


def render_text(items: list[IntriguingReport], *, full_text: bool, text_chars: int) -> str:
    ordered_fields = [
        "location",
        "location details",
        "no of observers",
        "duration",
        "color",
        "estimated size",
        "viewed from",
        "direction from viewer",
        "angle of elevation",
        "closest distance",
        "estimated speed",
        "characteristics",
        "explanation",
        "media",
    ]

    lines: list[str] = []
    for idx, item in enumerate(items, start=1):
        occurred_value = clean_text(item.metadata.get("occurred")) or item.date_time
        reported_value = clean_text(item.metadata.get("reported")) or item.posted
        shape_value = clean_text(item.metadata.get("shape")) or item.shape or "unknown"
        summary = clean_text(item.summary or "", collapse_whitespace=True) or ""
        if summary and not full_text and len(summary) > 300:
            summary = summary[:297] + "..."
        report_text = clean_text(item.report_text, collapse_whitespace=True) or ""
        snippet = report_text
        if not full_text and len(snippet) > text_chars:
            snippet = snippet[: max(0, text_chars - 3)] + "..."
        lines.append(
            f"[{idx}] {item.date_index} score={item.score} words={item.word_count} "
            f"sentences={item.sentence_count}"
        )
        lines.append(
            f"  place: {item.city or 'unknown-city'}, {item.state or '--'}, {item.country or '--'}"
        )
        lines.append(f"  shape: {shape_value}")
        if occurred_value:
            lines.append(f"  occurred: {occurred_value}")
        if reported_value:
            lines.append(f"  reported: {reported_value}")
        if summary:
            lines.append(f"  summary: {summary}")
        for field in ordered_fields:
            value = clean_text(item.metadata.get(field))
            if value:
                lines.append(f"  {field}: {value}")
        lines.append(f"  report: {snippet}")
        lines.append(f"  link: {item.report_link}")
        lines.append(f"  source_page: {item.source_date_page}")
        if idx < len(items):
            lines.append("")
    return "\n".join(lines)


def render_csv(items: list[IntriguingReport]) -> str:
    class _ListWriter(list[str]):
        def write(self, text: str) -> int:
            self.append(text)
            return len(text)

    fieldnames = [
        "date_index",
        "source_date_page",
        "date_time",
        "city",
        "state",
        "country",
        "shape",
        "summary",
        "posted",
        "duration",
        "report_link",
        "report_text",
        "word_count",
        "char_count",
        "sentence_count",
        "detail_score",
        "metadata",
    ]
    buf = _ListWriter()
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    for item in items:
        row = serialize_report(item)
        row["metadata"] = json.dumps(row["metadata"], ensure_ascii=True)
        writer.writerow(row)
    return "".join(buf)


def render_jsonl(items: list[IntriguingReport]) -> str:
    return "\n".join(json.dumps(serialize_report(item), ensure_ascii=True) for item in items)


def write_output(content: str, out_path: str | None) -> None:
    if out_path:
        target = Path(out_path).expanduser().resolve()
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content + ("" if content.endswith("\n") else "\n"), encoding="utf-8")
        print(f"Wrote output to {target}")
        return
    print(content)


def upsert_reports_to_db(db_path: Path, reports: Iterable[IntriguingReport]) -> int:
    conn = sqlite3.connect(str(db_path), timeout=30)
    try:
        cur = conn.cursor()
        now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds")
        upserted = 0
        for item in reports:
            stats_parts = [f"{k}={v}" for k, v in sorted(item.metadata.items())]
            stats = "; ".join(stats_parts) if stats_parts else None
            summary = item.summary or (item.report_text[:220] if item.report_text else None)
            cur.execute(
                """
                INSERT INTO sightings (
                    summary, city, state, date_time, shape, duration, stats,
                    report_link, report_text, posted, city_latitude, city_longitude,
                    source_format, ingested_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(report_link) DO UPDATE SET
                    summary=excluded.summary,
                    city=excluded.city,
                    state=excluded.state,
                    date_time=excluded.date_time,
                    shape=excluded.shape,
                    duration=excluded.duration,
                    stats=excluded.stats,
                    report_text=excluded.report_text,
                    posted=excluded.posted,
                    source_format=excluded.source_format,
                    ingested_at=excluded.ingested_at
                """,
                (
                    summary,
                    item.city,
                    item.state,
                    item.date_time,
                    item.shape,
                    item.duration,
                    stats,
                    item.report_link,
                    item.report_text,
                    item.posted,
                    None,
                    None,
                    "nuforc_live_scrape",
                    now_iso,
                ),
            )
            upserted += 1
        conn.commit()
        return upserted
    finally:
        conn.close()


def main() -> int:
    args = parse_args()
    from_date = parse_iso_date(args.from_date, "--from-date")
    to_date = parse_iso_date(args.to_date, "--to-date")
    if args.max_date_pages <= 0:
        raise SystemExit("--max-date-pages must be > 0")
    if args.max_reports <= 0:
        raise SystemExit("--max-reports must be > 0")
    if args.min_words <= 0:
        raise SystemExit("--min-words must be > 0")
    if args.top <= 0:
        raise SystemExit("--top must be > 0")
    if args.delay < 0:
        raise SystemExit("--delay must be >= 0")
    if args.text_chars <= 0:
        raise SystemExit("--text-chars must be > 0")

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
    scanned_reports = 0
    failed_reports = 0
    crawled_nonempty_date_pages = 0
    visited_date_pages = 0

    for date_index, date_url in date_links:
        if crawled_nonempty_date_pages >= args.max_date_pages:
            break
        if scanned_reports >= args.max_reports:
            break
        visited_date_pages += 1

        page_html = fetch_html(
            date_url,
            args.timeout,
            args.user_agent,
            allow_jina=not args.no_jina,
        )
        if not page_html:
            if args.verbose:
                print(f"Skip date page (fetch failed): {date_url}")
            continue

        rows = parse_date_page(page_html, date_url)
        if args.verbose:
            print(f"{date_index}: {len(rows)} rows")
        if not rows:
            continue
        crawled_nonempty_date_pages += 1

        for row in rows:
            if scanned_reports >= args.max_reports:
                break
            if not row.report_link:
                continue

            scanned_reports += 1
            report_html = fetch_html(
                row.report_link,
                args.timeout,
                args.user_agent,
                allow_jina=not args.no_jina,
            )
            if not report_html:
                failed_reports += 1
                continue

            report_text, metadata = parse_report_text_and_metadata(report_html)
            score, words, chars, sentences = compute_detail_score(report_text, len(metadata))

            if words < args.min_words:
                if args.delay:
                    time.sleep(args.delay)
                continue

            duration = metadata.get("duration")
            normalized_date_time = normalize_datetime_text(metadata.get("occurred") or row.date_time)
            normalized_posted = normalize_datetime_text(
                metadata.get("reported") or metadata.get("posted") or row.posted
            )
            intriguing_case = IntriguingReport(
                date_index=date_index,
                source_date_page=date_url,
                date_time=normalized_date_time or row.date_time,
                city=row.city,
                state=row.state,
                country=row.country,
                shape=row.shape,
                summary=row.summary,
                posted=normalized_posted or row.posted or metadata.get("posted"),
                duration=duration,
                report_link=row.report_link,
                report_text=report_text,
                metadata=metadata,
                score=score,
                word_count=words,
                char_count=chars,
                sentence_count=sentences,
            )
            collected.append(intriguing_case)
            if args.delay:
                time.sleep(args.delay)

    if not collected:
        print(
            f"No intriguing reports found. scanned={scanned_reports}, failed={failed_reports}, "
            f"min_words={args.min_words}"
        )
        return 0

    collected.sort(
        key=lambda item: (item.score, item.word_count, item.sentence_count, item.char_count),
        reverse=True,
    )
    top_items = collected[: args.top]

    if args.db:
        db_path = Path(args.db).expanduser().resolve()
        if not db_path.exists():
            raise SystemExit(f"DB file not found: {db_path}")
        upserted = upsert_reports_to_db(db_path, collected)
        print(f"Upserted {upserted} qualifying reports into {db_path}")

    if args.format == "csv":
        rendered = render_csv(top_items)
    elif args.format == "jsonl":
        rendered = render_jsonl(top_items)
    else:
        rendered = render_text(top_items, full_text=args.full_text, text_chars=args.text_chars)

    write_output(rendered, args.out)
    print(
        f"Crawl summary: visited_pages={visited_date_pages}, nonempty_pages={crawled_nonempty_date_pages}, "
        f"scanned={scanned_reports}, failed={failed_reports}, qualified={len(collected)}, returned={len(top_items)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
