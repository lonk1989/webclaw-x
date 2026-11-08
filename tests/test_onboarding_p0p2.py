"""Onboarding P0–P2: core7 tools, policy draft, install script presence."""
from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def test_install_script_exists_and_prefers_prebuilt():
    script = (ROOT / "scripts" / "install_webclaw.sh").read_text(encoding="utf-8")
    assert "precompiled" in script.lower() or "预编译" in script or "install.sh" in script
    assert "mcp.json" in script or "cursor.mcp.json" in script
    assert "build_runtime" in script  # mentions cargo only as tip


def test_policy_draft_normalizes_hosts():
    from webclaw_x.policy_draft import draft_policy, hosts_from_text, normalize_host

    assert normalize_host("https://App.Example.com/path") == "app.example.com"
    assert normalize_host("*") is None
    assert "a.com" in hosts_from_text("a.com, https://b.com/x")
    d = draft_policy("login.example.com, app.example.com")
    assert d["enabled"] is True
    assert d["allow_localhost"] is True
    assert d["allowed_hosts"] == ["login.example.com", "app.example.com"]
    assert "_comment" in d


def test_policy_draft_cli(tmp_path):
    import subprocess
    import sys

    out = tmp_path / "policy.json.draft"
    r = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "policy_draft.py"),
         "--hosts", "x.example.com", "--out", str(out)],
        capture_output=True, text=True, check=True,
    )
    body = json.loads(out.read_text(encoding="utf-8"))
    assert body["allowed_hosts"] == ["x.example.com"]
    assert "review" in (r.stderr or "").lower() or "审阅" in (r.stderr or "") or out.exists()


def test_tools_mode_core_filters(monkeypatch):
    monkeypatch.setenv("WEBCLAW_TOOLS", "core")
    # Re-import pattern: call apply on a fresh FastMCP-like object via real module helpers
    from webclaw_x.tools_mode import CORE_TOOL_NAMES, apply_tool_visibility, tools_mode

    assert tools_mode() == "core"
    assert "webclaw_status" in CORE_TOOL_NAMES
    assert len(CORE_TOOL_NAMES) == 7

    # Importing server applies filter at import time — check registered names
    import importlib
    import webclaw_x.server as gw
    importlib.reload(gw)
    names = {t.name for t in gw.mcp._tool_manager.list_tools()}
    assert names == set(CORE_TOOL_NAMES)
    assert "webclaw_recipe_list" not in names
    assert "webclaw_policy_draft" not in names


def test_tools_mode_all_keeps_policy_draft(monkeypatch):
    monkeypatch.setenv("WEBCLAW_TOOLS", "all")
    import importlib
    import webclaw_x.server as gw
    importlib.reload(gw)
    names = {t.name for t in gw.mcp._tool_manager.list_tools()}
    assert "webclaw_status" in names
    assert "webclaw_recipe_list" in names
    assert "webclaw_policy_draft" in names
    assert len(names) >= 17


def test_skill_is_one_pager_with_checklist():
    skill = (ROOT / "skills" / "SKILL.md").read_text(encoding="utf-8")
    assert "新助手 1 页" in skill or "1 页上手" in skill
    assert "真业务 checklist" in skill
    assert "禁逐步 probe" in skill
    assert "policy" in skill.lower()
    assert "params_confirmed" in skill
    assert "WEBCLAW_CHROME_RECYCLE" in skill
    assert "install_webclaw.sh" in skill
    # Discourage stacking companion/lite skills
    assert "勿叠读" in skill or "不要" in skill


def test_readme_precompiled_default():
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    assert "预编译" in readme
    assert "install_webclaw.sh" in readme
    assert "附录：开发者从源码编 lite" in readme or "附录" in readme
    # First install heading block should push install_webclaw before cargo appendix
    install_idx = readme.find("## 安装")
    cargo_idx = readme.find("build_runtime.sh")
    assert install_idx != -1 and cargo_idx != -1
    assert readme.find("install_webclaw.sh") < cargo_idx


def test_fast_card_mentions_core7_and_profile():
    from webclaw_x.fast_card import FAST_CARD
    assert "core7" in FAST_CARD or "核心工具" in FAST_CARD
    assert "WEBCLAW_TOOLS" in FAST_CARD
    assert "RECYCLE" in FAST_CARD or "复用" in FAST_CARD
