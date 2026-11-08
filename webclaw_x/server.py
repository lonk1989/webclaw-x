#!/usr/bin/env python3
"""webclaw-x MCP gateway — hardened contract over webclaw-lite.

Contract rules for host agents (WorkBuddy / Cursor / DSH / …):
- Full frozen recipes → call webclaw_run ONCE. Never stepwise probe for replay.
- probe is authoring-only (compose short fragments → freeze → then run).
- Never put passwords / captcha codes into chat or tool args that will be logged;
  use accounts vault + human-reply for HITL.
- Results are scrubbed: password/captcha values are redacted.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

import anyio

# Allow `python -m webclaw_x.server` from repo root and direct script exec.
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from mcp.server.fastmcp import FastMCP  # type: ignore  # noqa: E402

from webclaw_x.dualwrite import dualwrite_documents  # noqa: E402
from webclaw_x.errors import ErrorCode, envelope  # noqa: E402
from webclaw_x.scrub import scrub_obj, remember_sensitive
from webclaw_x import jobs
from webclaw_x.recipe_library import RecipeLibrary, LibraryError  # noqa: E402
from webclaw_x.lite_bin import resolve_lite_bin  # noqa: E402

BINARY = str(resolve_lite_bin(_ROOT))

HOME = Path(os.environ.get("WEBCLAW_HOME", str(Path.home() / ".webclaw")))
RUN_TIMEOUT = int(os.environ.get("WEBCLAW_RUN_TIMEOUT_MS", "600000")) / 1000
PROBE_TIMEOUT = int(os.environ.get("WEBCLAW_PROBE_TIMEOUT_MS", "120000")) / 1000
DUALWRITE = os.environ.get("WEBCLAW_DUALWRITE", "1") != "0"

from webclaw_x.fast_card import FAST_CARD  # noqa: E402
from webclaw_x import status_fast  # noqa: E402
from webclaw_x.prewarm import maybe_start_background  # noqa: E402

# Single fast-card (deduped vs skills/SKILL.md). Do not re-expand here.
INSTRUCTIONS = FAST_CARD

mcp = FastMCP("webclaw-x", instructions=INSTRUCTIONS)

# Optional Chrome prewarm (WEBCLAW_PREWARM=1); default off — no semantic change.
maybe_start_background()


def _env() -> dict[str, str]:
    env = os.environ.copy()
    env["WEBCLAW_HOME"] = str(HOME)
    env["WEBCLAW_LITE"] = "1"
    return env


def _run(args: list[str], timeout: float, stdin_text: str | None = None) -> dict:
    if not Path(BINARY).is_file():
        return envelope(
            ok=False,
            code=ErrorCode.BINARY_MISSING,
            message=f"webclaw-lite binary missing: {BINARY}",
            data={"stdout": "", "stderr": "", "exit_code": None},
        )
    try:
        proc = subprocess.run(
            [BINARY, *args],
            input=stdin_text,
            text=True,
            capture_output=True,
            timeout=timeout,
            env=_env(),
        )
        ok = proc.returncode == 0
        return envelope(
            ok=ok,
            code=ErrorCode.OK if ok else ErrorCode.RUN_FAILED,
            message="" if ok else f"exit {proc.returncode}",
            data={
                "stdout": proc.stdout[-200_000:],
                "stderr": proc.stderr[-50_000:],
                "exit_code": proc.returncode,
            },
        )
    except subprocess.TimeoutExpired as e:
        out = (e.stdout or "") if isinstance(e.stdout, str) else ""
        err = (e.stderr or "") if isinstance(e.stderr, str) else ""
        return envelope(
            ok=False,
            code=ErrorCode.TIMEOUT,
            message=f"timeout after {timeout}s",
            data={"stdout": out[-200_000:], "stderr": err[-50_000:], "exit_code": None},
        )
    except Exception as e:  # noqa: BLE001
        return envelope(
            ok=False,
            code=ErrorCode.INTERNAL,
            message=str(e),
            data={"stdout": "", "stderr": "", "exit_code": None},
        )


def _parse_done(stdout: str) -> dict | None:
    for line in reversed([ln.strip() for ln in stdout.splitlines() if ln.strip()]):
        if '"done"' not in line and '"need_human"' not in line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(row, dict):
            continue
        t = row.get("type")
        if t == "need_human":
            return {
                "success": False,
                "need_human": True,
                "prompt": row.get("prompt") or row.get("message") or row,
                "run_dir": row.get("run_dir"),
                "raw": row,
            }
        if t != "done":
            continue
        fail = row.get("fail", 0) if isinstance(row.get("fail"), (int, float)) else 0
        ok_val = row.get("ok")
        success = (ok_val is not False and fail == 0 and not row.get("error")
                   and row.get("error_code") in (None, "", "OK"))
        return {
            "success": success,
            "okCount": ok_val if isinstance(ok_val, (int, float)) else None,
            "fail": fail,
            "error": row.get("error"),
            "error_code": row.get("error_code"),
            "run_dir": row.get("run_dir"),
            "assert_report": row.get("assert_report") or row.get("assertReport"),
            "raw": row,
        }
    return None


_AMBIGUOUS_RE = re.compile(
    r"(共\s*\d+\s*个足够匹配|AMBIGUOUS_TARGET|多个候选|请加\s*#序号|匹配到\s*\d+\s*个)"
)


_AMBIGUOUS_HINT = (
    "多候选时请在同文案后加 #N（例如 点击确定#1），"
    "或先 probe 查看 candidates，禁止静默点第一个。"
)


def _parse_ambiguous_candidates(text: str) -> list[dict]:
    """从 lite 错误文案解析可读候选行：#N label…（分号分隔）。

    只吃「候选：」后第一段；遇已见过的 #N 即停，避免 done JSON 二次拼接重复。
    """
    m = re.search(r"候选[：:]\s*", text)
    if not m:
        return []
    rest = text[m.end():]
    out: list[dict] = []
    seen: set[int] = set()
    for mm in re.finditer(r"#(\d+)\s*([^#；;\n]+)", rest):
        n = int(mm.group(1))
        if n in seen:
            break
        label = (mm.group(2) or "").strip().rstrip("。\"'}]")
        if not label:
            continue
        seen.add(n)
        out.append({"n": n, "label": label})
    return out


def _detect_ambiguous(stdout: str, stderr: str, done: dict | None) -> dict | None:
    done = done or {}
    # Prefer structured done.error（单份文案），再拼日志；避免 JSON dump 重复污染候选解析
    primary = str(done.get("error") or done.get("message") or "")
    blob = "\n".join(
        [
            primary,
            stdout or "",
            stderr or "",
            json.dumps(done, ensure_ascii=False),
        ]
    )
    if not _AMBIGUOUS_RE.search(blob):
        return None
    # Prefer「匹配到 N 个候选」；兼容旧「共 N 个足够匹配」
    m = re.search(r"匹配到\s*(\d+)\s*个", blob) or re.search(r"共\s*(\d+)\s*个", blob)
    candidates = _parse_ambiguous_candidates(primary) or _parse_ambiguous_candidates(blob)
    count = int(m.group(1)) if m else (len(candidates) or None)
    out = {
        "ambiguous": True,
        "candidate_count": count,
        "hint": _AMBIGUOUS_HINT,
    }
    if candidates:
        out["candidates"] = candidates
    return out


# Only protocol events, not page/log payloads, may supply authoritative codes.
_FAILURE_CODES = {code.value for code in ErrorCode} - {ErrorCode.OK.value}
_EVENT_TYPES = {"done", "error", "step_fail"}


def _structured_error(stdout: str, stderr: str) -> str | None:
    events = []
    for line in (stdout + "\n" + stderr).splitlines():
        try:
            row = json.loads(line)
        except ValueError:
            continue
        if (isinstance(row, dict) and isinstance(row.get("type"), str)
                and row["type"] in _EVENT_TYPES):
            events.append(row)
    # A terminal done code wins over earlier step errors (which may have recovered).
    for kind in ({"done"}, {"error", "step_fail"}):
        for row in reversed(events):
            code = row.get("error_code") or row.get("code")
            if row.get("type") in kind and isinstance(code, str) and code:
                # Unknown future codes remain failures, never reclassified by log prose.
                return code if code in _FAILURE_CODES else ErrorCode.RUN_FAILED.value
    return None


def _legacy_error(stdout: str, stderr: str, done: dict | None) -> str | None:
    # Compatibility for older lite binaries. Stable ASCII markers before Chinese regex.
    blob = stdout + "\n" + stderr
    for code in ("POLICY_DENIED", "AMBIGUOUS_TARGET", "HEAL_CONFIG_INVALID", "NEED_REPAIR", "TIMEOUT"):
        if re.search(r"(?<![A-Z_])" + code + r"(?![A-Z_])", blob):
            return code
    if _detect_ambiguous(stdout, stderr, done):
        return ErrorCode.AMBIGUOUS_TARGET.value
    return None


def _finalize(raw: dict, *, dualwrite: bool = False, structured_data: dict | None = None) -> dict:
    data = raw.get("data") or {}
    stdout = data.get("stdout") or ""
    stderr = data.get("stderr") or ""
    done = _parse_done(stdout)
    structured_code = _structured_error(stdout, stderr)
    out = {
        "ok": bool(raw.get("ok")),
        "code": raw.get("code"),
        "message": raw.get("message") or "",
        "done": done,
        "ambiguous": None,
        "data": {
            **(structured_data or {}),
            "stdout_tail": stdout[-8_000:],
            "stderr_tail": stderr[-4_000:],
            "exit_code": data.get("exit_code"),
        },
    }
    if done is not None:
        if done.get("need_human"):
            out.update(ok=False, code=ErrorCode.NEED_HUMAN.value,
                       message="需要人工操作，请收到用户回复后调用 webclaw_human_reply")
        else:
            # Never turn a nonzero process exit into success because of a stale done.
            out["ok"] = bool(raw.get("ok")) and bool(done.get("success"))
            out["code"] = ErrorCode.OK.value if out["ok"] else ErrorCode.RUN_FAILED.value
            if not out["ok"]:
                out["message"] = str(done.get("error") or out["message"] or "菜谱执行失败")
        if dualwrite and DUALWRITE and out["ok"] and done.get("run_dir"):
            try:
                out["dualwrite"] = dualwrite_documents(done["run_dir"])
            except Exception as e:  # noqa: BLE001
                out["dualwrite"] = {"error": str(e)}

    heal_trace = []
    for line in stdout.splitlines():
        try:
            row = json.loads(line)
            message = row.get("message", "")
            if row.get("type") == "log" and message.startswith("SELF_HEAL "):
                heal_trace.append(json.loads(message[len("SELF_HEAL "):]))
        except (ValueError, TypeError, AttributeError):
            continue
    if heal_trace:
        out["heal_trace"] = heal_trace
    if done is None and structured_code:
        out["ok"] = False
    if (not out["ok"] and out["code"] != ErrorCode.NEED_HUMAN.value
            and raw.get("code") not in (ErrorCode.TIMEOUT.value, ErrorCode.RUN_CANCELLED.value)):
        code = structured_code or _legacy_error(stdout, stderr, done)
        if code:
            out["code"] = code
        if out["code"] == ErrorCode.AMBIGUOUS_TARGET.value:
            out["ambiguous"] = _detect_ambiguous(stdout, stderr, done) or {
                "ambiguous": True,
                "candidate_count": None,
                "hint": _AMBIGUOUS_HINT,
            }
    if done is not None:
        ar = (done.get("assert_report") or done.get("assertReport")
              or (done.get("raw") or {}).get("assert_report")
              or (done.get("raw") or {}).get("assertReport"))
        if ar:
            out["data"]["assert_report"] = ar
    if raw.get("job_id"):
        out["run_id"] = raw["job_id"]
        out["run_dir"] = raw.get("run_dir")
    if raw.get("waiting"):
        out["need_human"] = raw["waiting"]
    # A prior NEED_HUMAN/done event must not hide a killed/expired child.
    if raw.get("code") == ErrorCode.TIMEOUT.value:
        out.update(ok=False, code=ErrorCode.TIMEOUT.value,
                   message=raw.get("message") or "运行超时，子进程已停止")
    if raw.get("code") == ErrorCode.RUN_CANCELLED.value:
        out.update(ok=bool(raw.get("ok")), code=ErrorCode.RUN_CANCELLED.value,
                   message=raw.get("message") or "运行已取消，子进程已停止")
    for key in ("cancelled", "cancel_marker_error"):
        if key in data:
            out["data"][key] = data[key]
    return scrub_obj(out)


def _status_via_lite() -> dict:
    """Deep status via lite CLI (HITL fields / legacy). Used when WEBCLAW_STATUS_MODE=lite."""
    r = _run(["status"], timeout=30)
    stdout = (r.get("data") or {}).get("stdout") or ""
    status = None
    try:
        candidate = json.loads(stdout)
        if isinstance(candidate, dict):
            status = candidate
    except ValueError:
        for line in reversed(stdout.splitlines()):
            try:
                candidate = json.loads(line)
            except ValueError:
                continue
            if isinstance(candidate, dict) and any(k in candidate for k in ("bin", "chromeOk", "version")):
                status = candidate
                break
    if status is None and r.get("ok"):
        r = {**r, "ok": False, "code": ErrorCode.RUN_FAILED.value,
             "message": "Invalid status JSON from webclaw-lite"}
    return _finalize(r, structured_data=status)


@mcp.tool()
def webclaw_status() -> dict:
    """V-01 health: data contains chromeOk/cdpReady/chromeInstances; stdout_tail deprecated.

    Default hot path (WEBCLAW_STATUS_MODE=fast|omit): Host probes bin/CDP/instances without
    spawning webclaw-lite. Set WEBCLAW_STATUS_MODE=lite for full CLI status (HITL deep fields).
    """
    mode = (os.environ.get("WEBCLAW_STATUS_MODE") or "fast").strip().lower()
    if mode in ("lite", "cli", "full"):
        return _status_via_lite()
    status = status_fast.build_status(repo_root=_ROOT)
    bin_ok = Path(str(status.get("bin") or "")).is_file()
    if not bin_ok:
        r = envelope(
            ok=False,
            code=ErrorCode.BINARY_MISSING,
            message=f"webclaw-lite binary missing: {status.get('bin')}",
            data={"stdout": "", "stderr": "", "exit_code": None,
                  "statusSource": status.get("statusSource", "host_fast")},
        )
        return _finalize(r, structured_data=status)
    r = envelope(
        ok=True,
        code=ErrorCode.OK,
        message="",
        data={
            "stdout": "",
            "stderr": "",
            "exit_code": 0,
            "statusSource": status.get("statusSource", "host_fast"),
        },
    )
    return _finalize(r, structured_data=status)


@mcp.tool()
def webclaw_install() -> dict:
    """Create WEBCLAW_HOME dirs, probe Chrome, write install marker."""
    HOME.mkdir(parents=True, exist_ok=True)
    for sub in ("bin", "recipes", "runs", "jobs"):
        (HOME / sub).mkdir(parents=True, exist_ok=True)
    r = _run(["install"], timeout=60)
    return _finalize(r)


@mcp.tool()
def webclaw_probe(
    url: str = "",
    types: str = "",
    search: str = "",
    limit: int = 60,
) -> dict:
    """Authoring-only page scan. Returns candidates (textCmd/indexCmd). Do NOT use for frozen-recipe replay."""
    args = ["probe"]
    if url.strip():
        args += ["--url", url.strip()]
    if types.strip():
        args += ["--types", types.strip()]
    if search.strip():
        args += ["--search", search.strip()]
    if limit:
        args += ["--limit", str(limit)]
    r = _run(args, timeout=PROBE_TIMEOUT)
    if not r.get("ok"):
        r = {**r, "code": ErrorCode.PROBE_FAILED.value}
    return _finalize(r)


def _params_gate(body: str, confirmed: bool) -> dict | None:
    names = sorted({name.strip() for name in re.findall(r"\{\{([^{}]*?)\}\}", body)})
    if names and not confirmed:
        return scrub_obj(envelope(
            ok=False, code=ErrorCode.PARAMS_UNCONFIRMED,
            message="请先确认占位参数：" + "、".join(names),
            data={"pending_parameters": names},
        ))
    return None


def _read_recipe_path(value: str) -> str:
    """Match lite's existing-path then HOME/recipes stem resolution; run this snapshot."""
    path = Path(value)
    if not path.is_file():
        candidate = HOME / "recipes" / path.name
        if candidate.suffix != ".webclaw":
            candidate = candidate.with_name(candidate.stem + ".webclaw")
        if not candidate.is_file():
            candidate = HOME / "recipes" / (path.stem + ".webclaw")
        if candidate.is_file():
            path = candidate
    body = path.read_text(encoding="utf-8-sig")
    # Match the runtime's legacy header handling for file recipes.
    return body.split("\n---\n", 1)[-1]


