from __future__ import annotations

import json
import os
import shutil
import sys
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT_DIR = Path(__file__).resolve().parent.parent
SUPPORT_DIR = ROOT_DIR / "api_support"
if str(SUPPORT_DIR) not in sys.path:
    sys.path.insert(0, str(SUPPORT_DIR))

from serve_frontend import (
    build_fingerprint_from_payload,
    cache_entry_matches_case,
    clean_text,
    compare_case_briefs,
    compare_cohorts,
    create_brief_issue,
    create_case_brief_version,
    create_case_evidence,
    create_sample_set,
    ensure_vnext_schema,
    fetch_case_file,
    fetch_options,
    fetch_pivot,
    fetch_sightings,
    fetch_stats,
    generate_ai_case_brief,
    generate_sample,
    get_case_payload,
    get_sample_set,
    list_case_brief_versions,
    list_case_evidence,
    list_sample_sets,
    load_ai_cache,
    parse_bool,
    save_ai_cache,
    to_int,
    update_case_evidence,
)
BUNDLED_DB_PATH = SUPPORT_DIR / "ufo_sightings.sqlitebundle"
RUNTIME_DB_PATH = Path("/tmp/ufo_sightings.db")
AI_CACHE_PATH = Path("/tmp/ai_case_briefs.json")

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
ALLOW_ORIGIN = os.getenv("ALLOW_ORIGIN", "*")

DB_INIT_LOCK = threading.Lock()
AI_CACHE_LOCK = threading.Lock()
AI_CACHE: dict[str, dict[str, object]] | None = None


def ensure_runtime_db() -> Path:
    with DB_INIT_LOCK:
        if not RUNTIME_DB_PATH.exists():
            if not BUNDLED_DB_PATH.exists():
                raise RuntimeError("Bundled database file missing on deployment")
            shutil.copyfile(BUNDLED_DB_PATH, RUNTIME_DB_PATH)
        ensure_vnext_schema(RUNTIME_DB_PATH)
    return RUNTIME_DB_PATH


def get_ai_cache() -> dict[str, dict[str, object]]:
    global AI_CACHE
    if AI_CACHE is None:
        AI_CACHE = load_ai_cache(AI_CACHE_PATH)
    return AI_CACHE


def normalize_path(path: str) -> str:
    if path.startswith("/api/"):
        return path
    # Some Vercel rewrites may pass plain route segments.
    return f"/api/{path.lstrip('/')}"


