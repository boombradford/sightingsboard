"""AI brief generation (OpenAI + Anthropic Claude)."""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .models import clean_text, parse_json_maybe, utc_now_iso
from .queries.cases import get_case_payload


def generate_ai_case_brief(api_key: str, model: str, case_payload: dict[str, object]) -> dict[str, object]:
    system_prompt = (
        "You are a UFO case intelligence analyst. "
        "Given one sighting record and linked sources, output strict JSON only."
    )
    user_prompt = (
        "Produce this JSON object exactly with these keys:\n"
        "{\n"
        '  "case_summary": "2-4 sentence neutral summary",\n'
        '  "likely_explanations": [\n'
        '    {"label": "short label", "why": "one sentence", "confidence_0_to_1": 0.0}\n'
        "  ],\n"
        '  "research_leads": ["actionable lead 1", "actionable lead 2"],\n'
        '  "source_based_notes": ["key source-backed point 1", "key source-backed point 2"],\n'
        '  "overall_confidence_0_to_1": 0.0\n'
        "}\n\n"
        "Rules: remain evidence-based, do not invent named events, keep confidence calibrated.\n\n"
        f"Case JSON:\n{json.dumps(case_payload, ensure_ascii=True)}"
    )

    body = {
        "model": model,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    req = Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urlopen(req, timeout=90) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"OpenAI HTTP error {exc.code}: {detail[:400]}") from exc
    except URLError as exc:
        raise RuntimeError(f"OpenAI request failed: {exc}") from exc

    content = (
        payload.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )
    if not content:
        raise RuntimeError("OpenAI returned an empty completion.")
    return parse_json_maybe(content)


def generate_ai_case_brief_vnext(api_key: str, model: str, case_payload: dict[str, object]) -> dict[str, object]:
    system_prompt = (
        "You are a UFO case analyst. Return strict JSON only. "
        "Every claim must include supporting citations from provided fields or linked sources."
    )
    user_prompt = (
        "Return exactly this JSON shape:\n"
        "{\n"
        '  "summary": {\n'
        '    "synopsis_bullets": ["5-7 concise bullets"],\n'
        '    "witness_claims": ["short quoted snippets"],\n'
        '    "conventional_hypotheses": [\n'
        '      {"label":"hypothesis","why":"one sentence","confidence_0_to_1":0.0}\n'
        "    ]\n"
        "  },\n"
        '  "signals": [\n'
        '    {"key":"signal_key","label":"Signal Label","why":"short reason"}\n'
        "  ],\n"
        '  "citations": [\n'
        '    {"claim":"claim text","field_keys":["shape","duration"],"narrative_excerpt":"short quote","source_urls":["https://..."]}\n'
        "  ],\n"
        '  "overall_confidence_0_to_1": 0.0\n'
        "}\n\n"
        "Rules: no fabricated events, confidence calibrated, evidence-first.\n\n"
        f"Case JSON:\n{json.dumps(case_payload, ensure_ascii=True)}"
    )

    body = {
        "model": model,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    req = Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urlopen(req, timeout=90) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"OpenAI HTTP error {exc.code}: {detail[:400]}") from exc
    except URLError as exc:
        raise RuntimeError(f"OpenAI request failed: {exc}") from exc

    content = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not content:
        raise RuntimeError("OpenAI returned an empty completion.")
    parsed = parse_json_maybe(content)
    if "summary" not in parsed:
        parsed["summary"] = {
            "synopsis_bullets": [],
            "witness_claims": [],
            "conventional_hypotheses": [],
        }
    if "signals" not in parsed:
        parsed["signals"] = []
    if "citations" not in parsed:
        parsed["citations"] = []
    return parsed


