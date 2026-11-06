"""Unified error codes for the webclaw-x MCP contract."""

from __future__ import annotations

from enum import Enum


class ErrorCode(str, Enum):
    OK = "OK"
    BINARY_MISSING = "BINARY_MISSING"
    TIMEOUT = "TIMEOUT"
    INVALID_ARGS = "INVALID_ARGS"
    RECIPE_MISSING = "RECIPE_MISSING"
    RUN_FAILED = "RUN_FAILED"
    AMBIGUOUS_TARGET = "AMBIGUOUS_TARGET"
    NEED_HUMAN = "NEED_HUMAN"
    POLICY_DENIED = "POLICY_DENIED"
    RUN_BUSY = "RUN_BUSY"
    NO_ACTIVE_HUMAN = "NO_ACTIVE_HUMAN"
    HITL_SKIPPED = "HITL_SKIPPED"
    PROBE_FAILED = "PROBE_FAILED"
    FREEZE_FAILED = "FREEZE_FAILED"
    INTERNAL = "INTERNAL"
    NOT_SUPPORTED = "NOT_SUPPORTED"


def envelope(
    *,
    ok: bool,
    code: ErrorCode | str,
    message: str = "",
    data: dict | None = None,
    **extra,
) -> dict:
    out = {
        "ok": ok,
        "code": code.value if isinstance(code, ErrorCode) else str(code),
        "message": message,
        "data": data if data is not None else {},
    }
    out.update(extra)
    return out