@mcp.tool()
async def webclaw_run(
    recipe: str = "",
    recipe_path: str = "",
    params: str = "",
    params_confirmed: bool = False,
    title: str = "",
    dualwrite_tables: bool = True,
    recipe_ref: str = "",
    environment: str = "",
) -> dict:
    """Execute a recipe ONCE (zh/en verbs; same AST). Prefer full body; never split frozen recipes into probe steps.

    To stop, Host agents must call webclaw_cancel (allowed concurrently during this run),
    not merely stop the chat/LLM response.

    recipe: full recipe text (preferred when pasting a complete recipe).
    recipe_path: path or library stem under WEBCLAW_HOME/recipes.
    params: optional JSON object string for 参数 overrides (no passwords).
    params_confirmed: enforced gateway gate; confirm non-secret placeholders before running.
    dualwrite_tables: after success, parse documents/*.md tables → .json/.csv.
    recipe_ref: versioned name@version (or latest name), exclusive with recipe/recipe_path.
    environment: shared non-secret environment binding for recipe_ref, e.g. fixture.
    """
    resolved_version = None
    if environment and not recipe_ref:
        return envelope(ok=False, code="RECIPE_INVALID_ARGS", message="environment requires recipe_ref")
    if recipe_ref:
        if recipe.strip() or recipe_path.strip():
            return envelope(ok=False, code="RECIPE_INVALID_ARGS", message="recipe_ref is exclusive with recipe/recipe_path")
        try:
            pending = _params_gate(RecipeLibrary(HOME).get(recipe_ref)["recipe"], params_confirmed)
            if pending:
                return pending
            loaded = RecipeLibrary(HOME).get(recipe_ref, environment=environment,
                                              parameters=json.loads(params or "{}"), render=True)
            recipe = loaded["recipe"]
            params = ""  # Values rendered once; do not forward library env as runtime param metadata.
            resolved_version = {"name": loaded["name"], "version": loaded["version"],
                                "environment": loaded["environment"], "sha256": loaded.get("sha256"),
                                "rendered_sha256": loaded.get("rendered_sha256")}
        except LibraryError as exc:
            return envelope(ok=False, code=exc.code, message=str(exc))
        except (ValueError, OSError):
            return envelope(ok=False, code="RECIPE_INVALID_ARGS", message="Invalid library reference or parameters JSON")
    args = ["run"]
    stdin_text = None
    if recipe_path.strip():
        try:
            recipe = _read_recipe_path(recipe_path.strip())
        except (OSError, UnicodeError):
            return envelope(ok=False, code=ErrorCode.RECIPE_MISSING,
                                       message="无法读取 UTF-8 菜谱文件")
        args += ["--stdin"]
        stdin_text = recipe
    elif recipe.strip():
        args += ["--stdin"]
        stdin_text = recipe.strip()
    else:
        return scrub_obj(
                envelope(
                    ok=False,
                    code=ErrorCode.INVALID_ARGS,
                    message="provide recipe or recipe_path",
                )
            )
    if title.strip():
        args += ["--title", title.strip()]
    if params.strip():
        # Scrub before forwarding? Still pass to binary but never echo secrets back.
        args += ["--params", params.strip()]
    pending = _params_gate(recipe, params_confirmed)
    if pending:
        return pending

    def execute():
        if not Path(BINARY).is_file():
            return _finalize(_run(args, timeout=RUN_TIMEOUT, stdin_text=stdin_text))
        r = jobs.start([BINARY, *args], _env(), stdin_text, RUN_TIMEOUT, dualwrite_tables)
        result = _finalize(r, dualwrite=dualwrite_tables)
        if resolved_version:
            result["recipe_version"] = resolved_version
        return scrub_obj(result)

    # FastMCP invokes synchronous tools on its event loop. Never collect there:
    # another request on the same MCP session must be able to cancel this child.
    return await anyio.to_thread.run_sync(execute)


