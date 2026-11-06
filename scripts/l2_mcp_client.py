#!/usr/bin/env python3
"""L2 black-box: MCP stdio Client (no LLM) → V-01/V-02/V-03 + Host contract → eval/out/l2-client.json."""

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

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "eval" / "out"
FIXTURE = ROOT / "fixtures" / "site"


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _start_fixture() -> tuple[ThreadingHTTPServer, str]:
    port = _free_port()
    httpd = ThreadingHTTPServer(
        ("127.0.0.1", port),
        partial(SimpleHTTPRequestHandler, directory=str(FIXTURE)),
    )
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    for _ in range(50):
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                break
        except OSError:
            time.sleep(0.05)
    return httpd, f"http://127.0.0.1:{port}"


def _tool_text(result) -> str:
    parts: list[str] = []
    for block in getattr(result, "content", None) or []:
        text = getattr(block, "text", None)
        if text:
            parts.append(text)
    return "\n".join(parts) if parts else json.dumps(
        getattr(result, "model_dump", lambda: {})(),
        ensure_ascii=False,
        default=str,
    )


async def _call(session: ClientSession, name: str, arguments: dict) -> dict:
    result = await session.call_tool(name, arguments=arguments)
    raw = _tool_text(result)
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        payload = {"ok": False, "code": "PARSE_ERROR", "message": raw[:2000]}
    is_error = bool(getattr(result, "isError", False))
    return {"tool": name, "isError": is_error, "payload": payload}


