#!/usr/bin/env python3
"""Serve a local frontend and JSON API for exploring UFO sightings."""

from __future__ import annotations

import argparse
import csv
import html
import json
import os
import re
import sqlite3
import threading
from datetime import datetime, timedelta
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT_DIR = Path(__file__).resolve().parent.parent
WEB_DIR = ROOT_DIR / "web"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1", help="Host interface to bind.")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on.")
    parser.add_argument(
        "--db",
        default=str(ROOT_DIR / "ufo_sightings.db"),
        help="Path to SQLite database file.",
    )
    parser.add_argument(
        "--enrichment-csv",
        default=str(ROOT_DIR / "exports/research_results_batch_0001_1000.csv"),
        help="Optional enrichment CSV to attach additional source details per sighting.",
    )
    parser.add_argument(
        "--ai-cache",
        default=str(ROOT_DIR / "data/ai_case_briefs.json"),
        help="Path to JSON cache file for AI-generated case briefs.",
    )
    parser.add_argument(
        "--openai-model",
        default=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        help="OpenAI model to use for case enrichment.",
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
    # Convert free-text input into a conservative AND query to avoid FTS syntax errors.
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

    # Date-only values from HTML date inputs are intended to include the full day.
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


def load_enrichment_index(path: Path) -> dict[int, list[dict[str, object]]]:
    if not path.exists():
        return {}

    index: dict[int, list[dict[str, object]]] = {}
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            try:
                sighting_id = int(str(row.get("sighting_id", "")).strip())
            except ValueError:
                continue

            entry = {
                "source_url": clean_text(row.get("source_url")),
                "source_title": clean_text(row.get("source_title")) or "Untitled source",
                "publisher": clean_text(row.get("publisher")) or "",
                "published_date": clean_text(row.get("published_date")) or "",
                "why_relevant": clean_text(row.get("why_relevant")) or "",
                "supports_or_contradicts": clean_text(row.get("supports_or_contradicts")) or "unknown",
                "confidence_0_to_1": to_float(row.get("confidence_0_to_1")),
                "notes": clean_text(row.get("notes")) or "",
                "mirror_sighting_id": clean_text(row.get("mirror_sighting_id")) or "",
            }
            index.setdefault(sighting_id, []).append(entry)

    for sighting_id, items in index.items():
        items.sort(key=lambda item: item.get("confidence_0_to_1") or 0.0, reverse=True)
    return index


def load_ai_cache(path: Path) -> dict[str, dict[str, object]]:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    if not isinstance(payload, dict):
        return {}
    clean: dict[str, dict[str, object]] = {}
    for key, value in payload.items():
        if isinstance(key, str) and isinstance(value, dict):
            clean[key] = value
    return clean


def save_ai_cache(path: Path, cache: dict[str, dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, indent=2, ensure_ascii=True), encoding="utf-8")


def build_case_fingerprint(
    *,
    report_link: str | None,
    date_time: str | None,
    city: str | None,
    state: str | None,
    shape: str | None,
    duration: str | None,
) -> str:
    normalized_state = normalize_state(state) or ""
    parts = [
        clean_text(report_link) or "",
        clean_text(date_time) or "",
        clean_text(city) or "",
        normalized_state,
        clean_text(shape) or "",
        clean_text(duration) or "",
    ]
    return "|".join(parts)


def cache_entry_matches_case(
    cache_entry: dict[str, object] | None,
    *,
    report_link: str | None,
    fingerprint: str,
) -> bool:
    if not isinstance(cache_entry, dict):
        return False

    cached_link = clean_text(cache_entry.get("report_link"))
    if report_link:
        return cached_link == report_link

    cached_fp = clean_text(cache_entry.get("fingerprint"))
    return bool(cached_fp and cached_fp == fingerprint)


def build_fingerprint_from_payload(case_payload: dict[str, object]) -> str:
    return build_case_fingerprint(
        report_link=case_payload.get("report_link") if isinstance(case_payload.get("report_link"), str) else None,
        date_time=case_payload.get("date_time") if isinstance(case_payload.get("date_time"), str) else None,
        city=case_payload.get("city") if isinstance(case_payload.get("city"), str) else None,
        state=case_payload.get("state") if isinstance(case_payload.get("state"), str) else None,
        shape=case_payload.get("shape") if isinstance(case_payload.get("shape"), str) else None,
        duration=case_payload.get("duration") if isinstance(case_payload.get("duration"), str) else None,
    )


def get_case_payload(
    db_path: Path,
    enrichment_index: dict[int, list[dict[str, object]]],
    sighting_id: int,
) -> dict[str, object] | None:
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
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
              stats,
              report_link,
              posted,
              city_latitude,
              city_longitude
            FROM sightings
            WHERE sighting_id = ?
            """,
            (sighting_id,),
        ).fetchone()
    if row is None:
        return None

    return {
        "sighting_id": row["sighting_id"],
        "date_time": normalize_date(row["date_time"]),
        "city": clean_text(row["city"]),
        "state": normalize_state(row["state"]),
        "shape": clean_text(row["shape"]),
        "duration": clean_text(row["duration"]),
        "summary": clean_text(row["summary"]),
        "report_text": clean_text(row["report_text"], collapse_whitespace=False),
        "stats": clean_text(row["stats"]),
        "report_link": clean_text(row["report_link"]),
        "posted": normalize_date(row["posted"]),
        "city_latitude": row["city_latitude"],
        "city_longitude": row["city_longitude"],
        "linked_sources": enrichment_index.get(sighting_id, [])[:10],
    }


def parse_json_maybe(text: str) -> dict[str, object]:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        stripped = stripped.replace("json\n", "", 1).strip()
    payload = json.loads(stripped)
    if not isinstance(payload, dict):
        raise ValueError("AI response must be a JSON object.")
    return payload


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


def fetch_sightings(
    db_path: Path,
    enrichment_index: dict[int, list[dict[str, object]]],
    ai_cache: dict[str, dict[str, object]],
    query: dict[str, list[str]],
) -> dict[str, object]:
    keyword = clean_text(query.get("keyword", [None])[0])
    keyword_query = normalize_fts_keyword(keyword)
    state = normalize_state(query.get("state", [None])[0])
    shape = clean_text(query.get("shape", [None])[0])
    from_date = normalize_date(query.get("from_date", [None])[0])
    to_date, to_date_exclusive = normalize_to_date_upper_bound(query.get("to_date", [None])[0])
    order = (query.get("order", ["recent"])[0] or "recent").lower()
    limit = to_int(query.get("limit", [None])[0], default=20, minimum=1, maximum=500)
    offset = to_int(query.get("offset", [None])[0], default=0, minimum=0, maximum=200000)

    if order not in {"recent", "oldest", "random"}:
        order = "recent"

    joins = []
    where = []
    params: list[object] = []

    if keyword and not keyword_query:
        return {
            "meta": {
                "limit": limit,
                "offset": offset,
                "returned": 0,
                "total": 0,
                "order": order,
            },
            "items": [],
        }
    if keyword_query:
        joins.append("JOIN sightings_fts ON sightings_fts.rowid = s.sighting_id")
        where.append("sightings_fts MATCH ?")
        params.append(keyword_query)
    if state:
        where.append("UPPER(s.state) = ?")
        params.append(state)
    if shape:
        where.append("LOWER(s.shape) = LOWER(?)")
        params.append(shape)
    if from_date:
        where.append("s.date_time >= ?")
        params.append(from_date)
    if to_date:
        where.append("s.date_time < ?" if to_date_exclusive else "s.date_time <= ?")
        params.append(to_date)

    from_clause = "FROM sightings s " + " ".join(joins)
    where_clause = ("WHERE " + " AND ".join(where)) if where else ""

    if order == "random":
        order_clause = "ORDER BY RANDOM()"
    elif order == "oldest":
        order_clause = "ORDER BY s.date_time ASC NULLS LAST, s.sighting_id ASC"
    else:
        order_clause = "ORDER BY s.date_time DESC NULLS LAST, s.sighting_id DESC"

    data_sql = f"""
        SELECT
            s.sighting_id,
            s.date_time,
            s.city,
            s.state,
            s.shape,
            s.duration,
            s.summary,
            s.report_text,
            s.stats,
            s.report_link,
            s.posted,
            s.city_latitude,
            s.city_longitude
        {from_clause}
        {where_clause}
        {order_clause}
        LIMIT ? OFFSET ?
    """

    count_sql = f"SELECT COUNT(*) {from_clause} {where_clause}"

    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(data_sql, params + [limit, offset]).fetchall()
        total = int(conn.execute(count_sql, params).fetchone()[0])

    sightings: list[dict[str, object]] = []
    for row in rows:
        text = clean_text(row["report_text"], collapse_whitespace=False)
        summary = clean_text(row["summary"]) or (
            text[:217] + "..." if text and len(text) > 220 else text
        )
        normalized_date_time = normalize_date(row["date_time"])
        normalized_state = normalize_state(row["state"]) or "--"
        row_report_link = clean_text(row["report_link"])
        row_duration = clean_text(row["duration"]) or ""
        cache_key = str(row["sighting_id"])
        cache_entry = ai_cache.get(cache_key)
        row_fingerprint = build_case_fingerprint(
            report_link=row_report_link,
            date_time=normalized_date_time,
            city=clean_text(row["city"]),
            state=normalized_state,
            shape=clean_text(row["shape"]),
            duration=row_duration,
        )
        ai_brief = None
        if cache_entry and cache_entry_matches_case(
            cache_entry,
            report_link=row_report_link,
            fingerprint=row_fingerprint,
        ):
            brief = cache_entry.get("brief")
            if isinstance(brief, dict):
                ai_brief = brief

        sightings.append(
            {
                "sighting_id": row["sighting_id"],
                "date_time": normalized_date_time or "unknown-date",
                "city": clean_text(row["city"]) or "unknown-city",
                "state": normalized_state,
                "shape": clean_text(row["shape"]) or "unknown-shape",
                "duration": row_duration,
                "summary": summary or "",
                "report_text": text or "",
                "stats": clean_text(row["stats"]) or "",
                "report_link": row_report_link,
                "posted": normalize_date(row["posted"]),
                "city_latitude": row["city_latitude"],
                "city_longitude": row["city_longitude"],
                "enrichment_sources": enrichment_index.get(row["sighting_id"], [])[:6],
                "enrichment_count": len(enrichment_index.get(row["sighting_id"], [])),
                "ai_brief": ai_brief,
            }
        )

    return {
        "meta": {
            "limit": limit,
            "offset": offset,
            "returned": len(sightings),
            "total": total,
            "order": order,
        },
        "items": sightings,
    }


def fetch_options(db_path: Path) -> dict[str, object]:
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        states_raw = conn.execute(
            "SELECT DISTINCT state FROM sightings WHERE state IS NOT NULL AND TRIM(state) <> ''"
        ).fetchall()
        shapes_raw = conn.execute(
            "SELECT DISTINCT shape FROM sightings WHERE shape IS NOT NULL AND TRIM(shape) <> ''"
        ).fetchall()

    states = sorted({s for row in states_raw if (s := normalize_state(row["state"]))})
    shapes = sorted(
        {s for row in shapes_raw if (s := clean_text(row["shape"]))},
        key=lambda value: value.lower(),
    )
    return {"states": states, "shapes": shapes}


def fetch_stats(db_path: Path) -> dict[str, object]:
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        total = int(conn.execute("SELECT COUNT(*) AS n FROM sightings").fetchone()["n"])
        geocoded = int(
            conn.execute(
                """
                SELECT COUNT(*) AS n
                FROM sightings
                WHERE city_latitude IS NOT NULL AND city_longitude IS NOT NULL
                """
            ).fetchone()["n"]
        )
        min_date, max_date = conn.execute(
            "SELECT MIN(date_time), MAX(date_time) FROM sightings WHERE date_time IS NOT NULL"
        ).fetchone()
        top_shapes = [
            {"shape": clean_text(row["shape"]) or "unknown", "count": row["count"]}
            for row in conn.execute(
                """
                SELECT shape, COUNT(*) AS count
                FROM sightings
                WHERE shape IS NOT NULL AND TRIM(shape) <> ''
                GROUP BY shape
                ORDER BY count DESC
                LIMIT 8
                """
            ).fetchall()
        ]
        top_states = [
            {"state": normalize_state(row["state"]) or "--", "count": row["count"]}
            for row in conn.execute(
                """
                SELECT state, COUNT(*) AS count
                FROM sightings
                WHERE state IS NOT NULL AND TRIM(state) <> ''
                GROUP BY state
                ORDER BY count DESC
                LIMIT 8
                """
            ).fetchall()
        ]

    return {
        "total_sightings": total,
        "geocoded_sightings": geocoded,
        "date_range": {
            "min": normalize_date(min_date),
            "max": normalize_date(max_date),
        },
        "top_shapes": top_shapes,
        "top_states": top_states,
    }


class UFORequestHandler(SimpleHTTPRequestHandler):
    server_version = "UFOBoard/1.0"

    def __init__(self, *args, directory: str | None = None, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    @property
    def db_path(self) -> Path:
        return self.server.db_path  # type: ignore[attr-defined]

    @property
    def enrichment_index(self) -> dict[int, list[dict[str, object]]]:
        return self.server.enrichment_index  # type: ignore[attr-defined]

    @property
    def ai_cache(self) -> dict[str, dict[str, object]]:
        return self.server.ai_cache  # type: ignore[attr-defined]

    @property
    def ai_cache_path(self) -> Path:
        return self.server.ai_cache_path  # type: ignore[attr-defined]

    @property
    def ai_cache_lock(self) -> threading.Lock:
        return self.server.ai_cache_lock  # type: ignore[attr-defined]

    @property
    def openai_model(self) -> str:
        return self.server.openai_model  # type: ignore[attr-defined]

    def log_message(self, format: str, *args) -> None:
        return super().log_message(format, *args)

    def _send_json(self, payload: dict[str, object], status: int = 200) -> None:
        raw = json.dumps(payload, ensure_ascii=True).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/favicon.ico":
            self.send_response(HTTPStatus.NO_CONTENT)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if parsed.path == "/api/health":
            self._send_json({"ok": True})
            return
        if parsed.path == "/api/sightings":
            try:
                payload = fetch_sightings(
                    self.db_path, self.enrichment_index, self.ai_cache, parse_qs(parsed.query)
                )
                self._send_json(payload)
            except sqlite3.OperationalError as exc:
                message = str(exc)
                status = 400 if "fts" in message.lower() else 500
                self._send_json({"error": message}, status=status)
            return
        if parsed.path == "/api/options":
            self._send_json(fetch_options(self.db_path))
            return
        if parsed.path == "/api/stats":
            self._send_json(fetch_stats(self.db_path))
            return
        if parsed.path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/api/enrich":
            self._send_json({"error": "Not found"}, status=404)
            return

        content_length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(content_length) if content_length > 0 else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self._send_json({"error": "Invalid JSON body"}, status=400)
            return
        if not isinstance(payload, dict):
            self._send_json({"error": "JSON body must be an object"}, status=400)
            return

        try:
            sighting_id = int(payload.get("sighting_id"))
        except (TypeError, ValueError):
            self._send_json({"error": "sighting_id must be an integer"}, status=400)
            return
        force = parse_bool(payload.get("force"), default=False)

        case_payload = get_case_payload(self.db_path, self.enrichment_index, sighting_id)
        if case_payload is None:
            self._send_json({"error": f"sighting_id {sighting_id} not found"}, status=404)
            return

        raw_case_report_link = case_payload.get("report_link")
        report_link = clean_text(raw_case_report_link) if isinstance(raw_case_report_link, str) else None
        case_fingerprint = build_fingerprint_from_payload(case_payload)

        cache_key = str(sighting_id)
        with self.ai_cache_lock:
            cached = self.ai_cache.get(cache_key)
        if (
            cached
            and not force
            and cache_entry_matches_case(
                cached,
                report_link=report_link,
                fingerprint=case_fingerprint,
            )
            and isinstance(cached.get("brief"), dict)
        ):
            self._send_json({"ok": True, "cached": True, "sighting_id": sighting_id, "brief": cached.get("brief")})
            return

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            self._send_json(
                {"error": "OPENAI_API_KEY is not set. Set it in your shell before starting the server."},
                status=400,
            )
            return

        try:
            brief = generate_ai_case_brief(api_key, self.openai_model, case_payload)
        except RuntimeError as exc:
            self._send_json({"error": str(exc)}, status=502)
            return
        except Exception as exc:  # defensive fallback
            self._send_json({"error": f"AI enrichment failed: {exc}"}, status=500)
            return

        entry = {
            "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
            "model": self.openai_model,
            "report_link": report_link,
            "fingerprint": case_fingerprint,
            "brief": brief,
        }
        with self.ai_cache_lock:
            self.ai_cache[cache_key] = entry
            save_ai_cache(self.ai_cache_path, self.ai_cache)

        self._send_json({"ok": True, "cached": False, "sighting_id": sighting_id, "brief": brief})

    def send_error(self, code: int, message: str | None = None, explain: str | None = None) -> None:
        if code == HTTPStatus.NOT_FOUND:
            self._send_json({"error": "Not found"}, status=404)
            return
        return super().send_error(code, message, explain)


def main() -> int:
    args = parse_args()
    db_path = Path(args.db).expanduser().resolve()
    enrichment_csv = Path(args.enrichment_csv).expanduser().resolve()
    ai_cache_path = Path(args.ai_cache).expanduser().resolve()
    if not db_path.exists():
        raise SystemExit(f"Database file not found: {db_path}")
    if not WEB_DIR.exists():
        raise SystemExit(f"Web directory not found: {WEB_DIR}")

    enrichment_index = load_enrichment_index(enrichment_csv)
    ai_cache = load_ai_cache(ai_cache_path)
    try:
        server = ThreadingHTTPServer((args.host, args.port), UFORequestHandler)
    except OSError as exc:
        if exc.errno in {48, 98}:  # macOS/Linux "Address already in use"
            raise SystemExit(
                f"Port {args.port} is already in use on {args.host}. "
                f"Try a different port, e.g. --port {args.port + 1}"
            ) from exc
        raise SystemExit(f"Could not start server: {exc}") from exc

    server.db_path = db_path  # type: ignore[attr-defined]
    server.enrichment_index = enrichment_index  # type: ignore[attr-defined]
    server.ai_cache = ai_cache  # type: ignore[attr-defined]
    server.ai_cache_path = ai_cache_path  # type: ignore[attr-defined]
    server.ai_cache_lock = threading.Lock()  # type: ignore[attr-defined]
    server.openai_model = args.openai_model  # type: ignore[attr-defined]

    print(f"Serving frontend: http://{args.host}:{args.port}", flush=True)
    print(f"Using database:   {db_path}", flush=True)
    print(
        "Enrichment CSV:  "
        f"{enrichment_csv if enrichment_csv.exists() else 'not found (running without extra source rows)'}"
        ,
        flush=True,
    )
    print(f"Enriched IDs:     {len(enrichment_index):,}", flush=True)
    print(f"AI cache entries: {len(ai_cache):,}", flush=True)
    print(f"AI model:         {args.openai_model}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
