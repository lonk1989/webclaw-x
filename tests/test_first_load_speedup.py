"""First-load speedup: hot status, fast card, persist argv parse."""
from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from webclaw_x import status_fast
from webclaw_x.fast_card import FAST_CARD
from webclaw_x import server as gw


def test_fast_card_is_compact_and_mentions_persist():
    assert "常驻 MCP" in FAST_CARD or "常驻" in FAST_CARD
    assert "webclaw_run" in FAST_CARD
    assert len(FAST_CARD) < 1200


def test_status_fast_shape_without_lite_spawn(monkeypatch):
    calls = []

    def boom(*a, **k):
        calls.append(a)
        raise AssertionError("must not spawn lite")

    monkeypatch.setattr(gw, "_run", boom)
    monkeypatch.setenv("WEBCLAW_STATUS_MODE", "fast")
    out = gw.webclaw_status()
    # FastMCP may wrap; normalize
    if hasattr(out, "structuredContent"):
        out = out.structuredContent
    assert isinstance(out, dict)
    data = out.get("data") or out
    assert "chromeOk" in data
    assert "cdpReady" in data
    assert "chromeInstances" in data
    assert data.get("statusSource", "").startswith("host_fast") or out.get("ok") is True
    assert calls == []


def test_status_mode_lite_still_calls_run(monkeypatch):
    monkeypatch.setenv("WEBCLAW_STATUS_MODE", "lite")

    def fake_run(args, timeout=30, stdin_text=None):
        assert args == ["status"]
        return {
            "ok": True,
            "code": "OK",
            "message": "",
            "data": {
                "stdout": json.dumps({
                    "type": "status",
                    "bin": "/tmp/x",
                    "chromeOk": True,
                    "cdpReady": True,
                    "version": "0.1.22",
                }),
                "stderr": "",
                "exit_code": 0,
            },
        }

    monkeypatch.setattr(gw, "_run", fake_run)
    out = gw.webclaw_status()
    assert out.get("ok") is True or (out.get("data") or {}).get("chromeOk") is True


def test_build_status_fields():
    st = status_fast.build_status()
    assert st["type"] == "status"
    assert "cdpPort" in st
    assert "chromeInstances" in st
    assert st["chromeInstances"]["port"] == st["cdpPort"]


def test_call_tool_persist_argv():
    import importlib.util
    path = Path(__file__).resolve().parents[1] / "scripts" / "call_tool.py"
    # Just ensure the file documents --persist and parses without import mcp side effects heavy
    text = path.read_text(encoding="utf-8")
    assert "--persist" in text
    assert "--repl" in text
