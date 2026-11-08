from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

FIXTURE_SITE = ROOT / "fixtures" / "site"


@pytest.fixture(scope="session")
def repo_root() -> Path:
    return ROOT


@pytest.fixture(scope="session")
def fixture_site() -> Path:
    return FIXTURE_SITE


@pytest.fixture(scope="session")
def fixture_base_url(fixture_site: Path) -> str:
    # file:// URLs work with Chrome for static fixtures
    return fixture_site.resolve().as_uri()


@pytest.fixture(scope="session")
def webclaw_home(tmp_path_factory) -> Path:
    home = tmp_path_factory.mktemp("webclaw-home")
    for sub in ("bin", "recipes", "runs", "jobs"):
        (home / sub).mkdir()
    os.environ["WEBCLAW_HOME"] = str(home)
    # Point binary (monorepo order: env → in-repo target → ~/.webclaw → legacy oss)
    from webclaw_x.lite_bin import resolve_lite_bin
    bin_path = resolve_lite_bin(ROOT)
    os.environ["WEBCLAW_LITE_BIN"] = str(bin_path)
    # Prefer headless for CI-ish smoke on the box desktop
    os.environ.setdefault("WEBCLAW_HEADLESS", "1")
    return home


import json as _json

def as_envelope(value):
    """Accept dict tool returns (new) or JSON strings (old)."""
    if isinstance(value, (bytes, bytearray)):
        value = value.decode()
    if isinstance(value, str):
        return _json.loads(value)
    return value