@mcp.tool()
def webclaw_list_recipes() -> dict:
    """Discover recipes in data.recipes (deprecated stdout_tail retained for old Hosts)."""
    result = _library_result(lambda lib: {"recipes": lib.list()})
    if result["ok"]:
        rows = result["data"]["recipes"]
        # Preserve the previous finalized CLI envelope/JSONL shape for old Hosts.
        listing = {"type": "recipes", "dir": str(HOME / "recipes"), "items": rows}
        compat = _finalize(envelope(ok=True, code=ErrorCode.OK, data={
            "stdout": json.dumps(listing, ensure_ascii=False), "exit_code": 0}))
        compat["data"].update(result["data"])
        return scrub_obj(compat)
    return result


@mcp.tool()
def webclaw_freeze(name: str, recipe: str, title: str = "") -> dict:
    """Save a recipe into WEBCLAW_HOME/recipes/<name>.webclaw (authoring → freeze)."""
    if not name.strip() or not recipe.strip():
        return scrub_obj(
                envelope(
                    ok=False,
                    code=ErrorCode.INVALID_ARGS,
                    message="name and recipe required",
                )
            )
    args = ["recipe", "save", "--name", name.strip(), "--stdin"]
    if title.strip():
        args += ["--title", title.strip()]
    r = _run(args, timeout=30, stdin_text=recipe.strip())
    if not r.get("ok"):
        r = {**r, "code": ErrorCode.FREEZE_FAILED.value}
    return _finalize(r)


