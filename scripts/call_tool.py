#!/usr/bin/env python3
"""Call webclaw-x MCP tool(s) over stdio and print JSON result(s).

Default (legacy): one process per invocation — fine for one-offs, expensive for
status×N. Prefer Host-resident MCP; for scripts use --persist:

  # Long-lived session: multiple tools in one MCP process
  python scripts/call_tool.py --persist webclaw_status '{}' webclaw_list_recipes '{}'

  # Interactive: one JSON object per stdin line {"tool":"...","args":{...}}
  python scripts/call_tool.py --persist --repl
"""
from __future__ import annotations
import asyncio, json, os, sys
from pathlib import Path
from webclaw_x.lite_bin import resolve_lite_bin
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("PYTHONPATH", str(ROOT))
os.environ.setdefault("WEBCLAW_LITE_BIN", str(resolve_lite_bin(ROOT)))
os.environ.setdefault("WEBCLAW_HOME", os.path.expanduser("~/.webclaw"))
os.environ.setdefault("WEBCLAW_HEADLESS", os.environ.get("WEBCLAW_HEADLESS", "1"))

py = ROOT / ".venv" / "bin" / "python"
command = str(py if py.is_file() else sys.executable)
params = StdioServerParameters(command=command, args=["-m", "webclaw_x.server"], env={**os.environ})


def _extract(result):
    structured = getattr(result, "structuredContent", None)
    if isinstance(structured, dict):
        if set(structured.keys()) == {"result"}:
            inner = structured["result"]
            if isinstance(inner, str):
                try:
                    return json.loads(inner)
                except json.JSONDecodeError:
                    return structured
            return inner if isinstance(inner, dict) else structured
        return structured
    texts = []
    for c in getattr(result, "content", None) or []:
        t = getattr(c, "text", None)
        if t is not None:
            texts.append(t)
    if texts:
        try:
            return json.loads(texts[0])
        except json.JSONDecodeError:
            return {"ok": False, "code": "PARSE_ERROR", "message": texts[0][:2000], "data": {}}
    return {"ok": False, "code": "PARSE_ERROR", "message": "empty tool result", "data": {}}


def _parse_argv(argv: list[str]):
    json_only = "--json-only" in argv
    persist = "--persist" in argv
    repl = "--repl" in argv
    args = [a for a in argv if a not in ("--json-only", "--persist", "--repl")]
    calls: list[tuple[str, dict]] = []
    i = 0
    while i < len(args):
        tool = args[i]
        i += 1
        payload = {}
        if i < len(args):
            nxt = args[i]
            if nxt.startswith("{"):
                payload = json.loads(nxt)
                i += 1
        calls.append((tool, payload))
    if not calls and not repl:
        calls = [("webclaw_status", {})]
    return json_only, persist, repl, calls


async def _run_session(calls, *, json_only: bool, repl: bool) -> None:
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            results = []
            for tool, arguments in calls:
                result = await session.call_tool(tool, arguments)
                payload = _extract(result)
                results.append({"tool": tool, "args": arguments, "result": payload})
            if repl:
                # One JSON line per request; {"tool":"...","args":{}} ; empty line or {"op":"quit"} ends.
                print(json.dumps({"ok": True, "mode": "repl", "hint": "send {\"tool\",\"args\"} per line"}, ensure_ascii=False), flush=True)
                loop = asyncio.get_event_loop()
                while True:
                    line = await loop.run_in_executor(None, sys.stdin.readline)
                    if not line:
                        break
                    line = line.strip()
                    if not line:
                        break
                    try:
                        req = json.loads(line)
                    except json.JSONDecodeError as e:
                        print(json.dumps({"ok": False, "code": "PARSE_ERROR", "message": str(e)}, ensure_ascii=False), flush=True)
                        continue
                    if req.get("op") in ("quit", "exit"):
                        break
                    tool = req.get("tool") or req.get("name")
                    arguments = req.get("args") or req.get("arguments") or {}
                    if not tool:
                        print(json.dumps({"ok": False, "code": "INVALID_ARGS", "message": "need tool"}, ensure_ascii=False), flush=True)
                        continue
                    result = await session.call_tool(tool, arguments)
                    payload = _extract(result)
                    print(json.dumps({"tool": tool, "args": arguments, "result": payload}, ensure_ascii=False), flush=True)
                return
            if json_only and len(results) == 1:
                print(json.dumps(results[0]["result"], ensure_ascii=False, indent=2))
            elif json_only:
                print(json.dumps([r["result"] for r in results], ensure_ascii=False, indent=2))
            elif len(results) == 1:
                print(json.dumps(results[0], ensure_ascii=False, indent=2))
            else:
                print(json.dumps({"persist": True, "calls": results}, ensure_ascii=False, indent=2))


async def main() -> None:
    json_only, persist, repl, calls = _parse_argv(sys.argv[1:])
    if not persist and not repl:
        # Legacy one-shot: still one MCP process (unavoidable for single CLI invoke).
        await _run_session(calls[:1], json_only=json_only, repl=False)
        return
    await _run_session(calls, json_only=json_only, repl=repl)


if __name__ == "__main__":
    asyncio.run(main())