async def run_l2() -> dict:
    OUT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    home = Path(os.environ.get("WEBCLAW_HOME") or f"/tmp/webclaw-x-l2-{stamp}")
    for sub in ("bin", "recipes", "runs", "jobs"):
        (home / sub).mkdir(parents=True, exist_ok=True)

    bin_path = os.environ.get("WEBCLAW_LITE_BIN") or str(ROOT / "bin-webclaw-lite")
    for cand in (
        bin_path,
        str(Path.home() / ".webclaw" / "bin" / "webclaw-lite"),
        "/workspace/webclaw-oss/target/release/webclaw-lite",
    ):
        if Path(cand).is_file():
            bin_path = cand
            break

    py = ROOT / ".venv" / "bin" / "python"
    if not py.is_file():
        py = Path(sys.executable)

    httpd, base = _start_fixture()
    cases: list[dict] = []
    report: dict = {
        "stamp": stamp,
        "binary": bin_path,
        "webclaw_home": str(home),
        "fixture_base": base,
        "cases": cases,
        "status": "red",
    }

    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT)
    env["WEBCLAW_HOME"] = str(home)
    env["WEBCLAW_LITE_BIN"] = bin_path
    env["WEBCLAW_HEADLESS"] = env.get("WEBCLAW_HEADLESS", "1")
    # Prefer observing Rust-native sidecars; MCP dualwrite still ok as no-op-ish
    env["WEBCLAW_DUALWRITE"] = env.get("WEBCLAW_DUALWRITE", "1")

    params = StdioServerParameters(
        command=str(py),
        args=["-m", "webclaw_x.server"],
        env=env,
        cwd=str(ROOT),
    )

    try:
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                tools = await session.list_tools()
                tool_names = [t.name for t in (tools.tools or [])]
                report["tools"] = tool_names

                # V-01 status
                c01 = await _call(session, "webclaw_status", {})
                p01 = c01["payload"]
                c01["id"] = "V-01"
                c01["pass"] = (bool(p01.get("ok")) and p01.get("code") == "OK"
                               and isinstance(p01.get("data", {}).get("chromeOk"), bool)
                               and bool(p01.get("data", {}).get("version")))
                cases.append(c01)

                # V-02 run fixture table
                recipe = f"打开{base}/table.html，等待2，采集表格"
                c02 = await _call(
                    session,
                    "webclaw_run",
                    {
                        "recipe": recipe,
                        "title": "L2-V-02",
                        "dualwrite_tables": True,
                    },
                )
                p02 = c02["payload"]
                c02["id"] = "V-02"
                done = p02.get("done") or {}
                run_dir = done.get("run_dir")
                sidecar_ok = False
                if run_dir:
                    docs = Path(run_dir) / "documents"
                    names = [p.name for p in docs.glob("*")] if docs.is_dir() else []
                    c02["documents"] = names
                    sidecar_ok = any(n.endswith(".md") for n in names) and (
                        any(n.endswith(".tables.json") for n in names)
                        or any(n.endswith(".csv") for n in names)
                    )
                c02["pass"] = bool(p02.get("ok")) and sidecar_ok
                cases.append(c02)

                # V-03 ambiguous
                recipe3 = f"打开{base}/ambiguous.html，等待2，点击确定"
                c03 = await _call(
                    session,
                    "webclaw_run",
                    {"recipe": recipe3, "title": "L2-V-03"},
                )
                p03 = c03["payload"]
                c03["id"] = "V-03"
                blob = json.dumps(p03, ensure_ascii=False)
                c03["pass"] = (not p03.get("ok")) and (
                    p03.get("code") == "AMBIGUOUS_TARGET"
                    and ((p03.get("done") or {}).get("raw") or {}).get("error_code") == "AMBIGUOUS_TARGET"
                )
                cases.append(c03)

                gate = await _call(session, "webclaw_run", {"recipe": "等待{{delay}}"})
                gate.update(id="C-01", **{"pass": gate["payload"].get("code") == "PARAMS_UNCONFIRMED"
                    and gate["payload"].get("data", {}).get("pending_parameters") == ["delay"]})
                cases.append(gate)

                published = await _call(session, "webclaw_recipe_publish", {
                    "name": "l2-contract", "recipe": "等待{{delay}}", "tags": ["contract"],
                    "parameters": '{"delay":"0"}'})
                version = published["payload"].get("data", {}).get("version")
                frozen = await _call(session, "webclaw_freeze", {"name": "l2-contract-flat", "recipe": "等待0"})
                listing = await _call(session, "webclaw_list_recipes", {})
                rows = listing["payload"].get("data", {}).get("recipes", [])
                listing.update(id="C-02", **{"pass": bool(published["payload"].get("ok"))
                    and bool(frozen["payload"].get("ok"))
                    and any(r.get("name") == "l2-contract" and r.get("source") == "library" for r in rows)
                    and any(r.get("name") == "l2-contract-flat" and r.get("source") == "flat" for r in rows)})
                cases.append(listing)

                confirmed = await _call(session, "webclaw_run", {
                    "recipe_ref": f"l2-contract@{version}", "params_confirmed": True})
                confirmed.update(id="C-03", **{"pass": bool(confirmed["payload"].get("ok"))})
                cases.append(confirmed)

                denied = await _call(session, "webclaw_run", {"recipe": "打开https://denied.invalid"})
                payload = denied["payload"]
                denied.update(id="C-04", **{"pass": payload.get("code") == "POLICY_DENIED"
                    and ((payload.get("done") or {}).get("raw") or {}).get("error_code") == "POLICY_DENIED"})
                cases.append(denied)
    finally:
        httpd.shutdown()

    passed = sum(1 for c in cases if c.get("pass"))
    failed = sum(1 for c in cases if not c.get("pass"))
    report["passed"] = passed
    report["failed"] = failed
    report["status"] = "green" if failed == 0 and passed == len(cases) else "red"
    report["note"] = "L2 MCP stdio Client black-box (no LLM); V-01/V-02/V-03 + C-01..04 Host contract"

    path = OUT / "l2-client.json"
    stamped = OUT / f"l2-client-{stamp}.json"
    text = json.dumps(report, ensure_ascii=False, indent=2)
    path.write_text(text, encoding="utf-8")
    stamped.write_text(text, encoding="utf-8")
    print(text)
    print(f"REPORT={path}")
    return report


def main() -> int:
    report = asyncio.run(run_l2())
    return 0 if report.get("status") == "green" else 1


if __name__ == "__main__":
    raise SystemExit(main())
