"""Redact secrets from MCP tool results before they leave the gateway."""

from __future__ import annotations

import json
import re
from typing import Any

# Keys / patterns that must never appear in tool responses.
_SECRET_KEY_RE = re.compile(
    r"(password|passwd|pwd|secret|token|api[_-]?key|authorization|captcha|verify[_-]?code|验证码|密码)",
    re.IGNORECASE,
)

# Inline patterns: password=xxx, 密码=xxx, captcha: 1234, etc.
_INLINE_SECRET_RE = re.compile(
    r"(?i)((?:password|passwd|pwd|secret|token|api[_-]?key|authorization|captcha|verify[_-]?code|"
    r"密码|验证码)\s*[=:：]\s*)([^\s,;，；\"']+)"
)

_REDACTED = "***REDACTED***"


def scrub_text(text: str) -> str:
    if not text:
        return text
    return _INLINE_SECRET_RE.sub(lambda m: m.group(1) + _REDACTED, text)


def scrub_obj(obj: Any) -> Any:
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if _SECRET_KEY_RE.search(str(k)):
                out[k] = _REDACTED
            else:
                out[k] = scrub_obj(v)
        return out
    if isinstance(obj, list):
        return [scrub_obj(x) for x in obj]
    if isinstance(obj, str):
        return scrub_text(obj)
    return obj


def scrub_json_str(s: str) -> str:
    try:
        obj = json.loads(s)
    except (json.JSONDecodeError, TypeError):
        return scrub_text(s)
    return json.dumps(scrub_obj(obj), ensure_ascii=False)