@mcp.tool()
async def webclaw_human_reply(mode: str, text: str = "", run_id: str = "", prompt_id: str = "") -> dict:
    """Resume an active NEED_HUMAN job. Pass returned run_id/prompt_id; no stale inbox replay.

    Only submit text supplied by the human. Never infer captcha/approval automatically.
    """
    mode = mode.strip().lower()
    if mode not in ("text", "ok", "cancel") or (mode == "text" and not text.strip()):
        return envelope(ok=False, code=ErrorCode.INVALID_ARGS,
                                  message="mode must be text|ok|cancel; text mode requires text")
    job = jobs.waiting(run_id, prompt_id, claim=True)
    if job is None:
        return envelope(ok=False, code=ErrorCode.NO_ACTIVE_HUMAN,
                                  message="No matching active human prompt")
    if mode == "text":
        remember_sensitive(text)
    args = ["human-reply", "--run-dir", job.run_dir]
    args += ["--text", text] if mode == "text" else ["--" + mode]

    def resume():
        # CLI replies only to a validated live run, never last-need-human archive.
        ack = _run(args, timeout=30)
        if not ack.get("ok"):
            return _finalize(ack)
        job.waiting = None
        return _finalize(job.collect(), dualwrite=job.dualwrite)

    return await anyio.to_thread.run_sync(resume)


