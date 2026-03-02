#!/usr/bin/env python3
"""Build sourced enrichment rows for a sighting-id range using a public NUFORC mirror."""

from __future__ import annotations

import argparse
import csv
from collections import defaultdict, deque
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input-csv",
        default=str(ROOT / "exports/ai_prompt_pack_20260227T100043Z/sightings_dates_locations_crafts.csv"),
        help="Input sightings CSV (with sighting_id/date/city/state/craft).",
    )
    parser.add_argument(
        "--mirror-csv",
        default=str(ROOT / "data/nuforc_str.csv"),
        help="NUFORC mirror CSV with detailed fields.",
    )
    parser.add_argument("--start-id", type=int, required=True, help="Start sighting_id.")
    parser.add_argument("--end-id", type=int, required=True, help="End sighting_id (inclusive).")
    parser.add_argument("--out", required=True, help="Output enrichment CSV path.")
    return parser.parse_args()


def norm(value: str | None) -> str:
    return " ".join((value or "").strip().lower().split())


def key_from_local(row: dict[str, str]) -> tuple[str, str, str, str]:
    return (
        (row.get("sighting_date") or "").split("T")[0].strip(),
        norm(row.get("city")),
        norm(row.get("state")),
        norm(row.get("craft")),
    )


def parse_occ_date(occurred: str | None) -> str:
    return (occurred or "").strip()[:10]


def parse_location(location: str | None) -> tuple[str, str]:
    parts = [p.strip().lower() for p in (location or "").split(",")]
    city = parts[0] if parts else ""
    state = ""
    if len(parts) > 1 and len(parts[1]) <= 4:
        state = parts[1]
    return city, state


def key_from_mirror(row: dict[str, str]) -> tuple[str, str, str, str]:
    city, state = parse_location(row.get("Location"))
    return (
        parse_occ_date(row.get("Occurred")),
        city,
        state,
        norm(row.get("Shape")),
    )


def csv_escape(value: str | None) -> str:
    return (value or "").strip()


def build_notes(match: dict[str, str]) -> str:
    parts: list[str] = []
    for label, field in [
        ("duration", "Duration"),
        ("observers", "No of observers"),
        ("reported", "Reported"),
        ("posted", "Posted"),
        ("characteristics", "Characteristics"),
        ("location_details", "Location details"),
        ("explanation", "Explanation"),
    ]:
        value = csv_escape(match.get(field))
        if value:
            parts.append(f"{label}={value}")
    return "; ".join(parts)


def main() -> int:
    args = parse_args()
    input_csv = Path(args.input_csv).expanduser().resolve()
    mirror_csv = Path(args.mirror_csv).expanduser().resolve()
    out_csv = Path(args.out).expanduser().resolve()

    if args.end_id < args.start_id:
        raise SystemExit("--end-id must be >= --start-id")
    if not input_csv.exists():
        raise SystemExit(f"Input CSV not found: {input_csv}")
    if not mirror_csv.exists():
        raise SystemExit(f"Mirror CSV not found: {mirror_csv}")

    local_rows_by_id: dict[int, dict[str, str]] = {}
    key_to_ids: dict[tuple[str, str, str, str], deque[int]] = defaultdict(deque)
    with input_csv.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            sid = int(row["sighting_id"])
            if args.start_id <= sid <= args.end_id:
                local_rows_by_id[sid] = row
                key_to_ids[key_from_local(row)].append(sid)
            if sid > args.end_id:
                break

    matches: dict[int, dict[str, str]] = {}
    with mirror_csv.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            key = key_from_mirror(row)
            pending_ids = key_to_ids.get(key)
            if not pending_ids:
                continue
            sid = pending_ids.popleft()
            matches[sid] = row
            if len(matches) == len(local_rows_by_id):
                break

    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with out_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
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
            ],
        )
        writer.writeheader()

        for sid in range(args.start_id, args.end_id + 1):
            local_row = local_rows_by_id.get(sid)
            if local_row is None:
                continue

            match = matches.get(sid)
            if not match:
                writer.writerow(
                    {
                        "sighting_id": sid,
                        "source_url": "",
                        "source_title": "No source match found in mirror",
                        "publisher": "",
                        "published_date": "",
                        "why_relevant": "No direct match by date/city/state/shape in mirror dataset.",
                        "supports_or_contradicts": "unknown",
                        "confidence_0_to_1": "0.00",
                        "notes": "",
                        "mirror_sighting_id": "",
                    }
                )
                continue

            mirror_id = csv_escape(match.get("Sighting"))
            posted = csv_escape(match.get("Posted"))
            occured = csv_escape(match.get("Occurred"))
            city = csv_escape(local_row.get("city"))
            state = csv_escape(local_row.get("state"))
            craft = csv_escape(local_row.get("craft"))

            writer.writerow(
                {
                    "sighting_id": sid,
                    "source_url": "https://huggingface.co/datasets/kcimc/NUFORC",
                    "source_title": f"NUFORC mirror row (Sighting ID {mirror_id})",
                    "publisher": "Hugging Face dataset: kcimc/NUFORC",
                    "published_date": posted or "",
                    "why_relevant": (
                        f"Direct row match for {occured} {city}, {state} ({craft}); "
                        "adds observers, characteristics, and posting metadata."
                    ),
                    "supports_or_contradicts": "supports",
                    "confidence_0_to_1": "0.95",
                    "notes": build_notes(match),
                    "mirror_sighting_id": mirror_id,
                }
            )

            writer.writerow(
                {
                    "sighting_id": sid,
                    "source_url": f"https://nuforc.org/sighting/?id={mirror_id}",
                    "source_title": f"NUFORC canonical report page ({mirror_id})",
                    "publisher": "National UFO Reporting Center",
                    "published_date": posted or "",
                    "why_relevant": "Canonical case page URL for this matched NUFORC sighting id.",
                    "supports_or_contradicts": "supports",
                    "confidence_0_to_1": "0.80",
                    "notes": (
                        "URL derived from matched NUFORC sighting id in mirror dataset; "
                        "site may apply anti-bot controls for scripted access."
                    ),
                    "mirror_sighting_id": mirror_id,
                }
            )

    found = len(matches)
    wanted = len(local_rows_by_id)
    print(f"Wrote:   {out_csv}")
    print(f"Matched: {found}/{wanted}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
