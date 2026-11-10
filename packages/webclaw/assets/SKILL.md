---
name: webclaw-lite
description: >-
  Local webclaw-lite browser RPA. DEFAULT: full recipe → webclaw_run once.
  Prefab 参数…= → needParams: show editable table once (users usually must
  change values);「用默认」only if user says so. No field-by-field interview.
  Feishu/SSO: URL only, no password. Never invent accounts-set CLI / probe a
  complete recipe / Playwright.
---

# webclaw-lite

Deterministic browser RPA driven by **Chinese natural-language recipes** stored as local `.webclaw` files.

## Decision (read first — do not skip)

| User input | What you MUST do | Forbidden |
|------------|------------------|-----------|
| Says **打开 / 点击 / 采集 / 登录…** (even short:「打开MES」) | `webclaw_run` with a recipe that **keeps those verbs** (e.g. `打开旧MES系统`) | Stop after accounts lookup; `Start-Process` / default browser / `open` / `xdg-open` the vault URL |
| Pastes / attaches a **complete** recipe (many `，` steps, or `.webclaw`) | `webclaw_run` with the **entire** body / `recipePath` **once** | Split into steps; `webclaw_probe` between steps; a string of「测试：」mini-runs |
| Mid-run step fails (browser still open) | Cheap clear fix only (e.g. `#N`, missing 确定) → **one** short patch. **Immediate ask** (no more patches) on: control not found timeout, download wait with pending=0, same click useless, patch still fails. Agent download waits: `等待下载30`/`60` — never default `等待下载200` | Long `等待下载200` then guess again; re-probe from 登录;「测试：」mini-runs; PowerShell/raw CDP |
| Run / patch **succeeds** | Show **one complete updated recipe**. Any `save_skill` (update/copy) requires **explicit user consent** first — never silent/default persist. Own skill → ask then update; third-party → ask then `asCopy`; ad-hoc → paste code block unless user asks to save | Deliver patch-only; silent `save_skill`; overwrite upstream skill |
| Recipe declares **`参数…=`** / **`{{名}}`** (prefab placeholders) | **Keep those lines/placeholders as-is** in `webclaw_run`. Host asks user to confirm/edit BEFORE browser start (or `needParams` table). After edit/confirm → second call with `paramsConfirmed=true` + `params` | Expand/substitute defaults into the recipe body; drop `参数…=` / `{{名}}`; silent-run; push「用默认」; ask each field verbally; set `paramsConfirmed=true` on the first call |
| User already gave **all** business fields in the same turn | Still keep `参数…=` / `{{名}}` in the recipe; put values in `params` and run only after Host confirm (`paramsConfirmed=true` on the **second** call) | Inline values into the recipe text then skip confirm |
| Failure → short patch / re-run **same business params** | Reuse prior `params` + `paramsConfirmed=true`. Host keeps session-confirmed values — **do not** re-ask or blank fields | Second param interview; skip UI → empty `{{名}}` / empty `点击` |
| Recipe has **`(点击取消?)`** / **`（试探？备选）`** | Keep literally. Runtime: try left of `?`/`？`; on miss run right side (or skip if empty) and continue | Strip parentheses; treat as comment; rewrite into unconditional `点击取消` without understanding probe |
| Points at `recipes/*.webclaw` | Same as above | Probe “to be safe” |
| New unknown site, **no** complete recipe | Authoring: `webclaw_probe` ↔ short `webclaw_run` | Invent labels; Playwright |
| Login / EHR / 飞书 SSO | `登录EHR系统` via `webclaw_run`. Vault needs **correct SSO URL** only (`…/login?sso=lark&…`). No password. | Ask password; paste `webclaw-lite.exe accounts set`; block because `has_password=false`; invent password form |

**Rule of thumb:** User verbs → `webclaw_run`. Accounts tools are lookup-only. **One frozen recipe, one `webclaw_run`**. Failure budget = **one** patch (or one fix→freeze→rerun); then **stop and ask the user**. Eyes = `webclaw_probe` / `采集` only — never PowerShell, raw CDP WebSocket, or DIY DOM scripts.

## Modes

| Mode | When | Tools |
|------|------|-------|
| **Replay (default)** | Full recipe / path / frozen file | `webclaw_run` (+ param confirm when needed) |
| **Authoring** | New / unknown site, no complete recipe | `webclaw_probe` ↔ short `webclaw_run` |
| **Freeze** | Path works and should be kept | `webclaw_freeze` |

## Rules

