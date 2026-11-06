"""Redact secrets from MCP tool results before they leave the gateway."""

from __future__ import annotations

import json
import re
import threading
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
_known_values: set[str] = set()
_lock = threading.RLock()

def remember_sensitive(value: str) -> None:
    """In-memory only: redact even unlabeled echoes of an explicit human reply."""
    if value:
        with _lock:
            _known_values.add(value)



def scrub_text(text: str) -> str:
    if not text:
        return text
    with _lock:
        values = tuple(_known_values)
    for value in sorted(values, key=len, reverse=True):
        text = text.replace(value, _REDACTED)
    # Decode the entire JSON first: pretty-printed objects span several lines.
    # JSONL still falls back to per-line decoding below.
    try:
        value = json.loads(text)
    except ValueError:
        value = None
    if isinstance(value, (dict, list)):
        return json.dumps(scrub_obj(value), ensure_ascii=False)
    # Decode embedded JSON/JSONL so quoted password/OTP keys cannot escape.
    lines = []
    for line in text.splitlines(keepends=True):
        try:
            value = json.loads(line)
        except ValueError:
            value = None
        if isinstance(value, (dict, list)):
            line = json.dumps(scrub_obj(value), ensure_ascii=False) + ('\n' if line.endswith('\n') else '')
        lines.append(line)
    return _INLINE_SECRET_RE.sub(lambda m: m.group(1) + _REDACTED, ''.join(lines))


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
