# @lonk1989/webclaw

DeepSeek Harness community plugin for **deterministic browser RPA** driven by Chinese natural-language recipes (English vocabulary planned later).

Cordis plugin id: `webclaw` (fiber `id` in patch). npm package: **`@lonk1989/webclaw`**.

## What this is

- Task tools: `webclaw_probe` / `webclaw_run` / `webclaw_inspect_params` / `webclaw_accounts_status` / `webclaw_freeze` / `webclaw_list_recipes` / `webclaw_import` / `webclaw_status` / `webclaw_human_reply` / `webclaw_cancel` / `webclaw_reset` / `webclaw_set_display` / `webclaw_browser`（status 含 busy/HITL/cancelMarker；卡死用 reset soft|hard）
- Bundled Skill: **replay** (default) → **param form** when `参数…=` → **freeze** / **author** only for new sites
- Local library: workspace `recipes/*.webclaw` (or `WEBCLAW_HOME/recipes`)
- Preview/edit: DSH Files + sidebar plain text; **执行画面** right tab (`webclaw-live`) for headless step previews
- Spawns local **webclaw-lite** (CDP; **default headless**; shared browser across probe/run)

## What this is not

- Not Playwright / CSS-selector MCP
- Does **not** register `ctx.browserUse`
- Not a cloud skill store

## Install

```sh
cd /path/to/deepseek-harness
pnpm add @lonk1989/webclaw
# or: dsh plugin --profile web add @lonk1989/webclaw
```

```yaml
- insert:
    - id: webclaw
      name: '@lonk1989/webclaw'
      config:
        # defaults: ensureOnBoot true → download lite (Windows / macOS arm64)
        registerSkill: true
        recipesRel: recipes
        # Optional overrides:
        # binaryPath: 'C:/path/to/webclaw-lite.exe'  # or '/path/to/webclaw-lite'
        # liteBaseUrl: 'https://cdn.example.com/webclaw/v0.1.8'  # tried first
        # systems:   # private DSH fork only — real login URLs, no passwords
        #   - id: my-app
        #     name: 演示系统
        #     url: https://example.com/login
```

### webclaw-lite binary (Windows / macOS)

You do **not** need to install lite by hand when using the defaults on **Windows x64** or **macOS Apple Silicon (arm64)**:

1. Plugin boot (and first tool call) downloads the matching Release asset for **this package version** (`webclaw-lite-windows-x64.exe` or `webclaw-lite-macos-arm64`)
2. Sources (in order): non-GitHub `liteBaseUrl` → `WEBCLAW_LITE_MIRRORS` → built-in mirrors (`ghfast.top`, then `mirror.ghproxy.com`) → official GitHub (last, so CN users are not stuck waiting on a dead GitHub)
3. Verifies the companion `.sha256`, then installs to `%LOCALAPPDATA%\webclaw\bin\webclaw-lite.exe` (Windows) or `~/.webclaw/bin/webclaw-lite` (macOS)
4. Runs `webclaw-lite install` (Chrome probe + marker)

Each source times out after ~60s before the next. Set `WEBCLAW_LITE_MIRRORS` to comma-separated release dirs or proxy prefixes if you need extra fallbacks.

**macOS Gatekeeper:** unsigned downloads may be quarantined. Clear with:

```sh
xattr -d com.apple.quarantine ~/.webclaw/bin/webclaw-lite
```

**macOS Intel (x64) / Linux:** set `binaryPath` to a locally built binary, or build from `runtime/` (x64 asset name is reserved; CI does not publish it yet).

Manual installers (optional):

```powershell
# Windows（本仓一键安装）
irm https://raw.githubusercontent.com/lonk1989/webclaw-x/main/scripts/install_workbuddy.ps1 | iex
```

```sh
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/lonk1989/webclaw-x/main/scripts/install_workbuddy.sh | bash
```

## Model experience

1. **Default / replay:** user pastes a full recipe or points at `.webclaw` → `webclaw_run` — never probe step-by-step
2. **参数 form:** prefab `参数公司=…，参数月份=…` are **placeholders users usually must edit** (see `examples/整理6月考勤.webclaw`) → first `webclaw_run` returns `needParams` → show **one editable table** (no verbal Q&A) → user edits → second `webclaw_run` with `paramsConfirmed=true` + `params` JSON.「用默认」only if the user explicitly asks. Config: `requireParamConfirm` (default true)
3. New unknown site (no complete recipe): `webclaw_probe` → short `webclaw_run` → `webclaw_freeze`
4. User opens `recipes/*.webclaw` in Files — Client tints the icon and shows a log-style preview
5. Uploaded `.webclaw`: `recipePath` once (with param confirm if needed), or `webclaw_import` into the library

## Site accounts / passwords (local only)

DSH sends chat to the model over the network. **Do not put site passwords in recipes or chat.**

### Deploy overlay: seed login URLs (no passwords)

Private DSH forks can prefill **id / name / URL** on boot (OSS ships **no** built-in site catalog):

```yaml
config:
  systems:
    - id: my-app
      name: 演示系统
      # Prefer the real SSO entry (Feishu/Lark). Password not required.
      url: https://your-corp/login?sso=lark&next=%2F%23%23%2Findex
```

This runs `webclaw-lite accounts ensure` and never writes passwords. Keep real URLs in your private patch, not in public OSS. For Feishu SSO, URL alone is enough — do not ask users for passwords.

### User credentials (once per machine) — settings form

Open **Settings → 网站账号** in DSH (local Host must be on this machine). The form talks to a **loopback-only** service (`127.0.0.1:19229` by default); passwords are written into the webclaw vault (DPAPI on Windows; obfuscated storage on macOS) and **never** enter chat or the model.

Fallback launchers (no PATH needed; created on plugin boot):

```text
Windows: %LOCALAPPDATA%\webclaw\bin\webclaw-accounts.cmd
macOS:   ~/.webclaw/bin/webclaw-accounts
```


Config knobs: `accountsUi` (default true), `accountsUiPort` (default 19229), `liveAutoOpen` (default false — set true to expand the right-rail live tab when a run starts).

Recipes use vault-matched login only, e.g. `登录{保险箱站点名}` (exact name). Use the **SSO login URL** in the vault when the corp site supports Feishu/Lark SSO. Missing password does **not** block opening the site; the login step opens the URL, handles authorize when needed, and only asks for vault passwords on a classic username/password form. The agent must never invent `accounts set --password`, ask you to paste a password into chat, or invent built-in EHR/MES/OA aliases.

## 资料库晋升（opt-in）

Successful runs copy deliverables into the DSH workspace `outputs/webclaw-…/` and mark Fengxing’s artifact index.

| Source | Promoted? |
|--------|-----------|
| `downloads/`, `files/` | Always (browser downloads & attachments) |
| User「截图」, AI 分析 / 推送AI reports | Yes — via run_dir `library-manifest.jsonl` |
| Collect table CSV / `.tables.json` with **rows > 0** | Yes — via manifest |
| `页面采集-*.md`, failure screenshots, live-preview / executions | No (stay in run dir for preview/debug) |

Optional defense in Fengxing `%APPDATA%/Fengxing/dsh-home/library.json` → `denyNamePatterns`:

```json
"denyNamePatterns": [
  "failure",
  "^页面采集",
  "^live-"
]
```

## License

MIT
