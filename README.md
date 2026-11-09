# webclaw-x

确定性浏览器 RPA：用**菜谱**驱动 Chrome（CDP），通过 **MCP** 交给 Cursor / WorkBuddy 等 AI 助手执行。

菜谱 = **指令（动词）** + **目标/参数**；中英动词同一回放路径（如 `打开`/`open`、`等待`/`wait`、`采集`/`collect`）。

> 仓库：<https://github.com/lonk1989/webclaw-x>  
> 当前发布：[v0.2.1](https://github.com/lonk1989/webclaw-x/releases/tag/v0.2.1)  
> 打 `v*` 标签后 GitHub Actions（`.github/workflows/release.yml`）会构建并上传 **Windows x64 / macOS arm64 / Linux x64** 预编译；也可在 Actions 里对已有 tag 手动 Run workflow。

---

## 普通用户（WorkBuddy / Cursor）— 一键安装

不需要 clone、不需要 cargo、不需要蜂行客户端。本机有 **Chrome + Python 3.10+** 即可：

**Windows（PowerShell）：**

```powershell
irm https://raw.githubusercontent.com/lonk1989/webclaw-x/main/scripts/install_workbuddy.ps1 | iex
```

**macOS / Linux：**

```bash
curl -fsSL https://raw.githubusercontent.com/lonk1989/webclaw-x/main/scripts/install_workbuddy.sh | bash
```

脚本会从**阿里云 OSS**下载预编译 lite + MCP Host（失败再回退 GitHub），并自动写入 WorkBuddy / Cursor 的 `mcp.json`。完整说明（白名单、升级、OSS）：

→ **[`docs/workbuddy-quickstart.md`](./docs/workbuddy-quickstart.md)**

---

## 它解决什么

AI 助手操作网页时，常见两条路：

- 让模型逐步点页面（慢、不稳定、难复现）
- 手写 Playwright / CSS 选择器（一改版就碎）

**webclaw-x** 走第三条：先把流程写成可冻结的菜谱，再由助手 **一次** `webclaw_run` 回放。适合登录后的业务页面、表格采集、需要人机确认（验证码）的流程。

## 适用 / 不适用

| 适合 | 不适合 |
|------|--------|
| 给 AI 助手挂确定性浏览器工具 | 当作通用无头爬虫 / 反爬对抗框架 |
| 本地或可控环境的业务回放 | 企业级云端会话托管、多租户 SaaS |
| fixture → 冻结菜谱 → 反复跑 | 每一步都靠模型现场猜选择器 |
| 需要域名白名单、取消、人审的场景 | 绕过站点安全策略或自动化猜验证码 |

非目标（详见 [FORK.md](./FORK.md)）：不重写 CDP 运行时；不把 MCP Host 与 `webclaw-lite` 揉成单进程；仓库不携带真实业务凭据。

## 核心能力

- **MCP 网关**（`webclaw_x`）：统一工具信封、脱敏、任务取消、参数确认门禁
- **`webclaw-lite` 引擎**（Rust，子进程）：菜谱解析与 Chrome CDP 执行
- **中英菜谱**：同一套动词语义；示例见 [`recipes/fixture-table.webclaw`](./recipes/fixture-table.webclaw) 与 [`.en` 版](./recipes/fixture-table.en.webclaw)
- **默认 core7 工具面**：`status` / `run` / `probe` / `freeze` / `list_recipes` / `human_reply` / `cancel`；完整目录设 `WEBCLAW_TOOLS=all`
- **安全门禁**：导航域名白名单、`NEED_HUMAN` 人审续跑、`webclaw_cancel` 可停长任务、模板参数须 `params_confirmed`
- **产物双写**：采集步骤可同时写出 Markdown / JSON / CSV（见运行产物目录）

新助手请只读一页上手：[`skills/SKILL.md`](./skills/SKILL.md)。

---

## 先决条件

- **操作系统（当前现实）**
  - **Linux x86_64**：预编译主路径（`webclaw-lite-linux-x64`）
  - **Windows x64（原生 CLI）**：可用预编译 `webclaw-lite-windows-x64.exe`（见下方安装）；`webclaw-lite serve` 已支持（loopback TCP + endpoint 文件），Host 默认仍走 CLI，需 opt-in
  - **WSL2**：可继续按 Linux 路径安装
  - **macOS**：源码在仓内；当前 Release **仍无** macOS 预编译附件
- **软件**：Python 3.10+、Google Chrome（或 Chromium）、`curl`（安装脚本下载用）
- **AI Host**：支持自定义 stdio MCP 的客户端（Cursor、WorkBuddy 等）
- **不要**把 `cargo build` 当作终端用户安装路径（会生成数 GB 的 `target/`，仅改引擎源码时需要）

---

## 安装（终端用户：预编译）

安装脚本默认下载源仍指向旧仓 `webclaw-oss`。安装 **本仓 v0.2.0** 时请显式设置：

```bash
export WEBCLAW_LITE_BASE=https://github.com/lonk1989/webclaw-x/releases/latest/download
```

当前该前缀下规划的预编译文件：

- `webclaw-lite-linux-x64` / `.sha256`（v0.2.0 已发布）
- `webclaw-lite-windows-x64.exe` / `.sha256`（Windows CLI 构建产物；由发布流程上传后可用）
- 另可选打包：`webclaw-lite-windows-x64.zip`（含 exe + `README-WINDOWS.txt` + checksum）

### Linux / WSL2（推荐）

```bash
git clone https://github.com/lonk1989/webclaw-x.git
cd webclaw-x

export WEBCLAW_LITE_BASE=https://github.com/lonk1989/webclaw-x/releases/latest/download
./scripts/install_webclaw.sh
# 可选：写出业务域名草稿（不会自动放行全世界）
# ./scripts/install_webclaw.sh --hosts 'app.example.com,login.example.com'
```

脚本会：

1. 将预编译 `webclaw-lite` 放到 `$WEBCLAW_HOME/bin/`（默认 `~/.webclaw/bin/`）
2. 创建/复用仓库 `.venv` 并安装 `requirements.txt`（`mcp` / `pytest` 等）
3. 写出 MCP 片段到 `$WEBCLAW_HOME/mcp/`（`cursor.mcp.json`、`workbuddy.mcp.json`）
4. 若传了 `--hosts`，额外生成 `policy.json.draft`（审阅后再启用）

仅下载二进制也可用：[`skills/webclaw-lite/scripts/install.sh`](./skills/webclaw-lite/scripts/install.sh)（同样需要上面的 `WEBCLAW_LITE_BASE`）。

macOS 若日后提供附件并下载成功，Gatekeeper 阻挡时可执行：

```bash
xattr -d com.apple.quarantine ~/.webclaw/bin/webclaw-lite
```

### 原生 Windows x64（CLI）

终端用户**不需要 cargo**。默认从本仓 Release 拉预编译：

```powershell
# 可选显式指定（install.ps1 默认已指向 webclaw-x）
$env:WEBCLAW_LITE_BASE = "https://github.com/lonk1989/webclaw-x/releases/latest/download"
powershell -ExecutionPolicy Bypass -File .\skills\webclaw-lite\scripts\install.ps1

# 写出 MCP 片段（需本仓 checkout + Python venv）
powershell -ExecutionPolicy Bypass -File .\skills\webclaw-lite\scripts\write_mcp_fragment.ps1
```

支持边界（请按此预期使用）：

- **已验证路径**：`status` / `run`（中英菜谱）/ `cancel` / `human-reply`（HITL 暂停与回写）/ 域名白名单拒绝
- **常驻 serve（opt-in）**：先启动 `webclaw-lite serve`，再设 `WEBCLAW_LITE_USE_SERVE=1`；默认仍 CLI。不可达时回退 CLI **一次**（不双跑）。关闭：去掉该环境变量或 `quit`/结束 serve 进程
- Host MCP 默认仍通过 **CLI 子进程** 调 lite；跨进程任务锁在 Windows 上弱于 POSIX，长任务停止请真实调用 `cancel`
- 需要 VC++ 运行库（`MSVCP140` / `VCRUNTIME140`）；可选 OCR 依赖本机 DirectML/DX12 与模型文件
- 下载前请确认 Release 已实际上传 `webclaw-lite-windows-x64.exe`；**未上传时安装脚本会失败**，这是预期行为，不是“已支持”假绿

### 开发者（仅改引擎时）

```bash
export PATH="$HOME/.cargo/bin:$PATH"
./scripts/build_runtime.sh   # 编译并安装到 ~/.webclaw/bin/；会留下很大的 target/
```

### 发版与多平台预编译（GitHub Actions）

流程与旧仓 `webclaw-oss` 的 `release.yml` 同类：推送 **`v*`** 标签后，CI 在 `windows-latest` / `macos-latest`（arm64）/ `ubuntu-22.04` 上 `cargo build --release -p webclaw --bin webclaw-lite`，并把下列资产挂到该 tag 的 Release：

| 资产名 | 平台 |
|--------|------|
| `webclaw-lite-windows-x64.exe` (+ `.sha256`) | Windows AMD64 |
| `webclaw-lite-macos-arm64` (+ `.sha256`) | macOS Apple Silicon |
| `webclaw-lite-linux-x64` (+ `.sha256`) | Linux x86_64（CI 用 Ubuntu 24.04；需 glibc ≥ 2.38） |

也可在 GitHub → Actions → **release** → Run workflow，填已有 tag（如 `v0.2.1`）补传资产。本仓 **不做** npm publish（那是 oss 插件路径）。

---

## 接通 MCP

把安装脚本生成的片段合并进 Host 的 `mcp.json`，然后**重连并信任工具**。路径请换成你本机的实际位置：

```json
{
  "mcpServers": {
    "webclaw-x": {
      "command": "/path/to/webclaw-x/.venv/bin/python",
      "args": ["-m", "webclaw_x.server"],
      "env": {
        "PYTHONPATH": "/path/to/webclaw-x",
        "WEBCLAW_LITE_BIN": "/home/YOU/.webclaw/bin/webclaw-lite",
        "WEBCLAW_HOME": "/home/YOU/.webclaw",
        "WEBCLAW_HEADLESS": "0",
        "WEBCLAW_TOOLS": "core",
        "WEBCLAW_STATUS_MODE": "fast"
      }
    }
  }
}
```

要点：

- **常驻 stdio**：一个会话只拉起一次网关；不要每个工具调用都重新 spawn
- 默认 `WEBCLAW_TOOLS=core`（约 7 个工具）；完整工具面设 `"WEBCLAW_TOOLS": "all"`
- **普通用户请优先** [`docs/workbuddy-quickstart.md`](./docs/workbuddy-quickstart.md)（一键安装）
- 开发者 / 契约细节见 [`docs/third-party-hosts.md`](./docs/third-party-hosts.md)

手工启动（调试用）：

```bash
cd /path/to/webclaw-x
export PYTHONPATH=.
export WEBCLAW_LITE_BIN="$HOME/.webclaw/bin/webclaw-lite"
export WEBCLAW_HOME="$HOME/.webclaw"
.venv/bin/python -m webclaw_x.server
```

二进制查找顺序：`WEBCLAW_LITE_BIN` → 仓内 `target/release/webclaw-lite` → `bin-webclaw-lite` → `~/.webclaw/bin/webclaw-lite`。

### 可选：常驻 serve（减少重复拉起引擎）

默认保持 CLI，稳定性优先。需要常驻时：

```powershell
# 1) 另开终端启动 daemon（Windows 写 endpoint JSON 到 %WEBCLAW_HOME%\lite.sock）
$env:WEBCLAW_HOME = "$env:LOCALAPPDATA\webclaw"
& "$env:WEBCLAW_HOME\bin\webclaw-lite.exe" serve

# 2) MCP env 增加（写在 mcp.json 的 env 里）
#    WEBCLAW_LITE_USE_SERVE=1
#    可选 WEBCLAW_LITE_SOCKET=<endpoint 文件路径>
```

回退与限制：

- **关闭**：去掉 `WEBCLAW_LITE_USE_SERVE`，或向 serve 发 `quit` / 结束进程
- **回退**：endpoint 缺失或连接失败时 Host 回退 CLI；**同一业务 run 不会在 serve 失败后再用 CLI 重跑一遍**（仅当 serve 完全不可达、尚未接到 run 时走 CLI）
- Host 走 serve 时 `run` 带 `early_hitl`：人审先返回 `NEED_HUMAN`，再用 `webclaw_human_reply`（内部 serve `human-reply`/`collect`）续跑
- 常驻主要省进程/模型加载成本；**不要**把网页等待算作引擎提速，也不假设模型常驻必然加快单次推理

---

## 最小示例（本地 fixture，无真实站点）

仓库自带静态站 [`fixtures/site/`](./fixtures/site/) 与冻结菜谱，不需要业务账号。

**中文菜谱**（[`recipes/fixture-table.webclaw`](./recipes/fixture-table.webclaw)）：

```text
打开http://127.0.0.1:8765/table.html，等待文字加油记录5，采集表格
```

**英文等价**（[`recipes/fixture-table.en.webclaw`](./recipes/fixture-table.en.webclaw)）：

```text
open http://127.0.0.1:8765/table.html, wait 加油记录5, collect table
```

在已接通的 MCP 会话中：

1. 调用一次 `webclaw_status`
2. 调用一次 `webclaw_list_recipes`
3. 对完整菜谱调用一次 `webclaw_run`（**禁止**拆成逐步 `probe`）

CLI 评测入口（可选）：

```bash
cd /path/to/webclaw-x
.venv/bin/python scripts/eval_smoke.py
# 或常驻调用：
.venv/bin/python scripts/call_tool.py --persist webclaw_status '{}'
```

真业务开跑前，请按 [`skills/SKILL.md`](./skills/SKILL.md) 勾完 checklist（policy / 参数确认 / HITL / cancel / 禁逐步 probe）。

### 菜谱动词（MVP）

`打开`/`open` · `点击`/`click` · `等待`/`wait` · `输入`/`type` · `采集`/`collect` · `刷新`/`reload` · `截图`/`screenshot` · `滚动`/`scroll` · `按`/`press` · `参数`/`param`

编排期可用 `probe` → `freeze` 固化；稳定后回放只走 `run`。

---

## 安全、白名单、人审与取消

| 机制 | 行为 |
|------|------|
| 域名白名单 | 默认启用，仅 localhost / loopback；业务域名写入 `$WEBCLAW_HOME/policy.json` 的 `allowed_hosts` |
| 策略草稿 | `python scripts/policy_draft.py --hosts 'app.example.com' --out "$WEBCLAW_HOME/policy.json.draft"`；**审阅后再**改为 `policy.json` |
| 人审 HITL | 验证码等返回 `NEED_HUMAN`；用 `webclaw_human_reply` 续跑同一任务，不猜码 |
| 参数确认 | 菜谱含 `{{...}}` 时须用户确认并传 `params_confirmed=true` |
| 取消 | Host 停止长任务必须真实调用 `webclaw_cancel`；只停聊天输出不够，否则可能 `RUN_BUSY` |
| 脱敏 | 密码 / 验证码不应写入菜谱或聊天明文；密码走 accounts 金库路径 |

这是**导航动作白名单**，不是完整浏览器网络防火墙。边界说明：[docs/policy-and-hitl.md](./docs/policy-and-hitl.md)。示例配置：[config/policy.example.json](./config/policy.example.json)。

**禁止**：根据页面内容自动设置 `WEBCLAW_POLICY_ENABLED=0`、自动猜验证码、或把真实生产凭据提交进仓库。

---

## 平台与已知限制

| 项目 | 现状 |
|------|------|
| 预编译 Release | Win / macOS arm64 / Linux x64 lite；另附 `webclaw-x-host.zip`（MCP Host，供一键安装） |
| MCP Host 执行菜谱 | 默认仍通过 **CLI 子进程** `run`；`WEBCLAW_LITE_USE_SERVE=1` 时优先常驻（`early_hitl`） |
| `webclaw-lite serve` | Unix：socket；Windows：`127.0.0.1` TCP + `<WEBCLAW_HOME>/lite.sock` endpoint JSON；ops：ping/status/prewarm/run/cancel/human-reply/collect/quit。**不**作为默认 Host 路径 |
| 跨进程任务互斥 / cancel | POSIX（Linux）更完整；Windows CLI/`serve cancel` 可用；Host 侧跨进程锁弱于 POSIX |
| 默认工具面 | `WEBCLAW_TOOLS=core`；`all` 才暴露 recipe 库 / accounts / `policy_draft` 等 |
| 可选预热 | `WEBCLAW_PREWARM=1`；强制冷启 Chrome：`WEBCLAW_CHROME_RECYCLE=1` |

---

## 文档导航

| 文档 | 内容 |
|------|------|
| [docs/workbuddy-quickstart.md](./docs/workbuddy-quickstart.md) | **普通用户**一键安装（WorkBuddy / Cursor） |
| [skills/SKILL.md](./skills/SKILL.md) | 新助手 1 页上手 + 真业务 checklist |
| [docs/third-party-hosts.md](./docs/third-party-hosts.md) | 第三方 Host / MCP 接入与取消约定 |
| [docs/policy-and-hitl.md](./docs/policy-and-hitl.md) | 域名策略与人审 |
| [docs/recipe-library.md](./docs/recipe-library.md) | 菜谱版本库 |
| [docs/self-heal.md](./docs/self-heal.md) | 单步自愈（默认关闭） |
| [docs/component-pack.md](./docs/component-pack.md) | 日期 / 下拉 / 分页等组件 |
| [docs/ambiguity-design.md](./docs/ambiguity-design.md) | 定位歧义（`AMBIGUOUS_TARGET`） |
| [FORK.md](./FORK.md) | 与上游关系、非目标、回滚线索 |
| [runtime/PROVENANCE.md](./runtime/PROVENANCE.md) | `runtime/` 出处 |

评测与回归脚本在 `scripts/`（如 `eval_smoke.py`、`eval_all.py`）；本地测试可用 `pytest`。报告数字会随环境和版本变化，**不以历史看板数字作为永久保证**。

---

## 仓库结构（简图）

```text
webclaw_x/          Python MCP 网关
runtime/            内嵌 webclaw-lite（Rust）源码
scripts/            安装、评测、policy 草稿、工具调用
skills/SKILL.md     给 AI Host 的一页上手
recipes/            fixture 菜谱
fixtures/site/      本地静态演示站
docs/               设计与接入说明
examples/           更多示例与编写指南
```

---

## 贡献与问题反馈

- Bug、安装问题、功能建议：请到 GitHub [Issues](https://github.com/lonk1989/webclaw-x/issues) 开单
- 安全相关疑虑：同样先开 Issue 描述影响面（仓库暂无独立 `SECURITY.md`）
- 提交 PR 前请说明动机、复现/验证步骤；大改动建议先开 Issue 对齐范围
- 仓内暂无 `CONTRIBUTING.md` / CI badge；以 Issue 与审阅讨论为准

## 许可与上游归因

- 本仓库采用 **MIT** 许可，见 [LICENSE](./LICENSE)
- 浏览器引擎源自 MIT 项目 [webclaw-oss](https://github.com/lonk1989/webclaw-oss)；本仓以 monorepo 形式收纳 `runtime/`，MCP Host 仍通过子进程调用 lite
- 关系、查找路径与非目标见 [FORK.md](./FORK.md) 与 [runtime/PROVENANCE.md](./runtime/PROVENANCE.md)
