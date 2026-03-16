"""HTTP request handler, main() entry point, and CLI argument parsing."""

from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import threading
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .models import clean_text, parse_bool, to_int
from .db import (
    ensure_vnext_schema,
    load_ai_cache,
    load_enrichment_index,
    save_ai_cache,
)
from .ai import (
    backfill_scores,
    batch_generate_briefs,
    generate_ai_case_brief,
)
from .queries.cases import (
    build_fingerprint_from_payload,
    cache_entry_matches_case,
    fetch_case_file,
    get_case_payload,
)
from .queries.sightings import (
    compare_cohorts,
    fetch_options,
    fetch_pivot,
    fetch_sightings,
    fetch_stats,
)
from .queries.evidence import (
    create_case_evidence,
    list_case_evidence,
    update_case_evidence,
)
from .queries.briefs import (
    compare_case_briefs,
    create_brief_issue,
    create_case_brief_version,
    list_case_brief_versions,
)
from .queries.bookmarks import (
    add_collection_item,
    create_bookmark,
    create_collection,
    delete_bookmark,
    delete_collection_item,
    list_bookmarks,
    list_collection_items,
    list_collections,
    update_bookmark,
)
from .queries.sampling import (
    create_sample_set,
    generate_sample,
    get_sample_set,
    list_sample_sets,
)
from .queries.discover import (
    dismiss_discovery,
    fetch_discover,
    undismiss_discovery,
)
from .queries.clusters import fetch_clusters


