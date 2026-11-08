"""MCP tool surface: default core7, full set via WEBCLAW_TOOLS=all."""

from __future__ import annotations

import os

# Iron-path tools for a new agent session (matches Skill / fast_card).
CORE_TOOL_NAMES: frozenset[str] = frozenset(
    {
        "webclaw_status",
        "webclaw_run",
        "webclaw_probe",
        "webclaw_freeze",
        "webclaw_list_recipes",
        "webclaw_human_reply",
        "webclaw_cancel",
    }
)


def tools_mode() -> str:
    raw = (os.environ.get("WEBCLAW_TOOLS") or "core").strip().lower()
    if raw in ("all", "full", "17", "*"):
        return "all"
    return "core"


def apply_tool_visibility(mcp) -> str:
    """Remove non-core tools from FastMCP when mode is core. Returns mode."""
    mode = tools_mode()
    if mode == "all":
        return mode
    for info in list(mcp._tool_manager.list_tools()):  # noqa: SLF001 — intentional filter
        name = info.name
        if name not in CORE_TOOL_NAMES:
            try:
                mcp.remove_tool(name)
            except Exception:  # noqa: BLE001
                pass
    return mode


__all__ = ["CORE_TOOL_NAMES", "tools_mode", "apply_tool_visibility"]
