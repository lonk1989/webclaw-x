"""Verb cookbook must ship for every Host (install + MCP startup)."""
from __future__ import annotations

from pathlib import Path

from webclaw_x.recipe_verbs_doc import RECIPE_VERBS_MD, write_recipe_verbs_doc


def test_recipe_verbs_md_maps_open_to_run():
    assert "webclaw_run" in RECIPE_VERBS_MD
    assert "打开" in RECIPE_VERBS_MD
    assert "accounts" in RECIPE_VERBS_MD.lower() or "保险箱" in RECIPE_VERBS_MD


def test_write_recipe_verbs_doc(tmp_path: Path):
    out = write_recipe_verbs_doc(tmp_path / "mcp")
    assert out.name == "RECIPE-VERBS.md"
    text = out.read_text(encoding="utf-8")
    assert "webclaw_run" in text
    assert "打开" in text
