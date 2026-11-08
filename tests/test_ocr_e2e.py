"""OCR e2e: vision assert + captcha try-fill against local fixture site.

Requires RapidOCR models under ~/.local/share/webclaw/ocr-models (ppocrv6-small)
and WEBCLAW_LITE_BIN. Not a mock: real lite + Chrome + ONNX OCR.
"""
from __future__ import annotations

import json
import os
import socket
import subprocess
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "fixtures" / "site"
LITE = Path(os.environ.get("WEBCLAW_LITE_BIN", Path.home() / ".webclaw/bin/webclaw-lite"))
OCR_DIR = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local/share")) / "webclaw" / "ocr-models"
MODELS = [
    "PP-OCRv6_det_small.onnx",
    "PP-OCRv6_rec_small.onnx",
    "ch_ppocr_mobile_v2.0_cls_mobile.onnx",
    "ppocrv6_dict.txt",
]


def _models_ready() -> bool:
    return all((OCR_DIR / n).is_file() for n in MODELS)


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="module")
def http_fixture():
    port = _free_port()
    handler = partial(SimpleHTTPRequestHandler, directory=str(SITE))
    httpd = ThreadingHTTPServer(("127.0.0.1", port), handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    for _ in range(50):
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                break
        except OSError:
            time.sleep(0.05)
    yield f"http://127.0.0.1:{port}"
    httpd.shutdown()


def _run_lite(recipe_text: str, *, env_extra: dict[str, str] | None = None, timeout: int = 150) -> list[dict]:
    home = Path(os.environ.get("WEBCLAW_HOME", str(Path.home() / ".webclaw")))
    recipe_path = home / "recipes" / f"_pytest-ocr-{int(time.time()*1000)}.webclaw"
    recipe_path.parent.mkdir(parents=True, exist_ok=True)
    recipe_path.write_text(recipe_text + "\n", encoding="utf-8")
    env = os.environ.copy()
    env["WEBCLAW_HOME"] = str(home)
    env["WEBCLAW_HEADLESS"] = "1"
    if env_extra:
        env.update(env_extra)
    proc = subprocess.run(
        [str(LITE), "run", "--recipe", str(recipe_path), "--title", "pytest-ocr"],
        capture_output=True,
        text=True,
        env=env,
        timeout=timeout,
        check=False,
    )
    events = []
    for line in (proc.stdout or "").splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            pass
    return events


def _done(events: list[dict]) -> dict | None:
    for ev in reversed(events):
        if ev.get("type") == "done":
            return ev
    return None


def _logs(events: list[dict]) -> str:
    return "\n".join(e.get("message", "") for e in events if e.get("type") == "log")


pytestmark = [
    pytest.mark.skipif(not LITE.is_file(), reason="webclaw-lite missing"),
    pytest.mark.skipif(not _models_ready(), reason="OCR models not cached"),
    pytest.mark.skipif(not (SITE / "captcha-K7M2.png").is_file(), reason="captcha fixture png missing"),
]


def test_vision_assert_positive(http_fixture):
    recipe = f"打开{http_fixture}/table.html，等待文字加油记录5，断言画面含加油记录"
    events = _run_lite(recipe, env_extra={"WEBCLAW_VISION_ASSERT": "1"})
    done = _done(events)
    assert done is not None, events[-5:]
    assert done.get("fail", 1) == 0
    assert "画面断言通过" in _logs(events)
    ar = done.get("assert_report")
    assert ar and "断言报告-" in str(ar) and Path(ar).is_file(), done


def test_vision_assert_miss_fails(http_fixture):
    recipe = f"打开{http_fixture}/table.html，等待文字加油记录5，断言画面含绝不可能出现的词XYZ999"
    events = _run_lite(recipe, env_extra={"WEBCLAW_VISION_ASSERT": "1"})
    done = _done(events)
    assert done is not None
    assert done.get("fail", 0) >= 1
    assert "画面断言失败" in _logs(events) or "未找到" in (done.get("error") or "")


def test_vision_assert_gate_off(http_fixture):
    recipe = f"打开{http_fixture}/table.html，等待文字加油记录5，断言画面含加油记录"
    env = {"WEBCLAW_VISION_ASSERT": "0"}
    # ensure unset-like behavior
    events = _run_lite(recipe, env_extra=env)
    done = _done(events)
    assert done is not None
    assert done.get("fail", 0) >= 1
    blob = (done.get("error") or "") + "\n" + _logs(events)
    assert "画面断言未开启" in blob
    assert "加油记录" in blob  # needle in gate message, not hardcoded 登录


def test_captcha_ocr_tryfill(http_fixture):
    recipe = (
        f"打开{http_fixture}/login.html，等待文字验证码5，"
        f"输入账号=demo，输入密码=demo，点击登录，等待文字加油记录8"
    )
    # Opt into auto-submit: default OCR is fill-only (no click) to avoid burning retries.
    events = _run_lite(
        recipe,
        timeout=180,
        env_extra={"WEBCLAW_CAPTCHA_OCR_SUBMIT": "1"},
    )
    done = _done(events)
    assert done is not None, _logs(events)[-500:]
    assert done.get("fail", 1) == 0
    logs = _logs(events)
    assert "验证码 OCR 试填：K7M2" in logs
    assert "OCR_OK" in logs or "conf=" in logs
    assert ("验证码已通过" in logs) or ("登录成功" in logs)


def test_vision_assert_region_gate_uses_needle(http_fixture):
    """Region syntax: gate-off error must echo the real needle (not hardcoded 登录)."""
    recipe = f"打开{http_fixture}/table.html，等待文字加油记录5，断言画面含标题 区域1,2,3,4"
    events = _run_lite(recipe, env_extra={"WEBCLAW_VISION_ASSERT": "0"}, timeout=90)
    done = _done(events)
    assert done is not None
    blob = (done.get("error") or "") + "\n" + _logs(events)
    assert "画面断言未开启" in blob and "标题" in blob
