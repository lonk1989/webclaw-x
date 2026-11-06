#!/usr/bin/env python3
"""P1 Component Pack eval: date-range / select / pager on local fixture."""

from __future__ import annotations

import asyncio
import json
import os
import socket
import sys
import threading
import time
from datetime import datetime
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "eval" / "out"
FIXTURE = ROOT / "fixtures" / "site"
sys.path.insert(0, str(ROOT))

from webclaw_x import server as gw  # noqa: E402
from webclaw_x.errors import ErrorCode  # noqa: E402


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    home = Path(f"/tmp/webclaw-x-components-{stamp}")
    for sub in ("bin", "recipes", "runs", "jobs"):
        (home / sub).mkdir(parents=True, exist_ok=True)

    bin_path = os.environ.get("WEBCLAW_LITE_BIN") or str(Path.home() / ".webclaw" / "bin" / "webclaw-lite")
    os.environ["WEBCLAW_HOME"] = str(home)
    os.environ["WEBCLAW_LITE_BIN"] = bin_path
    os.environ.setdefault("WEBCLAW_HEADLESS", "1")
    gw.HOME = home
    gw.BINARY = bin_path

    # Seed builtins into fresh home
    json.loads(gw.webclaw_install())
    json.loads(gw.webclaw_status())

    port = _free_port()
    httpd = ThreadingHTTPServer(
        ("127.0.0.1", port),
        partial(SimpleHTTPRequestHandler, directory=str(FIXTURE)),
    )
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    time.sleep(0.15)
    base = f"http://127.0.0.1:{port}"

    recipe = (
        f"打开{base}/components.html，等待2，"
        f"选择日期范围 2026-01-01至2026-11-06，"
        f"选择下拉 状态=已完成，"
        f"翻页下一页，"
        f"翻到第3页，"
        f"采集表格"
    )
    cases = []
    try:
        out = json.loads(
            asyncio.run(gw.webclaw_run(recipe=recipe, title="P1-components", dualwrite_tables=True))
        )
        ok = bool(out.get("ok")) and out.get("code") == ErrorCode.OK.value
        done = out.get("done") or {}
        run_dir = done.get("run_dir")
        docs = []
        if run_dir:
            d = Path(run_dir) / "documents"
            docs = sorted(p.name for p in d.glob("*")) if d.is_dir() else []
        cases.append(
            {
                "id": "C-01",
                "name": "date-range+select+pager+collect",
                "pass": ok,
                "code": out.get("code"),
                "message": out.get("message"),
                "documents": docs,
                "run_dir": run_dir,
                "stdout_tail": ((out.get("data") or {}).get("stdout_tail") or "")[-2500:],
            }
        )
        # Parser smoke via freeze (fresh home has builtins)
        fr = json.loads(
            gw.webclaw_freeze(
                name="comp-demo",
                recipe=recipe,
                title="component pack demo",
            )
        )
        cases.append(
            {
                "id": "C-02",
                "name": "freeze-recipe-with-new-verbs",
                "pass": bool(fr.get("ok"))
                or (home / "recipes" / "comp-demo.webclaw").exists(),
                "code": fr.get("code"),
            }
        )
    finally:
        httpd.shutdown()

    passed = sum(1 for c in cases if c.get("pass"))
    failed = sum(1 for c in cases if not c.get("pass"))
    report = {
        "stamp": stamp,
        "binary": bin_path,
        "webclaw_home": str(home),
        "fixture": f"{base}/components.html",
        "passed": passed,
        "failed": failed,
        "status": "green" if failed == 0 and passed == len(cases) else "red",
        "cases": cases,
        "note": "P1 Component Pack minimal slice",
    }
    path = OUT / "components.json"
    stamped = OUT / f"components-{stamp}.json"
    text = json.dumps(report, ensure_ascii=False, indent=2)
    path.write_text(text, encoding="utf-8")
    stamped.write_text(text, encoding="utf-8")
    print(text)
    print(f"REPORT={path}")
    return 0 if report["status"] == "green" else 1


if __name__ == "__main__":
    # fix typo id: -> "id":
    raise SystemExit(main())