@mcp.tool()
async def webclaw_cancel(run_id: str = "") -> dict:
    """Stop the managed child (and its cancel marker). Idle cancel is a no-op.

    Host Stop must call this tool, not only interrupt the chat/LLM. It can run
    concurrently, including from another stdio session with the same WEBCLAW_HOME.
    Optional run_id targets one job. Empty / stale / no-active always returns
    NO_ACTIVE_RUN and never writes the home-global control/cancel marker (avoids
    collateral cancel of a sibling bare CLI run sharing WEBCLAW_HOME).
    """
    def cancel():
        managed = jobs.cancel_active(run_id or None, home=HOME)
        if managed["code"] == ErrorCode.RUN_CANCELLED.value:
            result = _finalize(managed)
            # jobs already wrote the native marker under the lifecycle lock.
            # A second CLI cancel after releasing it could hit the NEXT run.
            result["data"]["native_cancel"] = {
                "ok": not bool(managed["data"].get("cancel_marker_error")),
                "code": "OK" if not managed["data"].get("cancel_marker_error") else "RUN_FAILED",
                "message": "Native cancel marker requested by managed cancellation; no duplicate CLI call",
            }
        else:
            # Unify empty-op codes: always NO_ACTIVE_RUN (never OK + side-effect CLI cancel).
            result = _finalize(managed)
            if managed.get("code") == ErrorCode.NO_ACTIVE_RUN.value:
                result["ok"] = True
                result["code"] = ErrorCode.NO_ACTIVE_RUN.value
                result["message"] = managed.get("message") or "No matching gateway-managed run is active"
                result["data"]["cancelled"] = False
                result["data"]["native_cancel_skipped"] = True
        return scrub_obj(result)

    return await anyio.to_thread.run_sync(cancel)