ROOT_DIR = Path(__file__).resolve().parent.parent.parent
WEB_DIR = ROOT_DIR / "web"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve a local frontend and JSON API for exploring UFO sightings.")
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
    parser.add_argument(
        "--backfill-scores",
        action="store_true",
        help="Compute story scores for all sightings and exit.",
    )
    parser.add_argument(
        "--batch-briefs",
        action="store_true",
        help="Generate AI briefs for top-scored unbriefed sightings and exit.",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=100,
        help="Number of briefs to generate in batch mode.",
    )
    parser.add_argument(
        "--min-score",
        type=int,
        default=60,
        help="Minimum story score for batch brief generation.",
    )
    return parser.parse_args()


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

    def _handle_legacy_enrich(self, payload: dict[str, object]) -> None:
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
            self._send_json(
                {"ok": True, "cached": True, "sighting_id": sighting_id, "brief": cached.get("brief")}
            )
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
        except Exception as exc:
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

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        if path == "/favicon.ico":
            self.send_response(HTTPStatus.NO_CONTENT)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if path == "/api/health":
            self._send_json({"ok": True})
            return
        if path == "/api/sightings":
            try:
                payload = fetch_sightings(self.db_path, self.enrichment_index, self.ai_cache, query)
                self._send_json(payload)
            except sqlite3.OperationalError as exc:
                message = str(exc)
                status = 400 if "fts" in message.lower() else 500
                self._send_json({"error": message}, status=status)
            return
        if path == "/api/options":
            self._send_json(fetch_options(self.db_path))
            return
        if path == "/api/stats":
            self._send_json(fetch_stats(self.db_path))
            return
        if path == "/api/pivot":
            self._send_json(fetch_pivot(self.db_path, query))
            return
        if path == "/api/sample-sets":
            limit = to_int(query.get("limit", [None])[0], default=20, minimum=1, maximum=100)
            self._send_json(list_sample_sets(self.db_path, limit))
            return

        if path == "/api/bookmarks":
            status_filter = clean_text(query.get("status", [None])[0])
            self._send_json({"items": list_bookmarks(self.db_path, status_filter)})
            return
        if path == "/api/collections":
            self._send_json({"items": list_collections(self.db_path)})
            return
        if path == "/api/discover":
            payload = fetch_discover(self.db_path, self.enrichment_index, self.ai_cache, query)
            self._send_json(payload)
            return
        if path == "/api/clusters":
            try:
                payload = fetch_clusters(self.db_path, query)
                self._send_json(payload)
            except sqlite3.OperationalError as exc:
                self._send_json({"error": str(exc)}, status=500)
            return

        collection_items_match = re.fullmatch(r"/api/collections/(\d+)/items", path)
        if collection_items_match:
            collection_id = int(collection_items_match.group(1))
            self._send_json({"items": list_collection_items(self.db_path, collection_id)})
            return

        sample_match = re.fullmatch(r"/api/sample-sets/([A-Za-z0-9_-]+)", path)
        if sample_match:
            payload = get_sample_set(
                self.db_path,
                self.enrichment_index,
                self.ai_cache,
                sample_match.group(1),
            )
            if payload is None:
                self._send_json({"error": "Sample set not found"}, status=404)
                return
            self._send_json(payload)
            return

        case_match = re.fullmatch(r"/api/cases/(\d+)", path)
        if case_match:
            sighting_id = int(case_match.group(1))
            payload = fetch_case_file(self.db_path, self.enrichment_index, self.ai_cache, sighting_id)
            if payload is None:
                self._send_json({"error": f"sighting_id {sighting_id} not found"}, status=404)
                return
            self._send_json(payload)
            return

        evidence_match = re.fullmatch(r"/api/cases/(\d+)/evidence", path)
        if evidence_match:
            sighting_id = int(evidence_match.group(1))
            self._send_json({"items": list_case_evidence(self.db_path, sighting_id)})
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
            result = compare_case_briefs(self.db_path, sighting_id, left_id, right_id)
            if result is None:
                self._send_json({"error": "Brief version not found"}, status=404)
                return
            self._send_json(result)
            return

        briefs_match = re.fullmatch(r"/api/cases/(\d+)/briefs", path)
        if briefs_match:
            sighting_id = int(briefs_match.group(1))
            self._send_json({"items": list_case_brief_versions(self.db_path, sighting_id)})
            return

        if path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        if not path.startswith("/api/"):
            self._send_json({"error": "Not found"}, status=404)
            return

        try:
            payload = self._read_json_body()
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status=400)
            return

        if path == "/api/enrich":
            self._handle_legacy_enrich(payload)
            return
        if path == "/api/bookmarks":
            try:
                result = create_bookmark(self.db_path, payload)
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=400)
                return
            self._send_json(result, status=201)
            return
        if path == "/api/collections":
            try:
                result = create_collection(self.db_path, payload)
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=400)
                return
            self._send_json(result, status=201)
            return

        collection_items_match = re.fullmatch(r"/api/collections/(\d+)/items", path)
        if collection_items_match:
            collection_id = int(collection_items_match.group(1))
            try:
                result = add_collection_item(self.db_path, collection_id, payload)
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=400)
                return
            self._send_json(result, status=201)
            return
        if path == "/api/compare":
            try:
                result = compare_cohorts(self.db_path, self.enrichment_index, self.ai_cache, payload)
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=400)
                return
            self._send_json(result)
            return
        if path == "/api/samples/generate":
            result = generate_sample(self.db_path, self.enrichment_index, self.ai_cache, payload)
            self._send_json(result)
            return
        if path == "/api/sample-sets":
            try:
                result = create_sample_set(self.db_path, payload)
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=400)
                return
            self._send_json(result, status=201)
            return

        if path == "/api/discover/dismiss":
            try:
                sighting_id = int(payload.get("sighting_id"))
            except (TypeError, ValueError):
                self._send_json({"error": "sighting_id is required"}, status=400)
                return
            result = dismiss_discovery(self.db_path, sighting_id)
            self._send_json(result, status=201)
            return

        evidence_match = re.fullmatch(r"/api/cases/(\d+)/evidence", path)
        if evidence_match:
            sighting_id = int(evidence_match.group(1))
            try:
                result = create_case_evidence(self.db_path, sighting_id, payload)
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
                self._send_json(
                    {"error": "OPENAI_API_KEY is not set. Set it in your shell before starting the server."},
                    status=400,
                )
                return
            try:
                result = create_case_brief_version(
                    self.db_path,
                    self.enrichment_index,
                    sighting_id,
                    self.openai_model,
                    api_key,
                )
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
            result = create_brief_issue(self.db_path, sighting_id, brief_id, payload)
            self._send_json(result, status=201)
            return

        self._send_json({"error": "Not found"}, status=404)

    def do_PATCH(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        try:
            payload = self._read_json_body()
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status=400)
            return

        bookmark_match = re.fullmatch(r"/api/bookmarks/(\d+)", path)
        if bookmark_match:
            sighting_id = int(bookmark_match.group(1))
            try:
                updated = update_bookmark(self.db_path, sighting_id, payload)
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=400)
                return
            if updated is None:
                self._send_json({"error": "Bookmark not found"}, status=404)
                return
            self._send_json(updated)
            return

        patch_match = re.fullmatch(r"/api/cases/(\d+)/evidence/(\d+)", path)
        if patch_match:
            try:
                sighting_id = int(patch_match.group(1))
                evidence_id = int(patch_match.group(2))
                updated = update_case_evidence(self.db_path, sighting_id, evidence_id, payload)
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=400)
                return
            if updated is None:
                self._send_json({"error": "Evidence not found"}, status=404)
                return
            self._send_json(updated)
            return

        self._send_json({"error": "Not found"}, status=404)

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        bookmark_match = re.fullmatch(r"/api/bookmarks/(\d+)", path)
        if bookmark_match:
            sighting_id = int(bookmark_match.group(1))
            if delete_bookmark(self.db_path, sighting_id):
                self._send_json({"ok": True})
            else:
                self._send_json({"error": "Bookmark not found"}, status=404)
            return

        collection_item_match = re.fullmatch(r"/api/collections/(\d+)/items/(\d+)", path)
        if collection_item_match:
            collection_id = int(collection_item_match.group(1))
            sighting_id = int(collection_item_match.group(2))
            if delete_collection_item(self.db_path, collection_id, sighting_id):
                self._send_json({"ok": True})
            else:
                self._send_json({"error": "Collection item not found"}, status=404)
            return

        dismiss_match = re.fullmatch(r"/api/discover/dismiss/(\d+)", path)
        if dismiss_match:
            sighting_id = int(dismiss_match.group(1))
            if undismiss_discovery(self.db_path, sighting_id):
                self._send_json({"ok": True})
            else:
                self._send_json({"error": "Dismissed entry not found"}, status=404)
            return

        self._send_json({"error": "Not found"}, status=404)

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

    ensure_vnext_schema(db_path)
    enrichment_index = load_enrichment_index(enrichment_csv)
    ai_cache = load_ai_cache(ai_cache_path)

    if args.backfill_scores:
        backfill_scores(db_path, enrichment_index)
        return 0

    if args.batch_briefs:
        batch_generate_briefs(
            db_path,
            enrichment_index,
            count=args.count,
            min_score=args.min_score,
            model="claude-sonnet-4-6",
        )
        return 0

    try:
        server = ThreadingHTTPServer((args.host, args.port), UFORequestHandler)
    except OSError as exc:
        if exc.errno in {48, 98}:
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
