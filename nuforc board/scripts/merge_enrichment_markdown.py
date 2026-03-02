#!/usr/bin/env python3
"""Merge structured source rows from enrichment markdown into a research CSV."""

from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path
from urllib.parse import urlparse


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--markdown", required=True, help="Path to enrichment markdown file.")
    parser.add_argument("--input-csv", required=True, help="Existing research CSV.")
    parser.add_argument("--output-csv", required=True, help="Merged CSV output path.")
    return parser.parse_args()


def parse_references(markdown_text: str) -> dict[int, dict[str, str]]:
    refs: dict[int, dict[str, str]] = {}
    pattern = re.compile(r"^\s*(\d+)\.\s+\[(.*?)\]\((https?://[^)]+)\)")
    for line in markdown_text.splitlines():
        match = pattern.match(line)
        if not match:
            continue
        ref_id = int(match.group(1))
        refs[ref_id] = {
            "title": match.group(2).strip(),
            "url": match.group(3).strip(),
        }
    return refs


def make_publisher(url: str) -> str:
    host = urlparse(url).netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def expand_id_spec(spec: object) -> list[int]:
    if isinstance(spec, range):
        return list(spec)
    if isinstance(spec, int):
        return [spec]
    if isinstance(spec, list):
        out: list[int] = []
        for item in spec:
            out.extend(expand_id_spec(item))
        return out
    raise TypeError(f"Unsupported id spec: {spec!r}")


def build_rules() -> list[dict[str, object]]:
    return [
        {
            "ids": range(1, 11),
            "refs": [11, 12, 13],
            "supports": "contextual",
            "confidence": "0.60",
            "why": "Occurred during Project Blue Book era (1947-1969), giving historical USAF investigation context.",
            "notes": "Merged from UFO Sightings Enrichment.md: Project Blue Book section.",
        },
        {
            "ids": [18, 19],
            "refs": [6, 7],
            "supports": "contextual",
            "confidence": "0.70",
            "why": "Date/location align with the broader October 1973 UFO wave context.",
            "notes": "Merged from UFO Sightings Enrichment.md: 1973 UFO Wave section.",
        },
        {
            "ids": [40, 42],
            "refs": [3, 4],
            "supports": "supports",
            "confidence": "0.80",
            "why": "Matches the documented Hudson Valley wave geography and pattern descriptions.",
            "notes": "Merged from UFO Sightings Enrichment.md: Hudson Valley section.",
        },
        {
            "ids": [73, 74, 75, 76],
            "refs": [10],
            "supports": "contextual",
            "confidence": "0.55",
            "why": "Comet Hale-Bopp was still faintly visible in late 1997 and may have influenced skywatching/reporting.",
            "notes": "Merged from UFO Sightings Enrichment.md: Hale-Bopp context section.",
        },
        {
            "ids": [79],
            "refs": [1, 2],
            "supports": "contradicts",
            "confidence": "0.75",
            "why": "Timing is highly consistent with residual activity from the 1998 Draconid outburst.",
            "notes": "Merged from UFO Sightings Enrichment.md: Draconid outburst section.",
        },
        {
            "ids": [87],
            "refs": [1, 2],
            "supports": "contradicts",
            "confidence": "0.70",
            "why": "Fireball description and date are consistent with late-window Draconid activity.",
            "notes": "Merged from UFO Sightings Enrichment.md: Draconid outburst section.",
        },
        {
            "ids": [12, 23, 98],
            "refs": [1],
            "supports": "contradicts",
            "confidence": "0.60",
            "why": "Reported light/fireball timing fits annual Draconid meteor-shower window.",
            "notes": "Merged from UFO Sightings Enrichment.md: likely natural phenomena section.",
        },
        {
            "ids": [96],
            "refs": [8, 9],
            "supports": "contextual",
            "confidence": "0.65",
            "why": "Rachel, NV proximity to Area 51/Groom Lake provides strong military-testing context for light sightings.",
            "notes": "Merged from UFO Sightings Enrichment.md: Rachel/Area 51 section.",
        },
    ]


def main() -> int:
    args = parse_args()
    markdown_path = Path(args.markdown).expanduser().resolve()
    input_csv = Path(args.input_csv).expanduser().resolve()
    output_csv = Path(args.output_csv).expanduser().resolve()

    if not markdown_path.exists():
        raise SystemExit(f"Markdown file not found: {markdown_path}")
    if not input_csv.exists():
        raise SystemExit(f"Input CSV not found: {input_csv}")

    markdown_text = markdown_path.read_text(encoding="utf-8")
    refs = parse_references(markdown_text)

    with input_csv.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    if not fieldnames:
        raise SystemExit(f"No header found in input CSV: {input_csv}")

    required_fields = [
        "sighting_id",
        "source_url",
        "source_title",
        "publisher",
        "published_date",
        "why_relevant",
        "supports_or_contradicts",
        "confidence_0_to_1",
        "notes",
        "mirror_sighting_id",
    ]
    for field in required_fields:
        if field not in fieldnames:
            raise SystemExit(f"Missing expected field in input CSV: {field}")

    existing_keys = {
        (row.get("sighting_id", ""), row.get("source_url", ""))
        for row in rows
    }
    valid_ids = {row.get("sighting_id", "") for row in rows}

    additions: list[dict[str, str]] = []
    for rule in build_rules():
        ids = sorted(set(expand_id_spec(rule["ids"])))
        ref_ids = rule["refs"]  # type: ignore[assignment]
        for sid in ids:
            sid_str = str(sid)
            if sid_str not in valid_ids:
                continue
            for ref_id in ref_ids:
                ref = refs.get(int(ref_id))
                if not ref:
                    continue

                key = (sid_str, ref["url"])
                if key in existing_keys:
                    continue

                additions.append(
                    {
                        "sighting_id": sid_str,
                        "source_url": ref["url"],
                        "source_title": ref["title"],
                        "publisher": make_publisher(ref["url"]),
                        "published_date": "",
                        "why_relevant": str(rule["why"]),
                        "supports_or_contradicts": str(rule["supports"]),
                        "confidence_0_to_1": str(rule["confidence"]),
                        "notes": str(rule["notes"]),
                        "mirror_sighting_id": "",
                    }
                )
                existing_keys.add(key)

    merged_rows = rows + additions

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with output_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(merged_rows)

    print(f"Input rows:    {len(rows):,}")
    print(f"Added rows:    {len(additions):,}")
    print(f"Merged rows:   {len(merged_rows):,}")
    print(f"Output file:   {output_csv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
