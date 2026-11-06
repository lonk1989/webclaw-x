#!/usr/bin/env python3
"""One-command L1 smoke → eval/out/latest.json (green|yellow|red)."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "eval" / "out"
OUT.mkdir(parents=True, exist_ok=True)


def main() -> int:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    report = OUT / f"smoke-{stamp}.json"
    latest = OUT / "latest.json"
    log = OUT / f"smoke-{stamp}.txt"

    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT) + (os.pathsep + env["PYTHONPATH"] if env.get("PYTHONPATH") else "")
    env.setdefault("WEBCLAW_HEADLESS", "1")
    bin_path = env.get("WEBCLAW_LITE_BIN") or str(ROOT / "bin-webclaw-lite")
    for cand in (
        bin_path,
        "/workspace/webclaw-oss/target/release/webclaw-lite",
        str(Path.home() / ".webclaw" / "bin" / "webclaw-lite"),
    ):
        if Path(cand).is_file():
            env["WEBCLAW_LITE_BIN"] = cand
            break

    py = ROOT / ".venv" / "bin" / "python"
    if not py.is_file():
        py = Path(sys.executable)

    # ensure pytest
    subprocess.run([str(py), "-c", "import pytest"], check=False)
    if subprocess.run([str(py), "-c", "import pytest"], capture_output=True).returncode != 0:
        subprocess.check_call([str(py), "-m", "pip", "install", "-q", "pytest"])

    proc = subprocess.run(
        [str(py), "-m", "pytest", "tests/", "-q", "--tb=line"],
        cwd=str(ROOT),
        env=env,
        text=True,
        capture_output=True,
    )
    text = (proc.stdout or "") + "\n" + (proc.stderr or "")
    log.write_text(text, encoding="utf-8")

    def count(pat: str) -> int:
        import re

        m = re.search(rf"(\d+)\s+{pat}", text)
        return int(m.group(1)) if m else 0

    summary = {
        "stamp": stamp,
        "exit_code": proc.returncode,
        "passed": count("passed"),
        "failed": count("failed"),
        "xfailed": count("xfailed"),
        "skipped": count("skipped"),
        "binary": env.get("WEBCLAW_LITE_BIN"),
        "raw_tail": [ln for ln in text.strip().splitlines()[-12:] if ln.strip()],
        "note": (
            "yellow=xfail/skip only; P0 target is green after patch 0001; "
            "red=hard failed assertions; green=all passed"
        ),
    }
    if summary["failed"] > 0:
        summary["status"] = "red"
    elif summary["passed"] > 0 and summary["xfailed"] == 0 and summary["failed"] == 0:
        summary["status"] = "green"
    elif summary["passed"] > 0 or summary["xfailed"] > 0:
        summary["status"] = "yellow"
    else:
        summary["status"] = "red"

    report.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    latest.write_text(report.read_text(encoding="utf-8"), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"REPORT={report}")
    print(f"LATEST={latest}")
    # P0 gate: green or yellow OK
    return 0 if summary["status"] in ("green", "yellow") else 1


if __name__ == "__main__":
    raise SystemExit(main())
