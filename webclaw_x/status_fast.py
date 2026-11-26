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


def _preview_paths(home: str | Path, run_dir: str | None) -> dict:
    """Best-effort live/captcha paths under WEBCLAW_HOME for agent/user visibility."""
    if not run_dir:
        return {}
    try:
        rd = Path(run_dir)
        home_path = Path(home).resolve()
        if not rd.is_absolute():
            rd = home_path / "runs" / run_dir
        rd = rd.resolve()
        if not rd.is_relative_to(home_path):
            return {"runDir": str(run_dir)}
    except (OSError, ValueError):
        return {"runDir": str(run_dir)}
    out: dict = {"runDir": str(rd)}
    live = rd / "live-preview.png"
    captcha = rd / "human" / "captcha.png"
    if live.is_file():
        out["livePreviewPath"] = str(live)
    if captcha.is_file():
        out["captchaPath"] = str(captcha)
    return out


def build_status(*, repo_root: Path | None = None, deep: bool = False) -> dict:
    """Return lite-compatible status object for Host envelope data."""
    bin_path = resolve_lite_bin(repo_root)
    chrome = find_chrome_bin()
    port = cdp_port()
    ready = probe_cdp_ready(port)
    inspect = inspect_chrome(port, ready)
    home = os.environ.get("WEBCLAW_HOME", str(Path.home() / ".webclaw"))
    # Control-plane: jobs + HITL + cancel marker (no lite spawn).
    try:
        from webclaw_x import jobs as jobs_mod

        control = jobs_mod.inspect_control_plane(home)
    except Exception:  # noqa: BLE001 — status must never crash the gateway
        control = {
            "busy": False,
            "activeRun": None,
            "waitingHuman": False,
            "needHuman": None,
            "cancelMarkerPresent": (Path(home) / "control" / "cancel").is_file(),
        }
    need = control.get("needHuman")
    preview = _preview_paths(home, (need or {}).get("run_dir") if isinstance(need, dict) else None)
    inbox = preview.get("captchaPath") or preview.get("livePreviewPath")
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
        "busy": bool(control.get("busy")),
        "activeRun": control.get("activeRun"),
        "waitingHuman": bool(control.get("waitingHuman")),
        "needHuman": need,
        "cancelMarkerPresent": bool(control.get("cancelMarkerPresent")),
        "lastNeedHuman": None,
        "inboxImage": inbox,
        "preview": preview or None,
        "statusSource": "host_fast",
    }
    if inspect.get("warn"):
        status["chromeWarn"] = inspect["warn"]
    if deep:
        status["statusSource"] = "host_fast_control"
    return status


__all__ = [
    "build_status",
    "cdp_port",
    "find_chrome_bin",
    "inspect_chrome",
    "probe_cdp_ready",
    "_preview_paths",
]
