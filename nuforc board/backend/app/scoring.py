"""Story scoring and signal analysis."""

from __future__ import annotations

import sqlite3

from .models import (
    SIGNAL_KEYS,
    clean_text,
    detect_explainable_case,
    extract_case_signals,
    has_media_marker,
    normalize_state,
    parse_observer_count,
)


TOP_3_SHAPES = {"light", "circle", "triangle"}


def top_signal_percentages(rows: list[sqlite3.Row], *, limit: int = 5) -> list[dict[str, object]]:
    if not rows:
        return []

    counts = {key: 0 for key in SIGNAL_KEYS}
    for row in rows:
        signals = extract_case_signals(row["shape"], row["stats"], row["report_text"])
        for key, active in signals.items():
            if active:
                counts[key] += 1

    total = len(rows)
    ranked = sorted(counts.items(), key=lambda item: item[1], reverse=True)
    out: list[dict[str, object]] = []
    for key, count in ranked[:limit]:
        if count <= 0:
            continue
        out.append({"key": key, "pct": round((count / total) * 100, 1), "count": count})
    return out


def compute_story_score(
    row: sqlite3.Row | dict[str, object],
    evidence_count: int = 0,
    enrichment_count: int = 0,
    context: dict[str, object] | None = None,
) -> dict[str, int]:
    """Compute a 0-100 content worthiness score for a sighting."""
    report_text = clean_text(
        row["report_text"] if isinstance(row, sqlite3.Row) else row.get("report_text"),
        collapse_whitespace=False,
    ) or ""
    stats_raw = clean_text(row["stats"] if isinstance(row, sqlite3.Row) else row.get("stats"))
    shape = clean_text(row["shape"] if isinstance(row, sqlite3.Row) else row.get("shape"))
    lat = row["city_latitude"] if isinstance(row, sqlite3.Row) else row.get("city_latitude")
    lon = row["city_longitude"] if isinstance(row, sqlite3.Row) else row.get("city_longitude")
    city = clean_text(row["city"] if isinstance(row, sqlite3.Row) else row.get("city"))
    state = normalize_state(row["state"] if isinstance(row, sqlite3.Row) else row.get("state"))

    text_len = len(report_text)
    if text_len == 0:
        description_richness = 0
    elif text_len < 100:
        description_richness = 5
    elif text_len < 500:
        description_richness = 12
    elif text_len < 1500:
        description_richness = 17
    else:
        description_richness = 20

    signals = extract_case_signals(shape, stats_raw, report_text)
    active_count = sum(1 for v in signals.values() if v)
    signal_density = min(20, active_count * 3)

    observers = parse_observer_count(stats_raw, report_text)
    if observers is None:
        witness_strength = 0
    elif observers >= 5:
        witness_strength = 15
    elif observers >= 2:
        witness_strength = 10
    else:
        witness_strength = 5

    corroboration = min(15, (evidence_count * 5) + (enrichment_count * 3))

    location_specificity = 0
    if lat is not None and lon is not None:
        location_specificity += 5
    if city:
        location_specificity += 3
    if state:
        location_specificity += 2

    media_mention = 10 if has_media_marker(stats_raw, report_text) else 0

    shape_norm = (shape or "").lower()
    shape_rarity = 5 if shape_norm and shape_norm not in TOP_3_SHAPES else 0

    context_bonus = 0
    if context:
        nearest_base_km = context.get("nearest_base_km")
        if nearest_base_km is not None and nearest_base_km <= 30:
            context_bonus += 3
        cloud_cover = context.get("cloud_cover_pct")
        if cloud_cover is not None and cloud_cover <= 25:
            context_bonus += 3
        if context.get("fireball_match_date"):
            context_bonus += 2
        kp = context.get("kp_index")
        if kp is not None and kp >= 5:
            context_bonus += 2

    story_score = (
        description_richness
        + signal_density
        + witness_strength
        + corroboration
        + location_specificity
        + media_mention
        + shape_rarity
        + context_bonus
    )

    return {
        "story_score": min(100, story_score),
        "description_richness": description_richness,
        "signal_density": signal_density,
        "witness_strength": witness_strength,
        "corroboration": corroboration,
        "location_specificity": location_specificity,
        "media_mention": media_mention,
        "shape_rarity": shape_rarity,
        "context_bonus": context_bonus,
    }


def quality_label_for_case(
    *,
    row: sqlite3.Row | dict[str, object],
    evidence_count: int = 0,
    enrichment_count: int = 0,
) -> tuple[int, str]:
    duration = clean_text(row["duration"] if isinstance(row, sqlite3.Row) else row.get("duration"))
    stats = clean_text(row["stats"] if isinstance(row, sqlite3.Row) else row.get("stats"))
    report_text = clean_text(row["report_text"] if isinstance(row, sqlite3.Row) else row.get("report_text"))
    lat = row["city_latitude"] if isinstance(row, sqlite3.Row) else row.get("city_latitude")
    lon = row["city_longitude"] if isinstance(row, sqlite3.Row) else row.get("city_longitude")

    score = 0
    if lat is not None and lon is not None:
        score += 1
    if duration:
        score += 1
    if stats:
        score += 1
    if parse_observer_count(stats, report_text) is not None:
        score += 1
    if enrichment_count > 0 or evidence_count > 0:
        score += 1
    if has_media_marker(stats, report_text):
        score += 1

    if score <= 2:
        return score, "low"
    if score <= 4:
        return score, "medium"
    return score, "high"
