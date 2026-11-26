"""Control-plane status + reset (no browser)."""
from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from webclaw_x import jobs, status_fast


@pytest.fixture
def home(tmp_path, monkeypatch):
    monkeypatch.setenv("WEBCLAW_HOME", str(tmp_path))
    (tmp_path / "jobs").mkdir()
    (tmp_path / "control").mkdir()
    (tmp_path / "runs").mkdir()
    return tmp_path


def test_inspect_control_plane_idle(home):
    snap = jobs.inspect_control_plane(home)
    assert snap["busy"] is False
    assert snap["activeRun"] is None
    assert snap["waitingHuman"] is False
    assert snap["needHuman"] is None
    assert snap["cancelMarkerPresent"] is False


def test_status_reports_cancel_marker(home):
    (home / "control" / "cancel").write_text("1", encoding="utf-8")
    status = status_fast.build_status()
    assert status["cancelMarkerPresent"] is True
    assert status["busy"] is False


def test_reset_soft_clears_marker_and_orphan_hitl(home):
    (home / "control" / "cancel").write_text("1", encoding="utf-8")
    run = home / "runs" / "abandoned"
    human = run / "human"
    human.mkdir(parents=True)
    (human / "waiting_human.json").write_text(
        json.dumps({"prompt_id": "p1", "kind": "captcha"}), encoding="utf-8"
    )
    (run / "live-preview.png").write_bytes(b"\x89PNG\r\n\x1a\n")

    out = jobs.reset_home(home, hard=False)
    assert out["ok"] is True
    assert out["code"] == "OK"
    assert not (home / "control" / "cancel").exists()
    assert not (human / "waiting_human.json").exists()
    after = out["after"]
    assert after["busy"] is False
    assert after["cancelMarkerPresent"] is False


def test_build_status_merges_control_fields(home):
    status = status_fast.build_status()
    assert "busy" in status
    assert "activeRun" in status
    assert "waitingHuman" in status
    assert "cancelMarkerPresent" in status
    assert status["statusSource"] == "host_fast"


def test_preview_paths_under_home(home):
    run = home / "runs" / "r1"
    human = run / "human"
    human.mkdir(parents=True)
    live = run / "live-preview.png"
    cap = human / "captcha.png"
    live.write_bytes(b"x")
    cap.write_bytes(b"y")
    preview = status_fast._preview_paths(home, str(run))
    assert preview["livePreviewPath"] == str(live.resolve())
    assert preview["captchaPath"] == str(cap.resolve())
