#!/usr/bin/env python3
"""Start the UFO frontend dev server on the first available port."""

from __future__ import annotations

import argparse
import os
import socket
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1", help="Host interface to bind.")
    parser.add_argument("--port", type=int, default=None, help="Preferred port. If busy, auto-fallback is used.")
    parser.add_argument(
        "--db",
        default=str(ROOT_DIR / "ufo_sightings.db"),
        help="Path to SQLite database file.",
    )
    parser.add_argument(
        "--enrichment-csv",
        default=str(ROOT_DIR / "exports/research_results_batch_0001_1000.csv"),
        help="Optional enrichment CSV for per-sighting source details.",
    )
    parser.add_argument(
        "--ai-cache",
        default=str(ROOT_DIR / "data/ai_case_briefs.json"),
        help="Path to AI brief cache JSON file.",
    )
    parser.add_argument(
        "--openai-model",
        default="gpt-4.1-mini",
        help="OpenAI model used for on-demand case enrichment.",
    )
    parser.add_argument(
        "--env-file",
        default=str(ROOT_DIR / ".env.local"),
        help="Optional env file to load before starting (KEY=VALUE format).",
    )
    return parser.parse_args()


def is_port_free(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError:
            return False
    return True


def choose_port(host: str, preferred: int | None) -> int:
    if preferred is not None:
        if is_port_free(host, preferred):
            return preferred
        for candidate in range(preferred + 1, preferred + 16):
            if is_port_free(host, candidate):
                return candidate
        raise SystemExit(
            f"No free port found in range {preferred}-{preferred + 15}. "
            "Close a running server or choose another --port."
        )

    for candidate in range(8000, 8016):
        if is_port_free(host, candidate):
            return candidate
    raise SystemExit("No free port found in range 8000-8015.")


def load_env_file(path: Path) -> bool:
    if not path.exists():
        return False

    for line in path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ[key] = value
    return True


def main() -> int:
    args = parse_args()
    env_file = Path(args.env_file).expanduser().resolve()
    loaded_env = load_env_file(env_file)

    if args.openai_model == "gpt-4.1-mini" and os.getenv("OPENAI_MODEL"):
        args.openai_model = os.getenv("OPENAI_MODEL", args.openai_model)

    port = choose_port(args.host, args.port)
    if args.port is not None and port != args.port:
        print(f"Port {args.port} is busy. Falling back to {port}.", flush=True)

    serve_script = ROOT_DIR / "scripts" / "serve_frontend.py"
    cmd = [
        sys.executable,
        str(serve_script),
        "--host",
        args.host,
        "--port",
        str(port),
        "--db",
        str(Path(args.db).expanduser().resolve()),
        "--enrichment-csv",
        str(Path(args.enrichment_csv).expanduser().resolve()),
        "--ai-cache",
        str(Path(args.ai_cache).expanduser().resolve()),
        "--openai-model",
        args.openai_model,
    ]

    if loaded_env:
        print(f"Loaded env file: {env_file}", flush=True)
    print(f"Starting dev server on http://{args.host}:{port}", flush=True)
    os.execv(sys.executable, cmd)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