class handler(BaseHTTPRequestHandler):
    def _set_headers(self, status: int, length: int) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(length))
        self.send_header("Access-Control-Allow-Origin", ALLOW_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type,Authorization")
        self.end_headers()

    def _send_json(self, payload: dict[str, object], status: int = 200) -> None:
        raw = json.dumps(payload, ensure_ascii=True).encode("utf-8")
        self._set_headers(status, len(raw))
        self.wfile.write(raw)

    def _read_json_body(self) -> dict[str, object]:
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(content_length) if content_length > 0 else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError("Invalid JSON body") from exc
        if not isinstance(payload, dict):
            raise ValueError("JSON body must be an object")
        return payload

    def _handle_legacy_enrich(self, db_path: Path, payload: dict[str, object]) -> None:
        try:
            sighting_id = int(payload.get("sighting_id"))
        except (TypeError, ValueError):
            self._send_json({"error": "sighting_id must be an integer"}, status=400)
            return

        force = parse_bool(payload.get("force"), default=False)
        case_payload = get_case_payload(db_path, {}, sighting_id)
        if case_payload is None:
            self._send_json({"error": f"sighting_id {sighting_id} not found"}, status=404)
            return

        report_link = clean_text(case_payload.get("report_link") if isinstance(case_payload.get("report_link"), str) else None)
        case_fingerprint = build_fingerprint_from_payload(case_payload)

        cache_key = str(sighting_id)
        ai_cache = get_ai_cache()
        with AI_CACHE_LOCK:
            cached = ai_cache.get(cache_key)

        if (
            cached
            and not force
            and cache_entry_matches_case(cached, report_link=report_link, fingerprint=case_fingerprint)
            and isinstance(cached.get("brief"), dict)
        ):
            self._send_json({"ok": True, "cached": True, "sighting_id": sighting_id, "brief": cached.get("brief")})
            return

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            self._send_json({"error": "OPENAI_API_KEY is not set on backend deployment."}, status=400)
            return

        try:
            brief = generate_ai_case_brief(api_key, OPENAI_MODEL, case_payload)
        except RuntimeError as exc:
            self._send_json({"error": str(exc)}, status=502)
            return
        except Exception as exc:
            self._send_json({"error": f"AI enrichment failed: {exc}"}, status=500)
            return

        entry = {
            "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
            "model": OPENAI_MODEL,
            "report_link": report_link,
            "fingerprint": case_fingerprint,
            "brief": brief,
        }
        with AI_CACHE_LOCK:
            ai_cache[cache_key] = entry
            save_ai_cache(AI_CACHE_PATH, ai_cache)

        self._send_json({"ok": True, "cached": False, "sighting_id": sighting_id, "brief": brief})

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._set_headers(204, 0)

    def do_GET(self) -> None:  # noqa: N802
        try:
            db_path = ensure_runtime_db()
        except Exception as exc:
            self._send_json({"error": str(exc)}, status=500)
            return

        parsed = urlparse(self.path)
        path = normalize_path(parsed.path)
        query = parse_qs(parsed.query)

        if path in {"/api", "/api/health"}:
            self._send_json({"ok": True})
            return

        if path == "/api/sightings":
            try:
                payload = fetch_sightings(db_path, {}, get_ai_cache(), query)
                self._send_json(payload)
            except Exception as exc:
                self._send_json({"error": str(exc)}, status=400)
            return

        if path == "/api/options":
            self._send_json(fetch_options(db_path))
            return

        if path == "/api/stats":
            self._send_json(fetch_stats(db_path))
            return

        if path == "/api/pivot":
            self._send_json(fetch_pivot(db_path, query))
            return

        if path == "/api/sample-sets":
            limit = to_int(query.get("limit", [None])[0], default=20, minimum=1, maximum=100)
            self._send_json(list_sample_sets(db_path, limit))
            return

        import re

        sample_match = re.fullmatch(r"/api/sample-sets/([A-Za-z0-9_-]+)", path)
        if sample_match:
            payload = get_sample_set(db_path, {}, get_ai_cache(), sample_match.group(1))
            if payload is None:
                self._send_json({"error": "Sample set not found"}, status=404)
                return
            self._send_json(payload)
            return

        case_match = re.fullmatch(r"/api/cases/(\d+)", path)
        if case_match:
            sighting_id = int(case_match.group(1))
            payload = fetch_case_file(db_path, {}, get_ai_cache(), sighting_id)
            if payload is None:
                self._send_json({"error": f"sighting_id {sighting_id} not found"}, status=404)
                return
            self._send_json(payload)
            return

        evidence_match = re.fullmatch(r"/api/cases/(\d+)/evidence", path)
        if evidence_match:
            sighting_id = int(evidence_match.group(1))
            self._send_json({"items": list_case_evidence(db_path, sighting_id)})
            return

        compare_match = re.fullmatch(r"/api/cases/(\d+)/briefs/compare", path)
        if compare_match:
            sighting_id = int(compare_match.group(1))
            try:
                left_id = int(query.get("left", [None])[0])
                right_id = int(query.get("right", [None])[0])
            except (TypeError, ValueError):
                self._send_json({"error": "left and right brief IDs are required"}, status=400)
                return
            result = compare_case_briefs(db_path, sighting_id, left_id, right_id)
            if result is None:
                self._send_json({"error": "Brief version not found"}, status=404)
                return
            self._send_json(result)
            return

        briefs_match = re.fullmatch(r"/api/cases/(\d+)/briefs", path)
        if briefs_match:
            sighting_id = int(briefs_match.group(1))
            self._send_json({"items": list_case_brief_versions(db_path, sighting_id)})
            return

        self._send_json({"error": "Not found"}, status=404)

    def do_POST(self) -> None:  # noqa: N802
        try:
            db_path = ensure_runtime_db()
            payload = self._read_json_body()
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status=400)
            return
        except Exception as exc:
            self._send_json({"error": str(exc)}, status=500)
            return

        parsed = urlparse(self.path)
        path = normalize_path(parsed.path)

        if path == "/api/enrich":
            self._handle_legacy_enrich(db_path, payload)
            return

        if path == "/api/compare":
            try:
                result = compare_cohorts(db_path, {}, get_ai_cache(), payload)
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=400)
                return
            self._send_json(result)
            return

        if path == "/api/samples/generate":
            result = generate_sample(db_path, {}, get_ai_cache(), payload)
            self._send_json(result)
            return

        if path == "/api/sample-sets":
            try:
                result = create_sample_set(db_path, payload)
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=400)
                return
            self._send_json(result, status=201)
            return

        import re

        evidence_match = re.fullmatch(r"/api/cases/(\d+)/evidence", path)
        if evidence_match:
            sighting_id = int(evidence_match.group(1))
            try:
                result = create_case_evidence(db_path, sighting_id, payload)
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=400)
                return
            self._send_json(result, status=201)
            return

        briefs_match = re.fullmatch(r"/api/cases/(\d+)/briefs", path)
        if briefs_match:
            sighting_id = int(briefs_match.group(1))
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                self._send_json({"error": "OPENAI_API_KEY is not set on backend deployment."}, status=400)
                return
            try:
                result = create_case_brief_version(db_path, {}, sighting_id, OPENAI_MODEL, api_key)
            except ValueError as exc:
                status = 404 if "not found" in str(exc).lower() else 400
                self._send_json({"error": str(exc)}, status=status)
                return
            except RuntimeError as exc:
                self._send_json({"error": str(exc)}, status=502)
                return
            self._send_json(result, status=201)
            return

        issue_match = re.fullmatch(r"/api/cases/(\d+)/briefs/(\d+)/issues", path)
        if issue_match:
            sighting_id = int(issue_match.group(1))
            brief_id = int(issue_match.group(2))
            result = create_brief_issue(db_path, sighting_id, brief_id, payload)
            self._send_json(result, status=201)
            return

        self._send_json({"error": "Not found"}, status=404)

    def do_PATCH(self) -> None:  # noqa: N802
        try:
            db_path = ensure_runtime_db()
            payload = self._read_json_body()
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status=400)
            return
        except Exception as exc:
            self._send_json({"error": str(exc)}, status=500)
            return

        import re

        parsed = urlparse(self.path)
        path = normalize_path(parsed.path)
        patch_match = re.fullmatch(r"/api/cases/(\d+)/evidence/(\d+)", path)
        if not patch_match:
            self._send_json({"error": "Not found"}, status=404)
            return

        try:
            sighting_id = int(patch_match.group(1))
            evidence_id = int(patch_match.group(2))
            updated = update_case_evidence(db_path, sighting_id, evidence_id, payload)
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status=400)
            return

        if updated is None:
            self._send_json({"error": "Evidence not found"}, status=404)
            return

        self._send_json(updated)
