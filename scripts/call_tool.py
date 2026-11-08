#!/usr/bin/env python3
"""Call one webclaw-x MCP tool over stdio and print JSON result."""
from __future__ import annotations
import asyncio, json, os, sys
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

args_list = [a for a in sys.argv[1:]]
json_only = "--json-only" in args_list
args_list = [a for a in args_list if a != "--json-only"]
TOOL = args_list[0] if args_list else "webclaw_status"
ARGS = json.loads(args_list[1]) if len(args_list) > 1 else {}

ROOT = Path("/workspace/webclaw-x")
os.environ.setdefault("PYTHONPATH", str(ROOT))
os.environ.setdefault("WEBCLAW_LITE_BIN", os.path.expanduser("~/.webclaw/bin/webclaw-lite"))
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

async def main() -> None:
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(TOOL, ARGS)
            payload = _extract(result)
            if json_only:
                print(json.dumps(payload, ensure_ascii=False, indent=2))
                return
            print(json.dumps({"tool": TOOL, "args": ARGS, "result": payload}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
