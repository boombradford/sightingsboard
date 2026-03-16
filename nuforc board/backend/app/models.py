"""Text normalization, parsing, and signal extraction utilities."""

from __future__ import annotations

import html
import json
import re
from datetime import datetime, timedelta
from urllib.parse import urlparse


def clean_text(value: str | None, *, collapse_whitespace: bool = True) -> str | None:
    if value is None:
        return None
    text = html.unescape(str(value)).replace("\x00", "").strip()
    if not text:
        return None
    if collapse_whitespace:
        text = " ".join(text.split())
    return text


def normalize_state(value: str | None) -> str | None:
    state = clean_text(value)
    if not state:
        return None
    state = state.upper()
    if state in {"--", "NA", "N/A", "NONE", "UNKNOWN", "UNK", "?"}:
        return None
    return state


def normalize_date(value: str | None) -> str | None:
    raw = clean_text(value)
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

    normalized = normalize_date(raw)
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


def parse_bool(value: object, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    raw = str(value).strip().lower()
    if raw in {"1", "true", "yes", "y", "on"}:
        return True
    if raw in {"0", "false", "no", "n", "off", ""}:
        return False
    return default


def to_int(value: str | None, default: int, minimum: int, maximum: int) -> int:
    if value is None:
        return default
    try:
        parsed = int(value)
    except ValueError:
        return default
    return max(minimum, min(parsed, maximum))


def to_float(value: str | None) -> float | None:
    try:
        return float(str(value).strip())
    except (ValueError, AttributeError):
        return None


def utc_now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def parse_stats_map(stats_raw: str | None) -> dict[str, str]:
    text = clean_text(stats_raw)
    if not text:
        return {}

    out: dict[str, str] = {}
    for chunk in re.split(r"(?:;|\|)\s*", text):
        part = chunk.strip()
        if not part:
            continue
        split_at = part.find("=")
        if split_at < 0:
            split_at = part.find(":")
        if split_at <= 0:
            continue
        key = part[:split_at].strip().lower().replace(" ", "_")
        value = part[split_at + 1 :].strip()
        if key and value and key not in out:
            out[key] = value
    return out


def parse_observer_count(stats_raw: str | None, report_text: str | None = None) -> int | None:
    stats_map = parse_stats_map(stats_raw)
    observer_raw = stats_map.get("no_of_observers") or stats_map.get("observers")
    if observer_raw:
        match = re.search(r"\d+", observer_raw)
        if match:
            try:
                return int(match.group(0))
            except ValueError:
                pass
    text = clean_text(report_text) or ""
    match = re.search(r"\b(\d{1,2})\s+(?:witness|people|person|observers?)\b", text, re.I)
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            return None
    return None


def has_media_marker(stats_raw: str | None, report_text: str | None = None) -> bool:
    stats_text = (clean_text(stats_raw) or "").lower()
    report_text_norm = (clean_text(report_text) or "").lower()
    markers = ("photo", "photos", "video", "image", "media", "recording")
    return any(marker in stats_text or marker in report_text_norm for marker in markers)


def detect_explainable_case(report_text: str | None, stats_raw: str | None = None) -> bool:
    text = f"{clean_text(report_text) or ''} {clean_text(stats_raw) or ''}".lower()
    explainable_markers = (
        "starlink",
        "balloon",
        "meteor",
        "fireball",
        "drone",
        "aircraft",
        "plane",
        "planet",
        "venus",
        "satellite",
        "rocket launch",
    )
    return any(marker in text for marker in explainable_markers)


SIGNAL_KEYS = [
    "lights_on_object",
    "no_sound",
    "hover",
    "formation",
    "aircraft_nearby",
    "color_white",
    "fast_acceleration",
    "camera_mismatch",
    "abduction",
    "lost_time",
    "entity",
    "paralysis",
    "telepathy",
    "physical_effects",
    "em_effects",
    "fireball_match",
]


def extract_case_signals(
    shape: str | None,
    stats_raw: str | None,
    report_text: str | None,
    *,
    context: dict[str, object] | None = None,
) -> dict[str, bool]:
    text = f"{clean_text(report_text) or ''} {clean_text(stats_raw) or ''}".lower()
    shape_norm = (clean_text(shape) or "").lower()
    stats_map = parse_stats_map(stats_raw)
    characteristics = (stats_map.get("characteristics") or "").lower()

    return {
        "lights_on_object": "light" in shape_norm or "lights on object" in characteristics or "light" in text,
        "no_sound": "no sound" in text or "silent" in text,
        "hover": "hover" in text or "stationary" in text,
        "formation": "formation" in text or "line of lights" in text,
        "aircraft_nearby": "aircraft" in text or "plane" in text or "pilot" in text,
        "color_white": "white" in text,
        "fast_acceleration": "fast acceleration" in text or "shot away" in text or "sudden departure" in text,
        "camera_mismatch": "camera" in text and ("didn't show" in text or "not visible on camera" in text),
        "abduction": any(m in text for m in ("abduct", "taken aboard", "brought aboard", "taken up into")),
        "lost_time": any(m in text for m in ("lost time", "missing time", "time loss", "unaccounted time", "hours passed", "couldn't account")),
        "entity": any(m in text for m in ("entity", "humanoid", "creature", "figure approached", "occupant")),
        "paralysis": any(m in text for m in ("paralyz", "couldn't move", "frozen in place", "unable to move")),
        "telepathy": any(m in text for m in ("telepat", "communicated mentally", "heard in my head", "mental communication")),
        "physical_effects": any(m in text for m in ("burn mark", "skin irritation", "nausea", "headache after", "rash", "hair stood")),
        "em_effects": any(m in text for m in ("car stalled", "engine died", "radio static", "lights flickered", "electronics", "compass")),
        "fireball_match": bool(context and context.get("fireball_match_date")),
    }


def parse_filter_query(query: dict[str, list[str]]) -> dict[str, object]:
    keyword = clean_text(query.get("keyword", [None])[0])
    keyword_query = normalize_fts_keyword(keyword)
    state = normalize_state(query.get("state", [None])[0])
    shape = clean_text(query.get("shape", [None])[0])
    city = clean_text(query.get("city", [None])[0])
    from_date = normalize_date(query.get("from_date", [None])[0])
    to_date, to_date_exclusive = normalize_to_date_upper_bound(query.get("to_date", [None])[0])
    has_description = parse_bool(query.get("has_description", [None])[0], default=False)
    near_base = parse_bool(query.get("near_base", [None])[0], default=False)
    clear_sky = parse_bool(query.get("clear_sky", [None])[0], default=False)
    return {
        "keyword": keyword,
        "keyword_query": keyword_query,
        "state": state,
        "shape": shape,
        "city": city,
        "from_date": from_date,
        "to_date": to_date,
        "to_date_exclusive": to_date_exclusive,
        "has_description": has_description,
        "near_base": near_base,
        "clear_sky": clear_sky,
    }


def parse_filter_payload(payload: dict[str, object] | None) -> dict[str, object]:
    if not isinstance(payload, dict):
        return parse_filter_query({})
    pseudo_query: dict[str, list[str]] = {}
    for key in ("keyword", "state", "shape", "city", "from_date", "to_date", "near_base", "clear_sky"):
        raw = payload.get(key)
        if raw is None:
            continue
        pseudo_query[key] = [str(raw)]
    return parse_filter_query(pseudo_query)


def merge_filters(base: dict[str, object], extra: dict[str, object]) -> dict[str, object]:
    merged = dict(base)
    for key in ("keyword", "keyword_query", "state", "shape", "city", "from_date", "to_date", "to_date_exclusive"):
        value = extra.get(key)
        if value in (None, ""):
            continue
        merged[key] = value
    return merged


def build_filter_parts(
    filters: dict[str, object],
    *,
    alias: str = "s",
    omit: set[str] | None = None,
) -> tuple[list[str], list[str], list[object]]:
    omit_keys = omit or set()
    joins: list[str] = []
    where: list[str] = []
    params: list[object] = []

    keyword = filters.get("keyword")
    keyword_query = filters.get("keyword_query")
    if keyword and not keyword_query:
        where.append("1 = 0")
    elif keyword_query and "keyword" not in omit_keys:
        joins.append(f"JOIN sightings_fts ON sightings_fts.rowid = {alias}.sighting_id")
        where.append("sightings_fts MATCH ?")
        params.append(keyword_query)

    if filters.get("state") and "state" not in omit_keys:
        where.append(f"UPPER({alias}.state) = ?")
        params.append(filters["state"])
    if filters.get("shape") and "shape" not in omit_keys:
        where.append(f"LOWER({alias}.shape) = LOWER(?)")
        params.append(filters["shape"])
    if filters.get("city") and "city" not in omit_keys:
        where.append(f"LOWER({alias}.city) = LOWER(?)")
        params.append(filters["city"])
    if filters.get("from_date") and "date" not in omit_keys:
        where.append(f"{alias}.date_time >= ?")
        params.append(filters["from_date"])
    if filters.get("to_date") and "date" not in omit_keys:
        where.append(f"{alias}.date_time < ?" if filters.get("to_date_exclusive") else f"{alias}.date_time <= ?")
        params.append(filters["to_date"])
    if filters.get("has_description"):
        where.append(f"{alias}.report_text IS NOT NULL AND LENGTH({alias}.report_text) > 100")

    if filters.get("near_base"):
        joins.append(f"LEFT JOIN sighting_context ctx ON ctx.sighting_id = {alias}.sighting_id")
        where.append("ctx.nearest_base_km IS NOT NULL AND ctx.nearest_base_km <= 30")
    if filters.get("clear_sky"):
        if not filters.get("near_base"):
            joins.append(f"LEFT JOIN sighting_context ctx ON ctx.sighting_id = {alias}.sighting_id")
        where.append("ctx.cloud_cover_pct IS NOT NULL AND ctx.cloud_cover_pct <= 25")

    return joins, where, params


def parse_constraints(payload: dict[str, object] | None) -> dict[str, bool]:
    raw = payload if isinstance(payload, dict) else {}
    return {
        "has_coordinates": parse_bool(raw.get("has_coordinates"), default=False),
        "has_sources": parse_bool(raw.get("has_sources"), default=False),
        "has_media": parse_bool(raw.get("has_media"), default=False),
    }


def build_constraints_where(constraints: dict[str, bool], *, alias: str = "s") -> tuple[list[str], list[object]]:
    where: list[str] = []
    params: list[object] = []
    if constraints.get("has_coordinates"):
        where.append(f"{alias}.city_latitude IS NOT NULL AND {alias}.city_longitude IS NOT NULL")
    if constraints.get("has_media"):
        media_tokens = ["photo", "video", "image", "media", "recording"]
        token_clauses = []
        for _ in media_tokens:
            token_clauses.append(f"LOWER(COALESCE({alias}.stats,'')) LIKE ?")
            token_clauses.append(f"LOWER(COALESCE({alias}.report_text,'')) LIKE ?")
        where.append("(" + " OR ".join(token_clauses) + ")")
        for token in media_tokens:
            like = f"%{token}%"
            params.extend([like, like])
    return where, params


def is_http_url(value: str | None) -> bool:
    raw = clean_text(value)
    if not raw:
        return False
    parsed = urlparse(raw)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def parse_json_maybe(text: str) -> dict[str, object]:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        stripped = stripped.replace("json\n", "", 1).strip()
    payload = json.loads(stripped)
    if not isinstance(payload, dict):
        raise ValueError("AI response must be a JSON object.")
    return payload