def generate_claude_brief(api_key: str, model: str, case_payload: dict[str, object]) -> dict[str, object]:
    """Generate an AI case brief using the Anthropic Claude API."""
    try:
        import anthropic
    except ImportError:
        raise RuntimeError("anthropic package not installed. Run: pip install anthropic")

    system_prompt = (
        "You are a UFO case analyst. Return strict JSON only. "
        "Every claim must include supporting citations from provided fields or linked sources."
    )
    user_prompt = (
        "Return exactly this JSON shape:\n"
        "{\n"
        '  "summary": {\n'
        '    "synopsis_bullets": ["5-7 concise bullets"],\n'
        '    "witness_claims": ["short quoted snippets"],\n'
        '    "conventional_hypotheses": [\n'
        '      {"label":"hypothesis","why":"one sentence","confidence_0_to_1":0.0}\n'
        "    ]\n"
        "  },\n"
        '  "signals": [\n'
        '    {"key":"signal_key","label":"Signal Label","why":"short reason"}\n'
        "  ],\n"
        '  "citations": [\n'
        '    {"claim":"claim text","field_keys":["shape","duration"],"narrative_excerpt":"short quote","source_urls":["https://..."]}\n'
        "  ],\n"
        '  "overall_confidence_0_to_1": 0.0\n'
        "}\n\n"
        "Rules: no fabricated events, confidence calibrated, evidence-first.\n\n"
        f"Case JSON:\n{json.dumps(case_payload, ensure_ascii=True)}"
    )

    client = anthropic.Anthropic(api_key=api_key)
    try:
        message = client.messages.create(
            model=model,
            max_tokens=2048,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
    except Exception as exc:
        raise RuntimeError(f"Claude API error: {exc}") from exc

    content = message.content[0].text if message.content else ""
    if not content:
        raise RuntimeError("Claude returned an empty response.")

    parsed = parse_json_maybe(content)
    if "summary" not in parsed:
        parsed["summary"] = {
            "synopsis_bullets": [],
            "witness_claims": [],
            "conventional_hypotheses": [],
        }
    if "signals" not in parsed:
        parsed["signals"] = []
    if "citations" not in parsed:
        parsed["citations"] = []
    return parsed


def batch_generate_briefs(
    db_path: Path,
    enrichment_index: dict[int, list[dict[str, object]]],
    count: int,
    min_score: int,
    model: str,
) -> None:
    """Generate AI briefs for top-scored unbriefed sightings using Claude."""
    import time as _time

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise SystemExit("ANTHROPIC_API_KEY environment variable is not set.")

    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT sc.sighting_id, sc.story_score
            FROM sighting_scores sc
            LEFT JOIN ai_brief_versions ab ON ab.sighting_id = sc.sighting_id
            WHERE sc.story_score >= ?
              AND ab.brief_id IS NULL
            ORDER BY sc.story_score DESC
            LIMIT ?
            """,
            (min_score, count),
        ).fetchall()

    if not rows:
        print(f"No unbriefed sightings with score >= {min_score}.", flush=True)
        return

    print(f"Generating briefs for {len(rows)} sightings (min_score={min_score}, model={model})...", flush=True)
    success = 0
    for i, row in enumerate(rows):
        sid = int(row["sighting_id"])
        score = int(row["story_score"])
        print(f"  [{i + 1}/{len(rows)}] Sighting #{sid} (score={score})...", end=" ", flush=True)
        try:
            case_payload = get_case_payload(db_path, enrichment_index, sid)
            if case_payload is None:
                print("NOT FOUND", flush=True)
                continue
            brief = generate_claude_brief(api_key, model, case_payload)
            citations = brief.get("citations") if isinstance(brief, dict) else []
            if not isinstance(citations, list):
                citations = []

            with sqlite3.connect(str(db_path)) as conn:
                next_version = int(
                    conn.execute(
                        "SELECT COALESCE(MAX(version_num), 0) + 1 FROM ai_brief_versions WHERE sighting_id = ?",
                        (sid,),
                    ).fetchone()[0]
                )
                conn.execute(
                    """
                    INSERT INTO ai_brief_versions(
                      sighting_id, version_num, generated_at, model_label, brief_json, citations_json, source_snapshot_json
                    ) VALUES(?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        sid,
                        next_version,
                        utc_now_iso(),
                        model,
                        json.dumps(brief, ensure_ascii=True),
                        json.dumps(citations, ensure_ascii=True),
                        json.dumps(case_payload.get("linked_sources", []), ensure_ascii=True),
                    ),
                )
                conn.commit()
            success += 1
            print("OK", flush=True)
        except Exception as exc:
            print(f"FAILED: {exc}", flush=True)

        if i < len(rows) - 1:
            _time.sleep(1)

    print(f"Done. Generated {success}/{len(rows)} briefs.", flush=True)


def backfill_scores(db_path: Path, enrichment_index: dict[int, list[dict[str, object]]]) -> None:
    """Compute story scores for all sightings. Pure heuristics, no AI."""
    from .scoring import compute_story_score

    print("Backfilling story scores...", flush=True)
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT sighting_id, date_time, city, state, shape, duration,
                   report_text, stats, city_latitude, city_longitude
            FROM sightings
            """
        ).fetchall()

    evidence_map: dict[int, int] = {}
    with sqlite3.connect(str(db_path)) as conn:
        for row in conn.execute("SELECT sighting_id, COUNT(*) AS c FROM evidence_links GROUP BY sighting_id"):
            evidence_map[int(row[0])] = int(row[1])

    now = utc_now_iso()
    batch: list[tuple] = []
    for i, row in enumerate(rows):
        sid = int(row["sighting_id"])
        evidence_count = evidence_map.get(sid, 0)
        enrichment_count = len(enrichment_index.get(sid, []))
        scores = compute_story_score(row, evidence_count, enrichment_count)
        batch.append((
            sid,
            scores["story_score"],
            scores["description_richness"],
            scores["signal_density"],
            scores["witness_strength"],
            scores["corroboration"],
            scores["location_specificity"],
            scores["media_mention"],
            scores["shape_rarity"],
            now,
        ))
        if (i + 1) % 10000 == 0:
            print(f"  Scored {i + 1:,} / {len(rows):,}...", flush=True)

    with sqlite3.connect(str(db_path)) as conn:
        conn.executemany(
            """
            INSERT OR REPLACE INTO sighting_scores(
              sighting_id, story_score, description_richness, signal_density,
              witness_strength, corroboration, location_specificity, media_mention,
              shape_rarity, computed_at
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            batch,
        )
        conn.commit()
    print(f"Done. Scored {len(batch):,} sightings.", flush=True)
