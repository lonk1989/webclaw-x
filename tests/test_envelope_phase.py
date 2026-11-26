"""Tool envelope phase / userMessage for busy & cancelled."""
from __future__ import annotations

from pathlib import Path

import pytest

from webclaw_x import server as gw
from webclaw_x.errors import ErrorCode, envelope
from webclaw_x.tools_mode import CORE_TOOL_NAMES


def test_core_tools_include_browser_and_reset():
    assert "webclaw_browser" in CORE_TOOL_NAMES
    assert "webclaw_reset" in CORE_TOOL_NAMES
    assert "webclaw_set_display" in CORE_TOOL_NAMES


def test_finalize_run_busy_attaches_phase(tmp_path, monkeypatch):
    monkeypatch.setattr(gw, "HOME", tmp_path)
    (tmp_path / "jobs").mkdir()
    (tmp_path / "control").mkdir()
    out = gw._finalize(
        envelope(
            ok=False,
            code=ErrorCode.RUN_BUSY,
            message="A run is active",
            data={},
        )
    )
    assert out["code"] == "RUN_BUSY"
    assert out["phase"] == "busy"
    assert "userMessage" in out
    assert "reset" in out["userMessage"].lower() or "cancel" in out["userMessage"].lower()


def test_finalize_cancelled_attaches_phase(tmp_path, monkeypatch):
    monkeypatch.setattr(gw, "HOME", tmp_path)
    out = gw._finalize(
        {
            "ok": True,
            "code": "RUN_CANCELLED",
            "message": "Run cancelled",
            "data": {},
            "run_dir": str(tmp_path / "runs" / "x"),
        }
    )
    assert out["code"] == "RUN_CANCELLED"
    assert out["phase"] == "cancelled"
    assert out.get("userMessage")