@mcp.tool()
def webclaw_last_log(lines: int = 80) -> dict:
    """Recent webclaw-lite log text (scrubbed)."""
    r = _run(["last-log", "--lines", str(lines)], timeout=30)
    return _finalize(r)


@mcp.tool()
def webclaw_accounts_list() -> dict:
    """List site accounts in the local vault (passwords never returned)."""
    r = _run(["accounts", "list"], timeout=30)
    return _finalize(r)


@mcp.tool()
def webclaw_accounts_ensure(id: str, url: str, name: str = "") -> dict:
    """Ensure a site account entry with login URL only (no password)."""
    if not id.strip() or not url.strip():
        return scrub_obj(
                envelope(
                    ok=False,
                    code=ErrorCode.INVALID_ARGS,
                    message="id and url required",
                )
            )
    args = ["accounts", "ensure", "--id", id.strip(), "--url", url.strip()]
    if name.strip():
        args += ["--name", name.strip()]
    r = _run(args, timeout=30)
    return _finalize(r)


@mcp.tool()
def webclaw_dualwrite_run(run_dir: str) -> dict:
    """Manually dual-write JSON/CSV for tables in an existing run's documents/*.md."""
    if not run_dir.strip():
        return scrub_obj(
                envelope(ok=False, code=ErrorCode.INVALID_ARGS, message="run_dir required")
            )
    try:
        result = dualwrite_documents(run_dir.strip())
        return scrub_obj(
                envelope(ok=True, code=ErrorCode.OK, message="dualwrite done", data=result)
            )
    except Exception as e:  # noqa: BLE001
        return scrub_obj(
                envelope(ok=False, code=ErrorCode.INTERNAL, message=str(e))
            )


