"""Client for `webclaw-lite serve` (phase-2: ping/status/prewarm/run/cancel).

Host MCP still defaults to subprocess CLI for run (jobs + cancel contract).
This client is for local daemon experiments and future Host opt-in.
Set WEBCLAW_LITE_SOCKET or default ~/.webclaw/lite.sock.
Windows: serve not ready.
"""

from __future__ import annotations

import json
import os
import socket
from pathlib import Path


def default_socket_path() -> Path:
    env = os.environ.get("WEBCLAW_LITE_SOCKET", "").strip()
    if env:
        return Path(env)
    home = os.environ.get("WEBCLAW_HOME", str(Path.home() / ".webclaw"))
    return Path(home) / "lite.sock"


def call(op: str, timeout: float = 5.0, **extra) -> dict | None:
    """Return response dict, or None if socket missing / unreachable."""
    path = default_socket_path()
    if not path.exists():
        return None
    payload = {"op": op, **extra}
    # run may take minutes; allow override via timeout arg
    if op == "run" and timeout < 60:
        timeout = float(os.environ.get("WEBCLAW_RUN_TIMEOUT_MS", "600000")) / 1000.0
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as sock:
            sock.settimeout(timeout)
            sock.connect(str(path))
            sock.sendall((json.dumps(payload, ensure_ascii=False) + "\n").encode())
            buf = b""
            while b"\n" not in buf:
                chunk = sock.recv(65536)
                if not chunk:
                    break
                buf += chunk
        if not buf:
            return None
        return json.loads(buf.decode().splitlines()[0])
    except (OSError, json.JSONDecodeError, TimeoutError):
        return None


__all__ = ["call", "default_socket_path"]
