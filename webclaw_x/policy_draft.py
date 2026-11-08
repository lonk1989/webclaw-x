"""Draft navigation policy.json from pasted hosts — never auto-enable the world."""

from __future__ import annotations

import json
import re
from typing import Iterable
from urllib.parse import urlparse


def normalize_host(raw: str) -> str | None:
    s = (raw or "").strip().lower().rstrip(".")
    if not s:
        return None
    if "://" not in s and "/" not in s and " " not in s:
        host = s
    else:
        if "://" not in s:
            s = "https://" + s
        try:
            host = (urlparse(s).hostname or "").lower().rstrip(".")
        except ValueError:
            return None
    if not host or host in ("*", "*.*", "0.0.0.0"):
        return None
    # No wildcard support in runtime policy — reject obvious globs.
    if "*" in host or "?" in host:
        return None
    if not re.match(r"^[a-z0-9._-]+$", host):
        return None
    return host


def hosts_from_text(text: str) -> list[str]:
    parts = re.split(r"[\s,;]+", text or "")
    out: list[str] = []
    seen: set[str] = set()
    for p in parts:
        h = normalize_host(p)
        if h and h not in seen:
            seen.add(h)
            out.append(h)
    return out


def draft_policy(
    hosts: Iterable[str] | str,
    *,
    allow_localhost: bool = True,
    enabled: bool = True,
) -> dict:
    if isinstance(hosts, str):
        allowed = hosts_from_text(hosts)
    else:
        allowed = []
        seen: set[str] = set()
        for item in hosts:
            for h in hosts_from_text(str(item)):
                if h not in seen:
                    seen.add(h)
                    allowed.append(h)
    return {
        "enabled": bool(enabled),
        "allow_localhost": bool(allow_localhost),
        "allowed_hosts": allowed,
        "_comment": "DRAFT — review hosts, then copy to $WEBCLAW_HOME/policy.json. "
        "Do not set WEBCLAW_POLICY_ENABLED=0 to bypass. Exact host match only (no wildcards).",
    }


def draft_json(hosts: Iterable[str] | str, **kwargs) -> str:
    body = draft_policy(hosts, **kwargs)
    # Strip helper comment key for on-disk example compatibility? Keep it for humans.
    return json.dumps(body, ensure_ascii=False, indent=2) + "\n"


__all__ = ["normalize_host", "hosts_from_text", "draft_policy", "draft_json"]
