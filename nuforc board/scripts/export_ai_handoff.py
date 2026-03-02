#!/usr/bin/env python3
"""Export UFO sightings into AI-friendly handoff files for downstream enrichment."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--db",
        default=str(ROOT_DIR / "ufo_sightings.db"),
        help="Path to SQLite database.",
    )
    parser.add_argument(
        "--out-dir",
        default=str(ROOT_DIR / "exports"),
        help="Output directory for handoff bundle.",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=1000,
        help="Rows per chunk file for research queue.",
    )
    return parser.parse_args()


def compute_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def sanitize_text(value: str | None) -> str | None:
    if value is None:
        return None
    value = " ".join(str(value).replace("\x00", "").split())
    return value if value else None


def build_research_queries(row: sqlite3.Row) -> list[str]:
    q: list[str] = []
    city = sanitize_text(row["city"]) or "unknown city"
    state = sanitize_text(row["state"]) or "unknown state"
    shape = sanitize_text(row["shape"]) or "ufo"
    date_time = sanitize_text(row["date_time"]) or "unknown date"
    summary = sanitize_text(row["summary"]) or ""

    q.append(f'"{city}" "{state}" ufo sighting "{date_time[:10]}"')
    q.append(f'"{city}" "{state}" "{shape}" sighting')
    if summary:
        q.append(f'ufo report "{summary[:120]}"')
    return q


def write_jsonl(path: Path, rows: list[dict[str, object]]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=True) + "\n")


def main() -> int:
    args = parse_args()
    db_path = Path(args.db).expanduser().resolve()
    out_root = Path(args.out_dir).expanduser().resolve()

    if not db_path.exists():
        raise SystemExit(f"Database not found: {db_path}")

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    bundle_dir = out_root / f"ai_handoff_{ts}"
    chunks_dir = bundle_dir / "chunks"
    bundle_dir.mkdir(parents=True, exist_ok=True)
    chunks_dir.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT
                sighting_id,
                date_time,
                city,
                state,
                shape,
                duration,
                summary,
                report_text,
                report_link,
                posted,
                city_latitude,
                city_longitude,
                source_format,
                ingested_at
            FROM sightings
            ORDER BY sighting_id ASC
            """
        ).fetchall()

    master_csv = bundle_dir / "sightings_master.csv"
    master_jsonl = bundle_dir / "sightings_master.jsonl"
    queue_jsonl = bundle_dir / "research_queue.jsonl"
    template_csv = bundle_dir / "enrichment_template.csv"
    prompt_md = bundle_dir / "research_prompt.md"
    manifest_json = bundle_dir / "manifest.json"

    fieldnames = [
        "sighting_id",
        "date_time",
        "city",
        "state",
        "shape",
        "duration",
        "summary",
        "report_text",
        "report_link",
        "posted",
        "city_latitude",
        "city_longitude",
        "source_format",
        "ingested_at",
    ]

    with master_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row[k] for k in fieldnames})

    with master_jsonl.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(
                json.dumps({k: row[k] for k in fieldnames}, ensure_ascii=True) + "\n"
            )

    queue_rows: list[dict[str, object]] = []
    for row in rows:
        queue_rows.append(
            {
                "sighting_id": row["sighting_id"],
                "date_time": sanitize_text(row["date_time"]),
                "city": sanitize_text(row["city"]),
                "state": sanitize_text(row["state"]),
                "shape": sanitize_text(row["shape"]),
                "summary": sanitize_text(row["summary"]),
                "report_text_excerpt": (sanitize_text(row["report_text"]) or "")[:1200],
                "original_report_link": sanitize_text(row["report_link"]),
                "posted": sanitize_text(row["posted"]),
                "lat": row["city_latitude"],
                "lon": row["city_longitude"],
                "research_queries": build_research_queries(row),
                "enrichment": {
                    "status": "pending",
                    "sources": [],
                    "confidence": None,
                    "notes": "",
                },
            }
        )

    write_jsonl(queue_jsonl, queue_rows)

    chunk_size = max(1, args.chunk_size)
    for i in range(0, len(queue_rows), chunk_size):
        chunk = queue_rows[i : i + chunk_size]
        chunk_id = i // chunk_size + 1
        chunk_path = chunks_dir / f"research_queue_part_{chunk_id:03d}.jsonl"
        write_jsonl(chunk_path, chunk)

    with template_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "sighting_id",
                "research_status",
                "source_url",
                "source_title",
                "source_type",
                "publisher",
                "published_date",
                "retrieved_date",
                "credibility_score_0_to_1",
                "summary_of_source",
                "added_detail",
                "consistency_with_report",
                "confidence_0_to_1",
                "notes",
            ],
        )
        writer.writeheader()

    prompt_md.write_text(
        "\n".join(
            [
                "# Research Prompt For Another AI",
                "",
                "You are enriching UFO sighting records with sourced context.",
                "",
                "## Input files",
                "- `research_queue.jsonl` (or `chunks/research_queue_part_XXX.jsonl`)",
                "- `enrichment_template.csv`",
                "",
                "## Required behavior",
                "1. Process each sighting id independently.",
                "2. Find external sources (news archives, official weather/astronomy data, aviation records, local reports).",
                "3. Record every source URL and summarize what it adds.",
                "4. Mark confidence and whether external evidence supports/contradicts the report.",
                "5. Do not invent sources; if none are found, set status to `no_sources_found`.",
                "",
                "## Output",
                "- Fill rows in `enrichment_template.csv` with one row per source per sighting.",
                "- Keep `sighting_id` exactly as provided.",
            ]
        ),
        encoding="utf-8",
    )

    files = [master_csv, master_jsonl, queue_jsonl, template_csv, prompt_md]
    files.extend(sorted(chunks_dir.glob("*.jsonl")))

    manifest = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "database": str(db_path),
        "bundle_dir": str(bundle_dir),
        "total_rows": len(rows),
        "chunk_size": chunk_size,
        "file_hashes_sha256": {p.name: compute_sha256(p) for p in files},
    }
    manifest_json.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"Bundle: {bundle_dir}")
    print(f"Rows:   {len(rows):,}")
    print(f"Chunks: {len(list(chunks_dir.glob('*.jsonl'))):,}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