def _library_result(action) -> dict:
    try:
        data = action(RecipeLibrary(HOME))
        return scrub_obj(envelope(ok=True, code=ErrorCode.OK, data=data))
    except LibraryError as exc:
        return envelope(ok=False, code=exc.code, message=str(exc))
    except (ValueError, OSError, TypeError):
        return envelope(ok=False, code="RECIPE_INVALID_ARGS", message="Invalid library input or JSON")


@mcp.tool()
def webclaw_recipe_list() -> dict:
    """List all immutable recipe versions plus compatible legacy flat .webclaw files."""
    return _library_result(lambda lib: {"recipes": lib.list()})


@mcp.tool()
def webclaw_recipe_publish(name: str, recipe: str, tags: list[str] | None = None,
                           parameters: str = "{}", version: int | None = None) -> dict:
    """Publish/freeze a new immutable version; never overwrite. No secrets allowed.

    parameters: JSON non-secret defaults; bind environment base_url separately.
    """
    return _library_result(lambda lib: lib.publish(name, recipe, tags=tags,
                            parameters=json.loads(parameters), version=version))


@mcp.tool()
def webclaw_recipe_bind_env(name: str, environment: str, parameters: str) -> dict:
    """Bind shared non-secret environment parameters (JSON), without copying recipe bodies.

    Does not change immutable versions or automatically change the navigation allowlist.
    """
    return _library_result(lambda lib: lib.bind_env(name, environment, json.loads(parameters)))


@mcp.tool()
def webclaw_recipe_get(reference: str, environment: str = "", parameters: str = "{}") -> dict:
    """Get name@version (or latest name); optional env renders {{base_url}} etc."""
    return _library_result(lambda lib: lib.get(reference, environment=environment,
                                               parameters=json.loads(parameters)))


@mcp.tool()
def webclaw_recipe_diff(left: str, right: str) -> dict:
    """Unified diff of two frozen recipe step texts (e.g. name@1, name@2)."""
    return _library_result(lambda lib: {"diff": lib.diff(left, right)})


if __name__ == "__main__":
    mcp.run(transport="stdio")
