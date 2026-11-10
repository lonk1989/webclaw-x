---
name: webclaw-lite
description: >-
  Local webclaw-lite browser RPA. DEFAULT: full recipe → webclaw_run once.
  Prefab 参数…= → needParams confirm or「用默认」. Feishu/SSO sites need URL
  only (no password). Never ask passwords, never invent accounts-set CLI,
  never probe a complete recipe, never ask extra confirm questions when the
  user already gave the fields. Never Playwright/CSS.
---

# webclaw-lite

Deterministic browser RPA driven by **Chinese natural-language recipes** stored as local `.webclaw` files.

## Decision (read first — do not skip)

| User input | What you MUST do | Forbidden |
|------------|------------------|-----------|
| Pastes / attaches a **complete** recipe (many `，` steps, or `.webclaw`) | `webclaw_run` with the **entire** body / `recipePath` | Split into steps; `webclaw_probe` between steps |
| Recipe declares **`参数…=`** / **`{{名}}`** | Keep as-is → Host confirm / `needParams` → second call `paramsConfirmed=true` + `params` | Expand defaults into body; skip form; first-call `paramsConfirmed=true` |
| Failure → patch / re-run | Reuse confirmed `params` + `paramsConfirmed=true`; Host session keeps values | Re-ask params; skip UI → blank values |
| `(点击取消?)` / `（试探？备选）` | Keep literally (runtime probe: try / fallback-or-skip) | Strip as comments; force unconditional click |
| User already gave business fields (e.g. 请假：年假 / 日期 / 原因) | Keep `参数…=` / `{{名}}`; put values in `params`; Host confirms then run | Inline literals into recipe and skip confirm |
| Points at `recipes/*.webclaw` | Same as above | Probe “to be safe” |
| New unknown site, **no** complete recipe | Authoring: `webclaw_probe` ↔ short `webclaw_run` | Invent labels; Playwright |
| Login / EHR / 飞书 SSO | `登录EHR系统` via `webclaw_run`. Vault needs **correct SSO URL** only (`…/login?sso=lark&…`). No password. | Ask password; paste `webclaw-lite.exe accounts set`; block because `has_password=false`; invent password form |

**Rule of thumb:** One (or two with param confirm) `webclaw_run` — not probe loops, not password chats, not extra Q&A.

## Modes

| Mode | When | Tools |
|------|------|-------|
| **Replay (default)** | Full recipe / path / frozen file | `webclaw_run` (+ param confirm when needed) |
| **Authoring** | New / unknown site, no complete recipe | `webclaw_probe` ↔ short `webclaw_run` |
| **Freeze** | Path works and should be kept | `webclaw_freeze` |

## Rules

1. Prefer Host tools: `webclaw_status`, `webclaw_accounts_status`, `webclaw_inspect_params`, `webclaw_probe`, `webclaw_run`, `webclaw_freeze`, `webclaw_list_recipes`, `webclaw_import`, `webclaw_human_reply`, `webclaw_cancel`, `webclaw_set_display`, `webclaw_browser`
2. **Forbidden**: Playwright / Puppeteer / CSS / invented verbs / labels not in the latest probe (authoring only); PowerShell / `taskkill` / `Stop-Process` / `kill` to manage Chrome
3. Chat attachments are one-shot. Durable library: `webclaw_import` / `webclaw_freeze`
4. **Install**: Windows / macOS (arm64) plugin auto-downloads lite. Intel Mac / Linux: build `runtime/` or set `binaryPath`. Gatekeeper: `xattr -d com.apple.quarantine ~/.webclaw/bin/webclaw-lite`
5. Never turn a long user recipe into multi-round probe
6. **参数**: Prefab defaults are placeholders — confirm or「用默认」. If the user already supplied the values in chat, merge into `params` and run; do not re-interview
7. **Secrets / SSO**: Never ask for or accept passwords in chat. Never invent `accounts set --password`. Feishu SSO = URL only in **设置 → 网站账号**
8. **Browser process**: Headless Chrome stays up after runs. User「关掉浏览器/关掉实例」→ `webclaw_browser(action=stop)` only — never shell-kill. `status` / `restart` via the same tool.

## Site accounts (local vault)

| Do | Don't |
|----|--------|
| `登录EHR系统` with vault URL = SSO entry e.g. `https://…/login?sso=lark&next=…` | Ask for EHR password; CLI `accounts set --password` |
| `webclaw_run` when `has_password=false` if URL is set / SSO | Refuse to open for missing password |
| If URL wrong: tell user to fix **设置 → 网站账号** (URL field only) | Probe about:blank; invent Playwright login |

`webclaw_accounts_status` may show `sso: true` / `passwordRequired: false`. That means **run**, do not configure a password.

## Replay

1. Full recipe as-is → `webclaw_run`
2. If `needParams`: show form once → wait for edit or「用默认」→ `paramsConfirmed=true` (+ `params` JSON if edited)
3. If user already gave field values in the same turn: use them in `params` and run (still respect `needParams` gate once if the file declares 参数)
4. Report `ok` / `error` briefly. Do not ask the user to eyeball the browser unless the run **failed** and you need a human decision
5. Optional `webclaw_freeze` after success

## Authoring (only when no complete recipe)

`webclaw_probe` → short `webclaw_run` from probe cmds → freeze when stable.

## Recipe vocabulary

| Step | Meaning |
|------|---------|
| `参数公司=科技事业部` | Form field default/placeholder; body `{{公司}}` |
| `登录EHR系统` | Open vault URL (SSO OK, no password in recipe) |
| `打开https://…` | Navigate |
| `等待2` / `等待5` | **Agent must only use second sleeps** after open/login/click/save |
| `点击…` / `输入…=` | UI actions |

### `等待` rules for Agent-authored recipes

- **Only write duration waits**: `等待2`、`等待5`（optionally `等待3秒`）. Examples: `登录旧MES系统，等待5` · `点击保存，等待2`.
- **Do not** write wait targets: `等待文字…`、`等待加载`、`等待遮罩`、`等待首页`、`等待登录成功`、`等待首页加载完成`、or any other status/NL phrase.
- Why: Agent-invented wait targets rarely match real on-page text and time out; fixed seconds are predictable.
- If a **human** frozen recipe already uses smart waits (`等待文字…` / `等待加载`…), replay it as-is — do not rewrite those steps.

## Status fields

- `chromeOk`: Chrome/Edge **binary present** (Host readiness gate).
- `cdpReady`: debug port answers (browser instance reachable).
- `chromeInstances` / `chromeWarn`: multi-instance / orphan risk. On Windows, top-level PID enum uses wmic/CIM and may be empty when blocked — then `topLevel=0 && listeners>0` means enum-degraded, not “no Chrome”.

## HITL

On `need_human`: captcha → `webclaw_human_reply` with `mode=text|ok|cancel`.
