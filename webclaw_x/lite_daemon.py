"""Client for `webclaw-lite serve` (phase-2: ping/status/prewarm/run/cancel/human-reply/collect).

Host MCP defaults to subprocess CLI for run (jobs + cancel streaming contract).
Opt-in: set WEBCLAW_LITE_USE_SERVE=1 to prefer the daemon when reachable; on
failure (missing endpoint / connect error) callers must fall back to CLI once
(never retry the same business run on both paths).

Transports:
- Unix: AF_UNIX to WEBCLAW_LITE_SOCKET or <WEBCLAW_HOME>/lite.sock
- Windows: loopback TCP; endpoint JSON file at the same path (written by serve)

Host run uses early_hitl=true so NEED_HUMAN returns before done; resume via
human-reply (serve op) which waits for collect.
"""

from __future__ import annotations

import json
import os
import socket
import sys
from pathlib import Path


def use_serve_opt_in() -> bool:
    v = (os.environ.get("WEBCLAW_LITE_USE_SERVE") or "").strip().lower()
    return v in ("1", "true", "yes", "on")


def default_socket_path() -> Path:
    env = os.environ.get("WEBCLAW_LITE_SOCKET", "").strip()
    if env:
        return Path(env)
    home = os.environ.get("WEBCLAW_HOME", str(Path.home() / ".webclaw"))
    return Path(home) / "lite.sock"


def _read_windows_endpoint(path: Path) -> tuple[str, int] | None:
    try:
        raw = path.read_text(encoding="utf-8").strip()
    except OSError:
        return None
    if not raw:
        return None
    try:
        data = json.loads(raw.splitlines()[0])
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict) or data.get("transport") != "tcp":
        return None
    host = data.get("host") or "127.0.0.1"
    port = data.get("port")
    if not isinstance(port, int) or port <= 0:
        return None
    return str(host), int(port)


def call(op: str, timeout: float = 5.0, **extra) -> dict | None:
    """Return response dict, or None if endpoint missing / unreachable."""
    path = default_socket_path()
    payload = {"op": op, **extra}
    if op == "run" and timeout < 60:
        timeout = float(os.environ.get("WEBCLAW_RUN_TIMEOUT_MS", "600000")) / 1000.0
    data = (json.dumps(payload, ensure_ascii=False) + "\n").encode()

    try:
        if sys.platform == "win32":
            ep = _read_windows_endpoint(path)
            if ep is None:
                return None
            host, port = ep
            with socket.create_connection((host, port), timeout=timeout) as sock:
                sock.settimeout(timeout)
                sock.sendall(data)
                buf = b""
                while b"\n" not in buf:
                    chunk = sock.recv(65536)
                    if not chunk:
                        break
                    buf += chunk
        else:
            if not path.exists():
                return None
            with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as sock:
                sock.settimeout(timeout)
                sock.connect(str(path))
                sock.sendall(data)
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


__all__ = ["call", "default_socket_path", "use_serve_opt_in"]