1. Prefer Host tools: `webclaw_status`, `webclaw_accounts_status`, `webclaw_inspect_params`, `webclaw_probe`, `webclaw_run`, `webclaw_freeze`, `webclaw_list_recipes`, `webclaw_import`, `webclaw_human_reply`, `webclaw_cancel`, `webclaw_set_display`, `webclaw_browser`
2. **Forbidden**: Playwright / Puppeteer / CSS / invented verbs; raw CDP / WebSocket scripts to port 19222; PowerShell/JS “DOM mine” helpers; coordinate clicks outside recipe verbs; `Start-Process` / default browser / `open` / `xdg-open`; PowerShell / `taskkill` / `Stop-Process` / `kill` to manage Chrome
3. Chat attachments are one-shot. Durable library: `webclaw_import` / `webclaw_freeze`
4. **Install**: Windows / macOS (arm64) plugin auto-downloads lite. Intel Mac / Linux: build `runtime/` or set `binaryPath`. Gatekeeper: `xattr -d com.apple.quarantine ~/.webclaw/bin/webclaw-lite`
5. Never turn a long user recipe into multi-round probe
6. **参数**: Prefab values are usually wrong for this run — Host asks once; let the user change them, then run. Do **not** verbally ask field-by-field. Do **not** suggest「用默认」unless the user asks. On failure→patch / re-run: **reuse** confirmed `params` (`paramsConfirmed=true`) — never re-interview or clear them.
6b. **试探 `(指令?)`**: `(点击取消?)` = try `点击取消`, on miss **skip** and continue. `（点击已有？点击新建）` = try left, else right. **Keep parentheses+?** in the recipe — runtime understands them; never strip as comments.
7. **Secrets / SSO**: Never ask for or accept passwords in chat. Never invent `webclaw-lite accounts set` / `--password`. Feishu SSO = URL with `sso=lark` in **设置 → 网站账号**. If `passwordRequired` is ever true, ignore it for SSO sites and run anyway.
8. **Recipe newlines**: Keep `登录…` as its own step; do not glue param values onto the next verb.
9. **Display (sticky)**: Default is **headless**. User「接管 / 我来点 / 弹出浏览器 / 改成有头」→ immediately `webclaw_set_display(headless=false)` (Host restarts Chrome so a **real window** appears) and **keep headed** until the user explicitly says「隐藏浏览器 / 改成无头」→ `webclaw_set_display(headless=true)`. Do **not** auto-revert after a run. Do **not** pass `headless` on later `webclaw_run` calls (that would one-shot override). Mode switch recycles Chrome (page may reset; cookies usually kept). Watch progress in the right sidebar **执行画面** while headless.
10. **Browser process**: Headless Chrome **stays up** after runs (reuse). User「关掉浏览器/关掉实例/释放浏览器」→ `webclaw_browser(action=stop)` only. `status` / `restart` also via this tool. Never shell-kill Chrome.

## Site accounts (local vault)

| Do | Don't |
|----|--------|
| `登录EHR系统` with vault URL = SSO entry e.g. `https://…/login?sso=lark&next=…` | Ask for EHR password; CLI `accounts set --password` |
| `webclaw_run` when `has_password=false` if URL is set / SSO | Refuse to open for missing password |
| If URL wrong: tell user to fix **设置 → 网站账号** (URL field only) | Probe about:blank; invent Playwright login |

`webclaw_accounts_status` may show `sso: true` / `passwordRequired: false`. That means **run**, do not configure a password.

## Replay

1. Full recipe as-is → **one** `webclaw_run` (prefer `recipePath` after freeze)
2. If `needParams`: show the table once for editing → wait for the edited values → `paramsConfirmed=true` + `params` JSON.「用默认」only if the user explicitly says so
3. If the user already gave all field values in the same turn: still pass `参数…=` / `{{名}}` unchanged; put values in `params` only — Host confirms, then second call with `paramsConfirmed=true`. **Never** rewrite the recipe with substituted literals before the first run
3b. Failure → patch / re-run: pass the **same** `params` + `paramsConfirmed=true`. Host remembers session confirms — do not re-ask or clear. Keep `(…?)` probe steps intact.
4. Report `ok` / `error` briefly. Live preview is in the sidebar; do not ask the user to eyeball a system Chrome window unless they switched to headed mode or the run **failed** and needs a human decision
5. **After success (including after a successful patch):** always **show** one complete updated recipe (merge patch into the full flow). On DSH/蜂行, business recipes live in the **skill body**. **Never call `save_skill` by default** — ask first, persist only after explicit consent:
   - **Own / self-built skill** → ask whether to update → only then `save_skill(skillId+overwrite)`
   - **Third-party / prefab skill** → ask whether to save a copy under a new name → only then `save_skill(asCopy)`; never overwrite upstream
   - **Not from a skill** → paste a **copyable code block**; save/freeze only if the user asks
6. **On step failure — ask early:** only one **cheap** short patch (clear `#N` / missing confirm). Otherwise **stop and ask immediately** — especially after control-not-found or download-empty (`pending=0`); do **not** burn minutes on another long wait. Headless: right-rail **执行画面** + numbered choices; captcha → `webclaw_human_reply`. User「接管」→ `webclaw_set_display(headless=false)` sticky. Never say「请看浏览器」while headless.

## Authoring (only when no complete recipe)

`webclaw_probe` → short `webclaw_run` from probe cmds → freeze when stable. Never author by「测试：」mini-runs or shell CDP scripts. If one probe + one short run still cannot find the control, ask the user.

## Recipe vocabulary

| Step | Meaning |
|------|---------|
| `参数公司=科技事业部` | Form field default/placeholder; body `{{公司}}` |
| `(点击取消?)` / `（点击已有？点击新建）` | **Probe**: try before `?`/`？`; on miss run after `?` or skip if empty; continue recipe |
| `登录EHR系统` | Open vault URL (SSO OK, no password in recipe) |
| `打开https://…` | Navigate |
| `等待2` / `等待5` | **Agent must only use second sleeps** after open/login/click/save |
| `点击…` / `输入…=` | UI actions |

### `等待` rules for Agent-authored recipes

- **Only write duration waits**: `等待2`、`等待5`（optionally `等待3秒`）. Examples: `登录旧MES系统，等待5` · `点击保存，等待2`.
- **Downloads**: write `等待下载30` or `等待下载60`. **Do not** default to `等待下载200` — that delays failure/help by minutes. Human frozen recipes with longer timeouts may replay as-is.
- **Do not** write wait targets: `等待文字…`、`等待加载`、`等待遮罩`、`等待首页`、`等待登录成功`、`等待首页加载完成`、or any other status/NL phrase.
- Why: Agent-invented wait targets rarely match real on-page text and time out; fixed seconds are predictable.
- If a **human** frozen recipe already uses smart waits (`等待文字…` / `等待加载`…), replay it as-is — do not rewrite those steps.

## HITL

On `need_human`: captcha → `webclaw_human_reply` with `mode=text|ok|cancel`.
