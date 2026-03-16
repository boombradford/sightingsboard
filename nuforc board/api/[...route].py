"""Root-level Vercel serverless function.

Adds backend/ to sys.path, then delegates to the handler defined in
backend/api/[...route].py by re-importing its `handler` class.
"""
from __future__ import annotations

import importlib
import sys
from pathlib import Path

# backend/ contains serve_frontend.py and the app/ package
_BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# Import the real handler module from backend/api/[...route].py
_spec = importlib.util.spec_from_file_location(
    "_backend_route",
    str(_BACKEND_DIR / "api" / "[...route].py"),
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

# Vercel expects `handler` at module level
handler = _mod.handler
