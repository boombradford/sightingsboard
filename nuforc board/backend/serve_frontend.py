#!/usr/bin/env python3
"""Serve a local frontend and JSON API for exploring UFO sightings.

Thin wrapper — all logic lives in backend/app/.
"""

from app import *  # noqa: F401,F403

if __name__ == "__main__":
    raise SystemExit(main())
