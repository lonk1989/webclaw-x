"""Host-side status hot path: no webclaw-lite spawn.

Probes binary, Chrome exe, CDP HTTP readiness, and Chrome instance uniqueness
via /proc (Linux) — same fields Hosts need for readiness without paying lite cold start.
"""

from __future__ import annotations

import os
import socket
import urllib.error
import urllib.request
from pathlib import Path

from webclaw_x.lite_bin import resolve_lite_bin

_DEFAULT_PORT = 19222
_PRODUCT_VERSION = "0.1.22"  # keep in sync with runtime/Cargo.toml; overridden if bin --version later


def cdp_port() -> int:
    raw = os.environ.get("WEBCLAW_CDP_PORT", "").strip()
    if raw.isdigit():
        return int(raw)
    return _DEFAULT_PORT


def find_chrome_bin() -> str | None:
    env = os.environ.get("WEBCLAW_CHROME", "").strip()
    if env and Path(env).is_file():
        return env
    for cand in (
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/usr/bin/microsoft-edge",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ):
        if Path(cand).is_file():
            return cand
    return None


def probe_cdp_ready(port: int, timeout: float = 0.35) -> bool:
    url = f"http://127.0.0.1:{port}/json/version"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return 200 <= getattr(resp, "status", 200) < 300
    except (urllib.error.URLError, TimeoutError, socket.timeout, OSError):
        return False


def _listener_pids(port: int) -> list[int]:
    """Best-effort: parse `ss -ltnp` for userspace listeners on port."""
    import re
    import subprocess

    try:
        out = subprocess.run(
            ["ss", "-ltnp"],
            capture_output=True,
            text=True,
            timeout=2,
            check=False,
        ).stdout
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return []
    pids: list[int] = []
    needle = f":{port} "
    for line in out.splitlines():
        if needle not in line and not line.rstrip().endswith(f":{port}"):
            # also match *:port or 127.0.0.1:port
            if f":{port}" not in line:
                continue
        for m in re.finditer(r"pid=(\d+)", line):
            pids.append(int(m.group(1)))
    return sorted(set(pids))


def _top_level_debug_chrome_pids(port: int) -> list[int]:
    needle = f"--remote-debugging-port={port}"
    out: list[int] = []
    proc = Path("/proc")
    if not proc.is_dir():
        return out
    try:
        entries = list(proc.iterdir())
    except OSError:
        return out
    for ent in entries:
        name = ent.name
        if not name.isdigit():
            continue
        try:
            raw = (ent / "cmdline").read_bytes()
        except OSError:
            continue
        if not raw:
            continue
        joined = raw.decode("utf-8", "replace")
        cmd = joined.replace("\0", " ")
        lower = cmd.lower()
        is_chrome = "chrome" in lower or "chromium" in lower or "msedge" in lower
        if not is_chrome or needle not in cmd:
            continue
        is_helper = (
            any(a.startswith("--type=") for a in joined.split("\0"))
            or " --type=" in lower
            or "/chrome --type=" in lower
            or "/chromium --type=" in lower
        )
        if is_helper:
            continue
        out.append(int(name))
    return sorted(set(out))


def inspect_chrome(port: int, cdp_ready: bool) -> dict:
    listeners = _listener_pids(port)
    top = _top_level_debug_chrome_pids(port)
    top_n, listen_n = len(top), len(listeners)
    orphan = top_n > listen_n or top_n > 1
    warn = None
    if orphan:
        warn = (
            f"检测到 {top_n} 个带 --remote-debugging-port={port} 的顶层 Chrome，"
            f"监听 {listen_n} 个；可能有孤儿进程（chromeOk 只表示二进制存在，不代表实例唯一；"
            f"实例就绪看 cdpReady）"
        )
    elif top_n == 0 and listen_n > 0:
        warn = (
            f"端口 {port} 有 {listen_n} 个监听，但顶层 Chrome 枚举为空"
            f"（Windows 上若 wmic/CIM 不可用会降级；chromeOk=二进制存在，cdpReady=调试口可连）"
        )
    return {
        "port": port,
        "cdpReady": cdp_ready,
        "listenerPids": listeners,
        "topLevelPids": top,
        "topLevel": top_n,
        "listeners": listen_n,
        "orphanRisk": orphan,
        **({"warn": warn} if warn else {}),
    }


def build_status(*, repo_root: Path | None = None, deep: bool = False) -> dict:
    """Return lite-compatible status object for Host envelope data."""
    bin_path = resolve_lite_bin(repo_root)
    chrome = find_chrome_bin()
    port = cdp_port()
    ready = probe_cdp_ready(port)
    inspect = inspect_chrome(port, ready)
    home = os.environ.get("WEBCLAW_HOME", str(Path.home() / ".webclaw"))
    status = {
        "type": "status",
        "product": "webclaw-lite",
        "version": _PRODUCT_VERSION,
        "home": home,
        "bin": str(bin_path) if bin_path.is_file() else str(bin_path),
        "chrome": chrome,
        "chromeOk": bool(chrome),
        "cdpPort": port,
        "cdpReady": ready,
        "chromeInstances": inspect,
        "skillProvider": "local",
        "corpSignedIn": False,
        "corpUser": None,
        "waitingHuman": False,
        "needHuman": None,
        "lastNeedHuman": None,
        "inboxImage": None,
        "statusSource": "host_fast",
    }
    if inspect.get("warn"):
        status["chromeWarn"] = inspect["warn"]
    if deep:
        # Placeholder: deep fields (active HITL) still need lite / daemon in phase-2.
        status["statusSource"] = "host_fast_shallow"
    return status


__all__ = [
    "build_status",
    "cdp_port",
    "find_chrome_bin",
    "inspect_chrome",
    "probe_cdp_ready",
]
