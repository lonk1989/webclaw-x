"""Optional Chrome prewarm for MCP session start (WEBCLAW_PREWARM=1).

Does not change default semantics: off unless env set. Prefers `webclaw-lite prewarm`
(same profile/port as runtime); falls back to a direct Chrome launch if binary missing.
"""

from __future__ import annotations

import os
import subprocess
import threading
import time
from pathlib import Path

from webclaw_x.lite_bin import resolve_lite_bin
from webclaw_x.status_fast import cdp_port, find_chrome_bin, probe_cdp_ready


def _profile_dir() -> Path:
    home = Path(os.environ.get("WEBCLAW_HOME", str(Path.home() / ".webclaw")))
    return home / "chrome-debug"


def _headless() -> bool:
    v = os.environ.get("WEBCLAW_HEADLESS", "1").strip().lower()
    return v not in ("0", "false", "no", "off")


def launch_via_lite() -> tuple[bool, str]:
    bin_path = resolve_lite_bin()
    if not bin_path.is_file():
        return False, f"lite missing: {bin_path}"
    env = os.environ.copy()
    env["WEBCLAW_LITE"] = "1"
    env.setdefault("WEBCLAW_HOME", str(Path.home() / ".webclaw"))
    try:
        proc = subprocess.run(
            [str(bin_path), "prewarm"],
            capture_output=True,
            text=True,
            timeout=45,
            env=env,
        )
    except (OSError, subprocess.TimeoutExpired) as e:
        return False, str(e)
    if proc.returncode == 0:
        return True, (proc.stdout or "").strip()[-500:] or "lite prewarm ok"
    return False, (proc.stderr or proc.stdout or f"exit {proc.returncode}")[-500:]


def launch_debug_chrome_direct() -> tuple[bool, str]:
    port = cdp_port()
    if probe_cdp_ready(port):
        return True, f"cdp already ready on {port}"
    chrome = find_chrome_bin()
    if not chrome:
        return False, "WEBCLAW_CHROME / Chrome binary not found"
    profile = _profile_dir()
    profile.mkdir(parents=True, exist_ok=True)
    args = [
        chrome,
        f"--remote-debugging-port={port}",
        "--remote-allow-origins=*",
        f"--user-data-dir={profile}",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-popup-blocking",
        "--site-per-process",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "about:blank",
    ]
    if _headless():
        args.insert(1, "--headless=new")
        args.extend(["--window-size=1280,900", "--force-device-scale-factor=1"])
    try:
        subprocess.Popen(
            args,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    except OSError as e:
        return False, str(e)
    deadline = time.time() + 15
    while time.time() < deadline:
        if probe_cdp_ready(port):
            return True, f"prewarmed chrome on {port}"
        time.sleep(0.2)
    return False, f"timeout waiting for cdp on {port}"


def launch_debug_chrome() -> tuple[bool, str]:
    port = cdp_port()
    if probe_cdp_ready(port):
        return True, f"cdp already ready on {port}"
    ok, msg = launch_via_lite()
    if ok:
        return ok, msg
    # Fallback if lite not rebuilt yet
    ok2, msg2 = launch_debug_chrome_direct()
    if ok2:
        return True, f"direct fallback after lite miss ({msg}): {msg2}"
    return False, f"lite={msg}; direct={msg2}"


def maybe_start_background() -> None:
    """If WEBCLAW_PREWARM=1, kick a daemon thread to ensure CDP is up."""
    flag = os.environ.get("WEBCLAW_PREWARM", "").strip().lower()
    if flag not in ("1", "true", "yes", "on"):
        return

    def _run() -> None:
        try:
            ok, msg = launch_debug_chrome()
            print(f"[webclaw-x prewarm] {'ok' if ok else 'fail'}: {msg}", flush=True)
        except Exception as e:  # noqa: BLE001
            print(f"[webclaw-x prewarm] error: {e}", flush=True)

    threading.Thread(target=_run, name="webclaw-prewarm", daemon=True).start()


__all__ = ["launch_debug_chrome", "maybe_start_background"]
