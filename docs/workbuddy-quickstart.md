# WorkBuddy / Cursor 用户安装（无需开发机）

面向**任意互联网用户**：不 clone 仓库、不碰 cargo、不依赖蜂行 / DSH 客户端。装好后在 WorkBuddy（或 Cursor）里直接调用 `webclaw_*` 工具。

> 当前钉选版本：**v0.2.4**（可用环境变量改成 `latest`）。  
> 仓库：<https://github.com/lonk1989/webclaw-x>

## 你需要什么

| 项 | 说明 |
|----|------|
| 系统 | Windows x64 / macOS Apple Silicon / Linux x86_64 |
| 软件 | [Google Chrome](https://www.google.com/chrome/)（或 Chromium）、[Python 3.10+](https://www.python.org/downloads/)（Windows 安装时勾选 Add to PATH） |
| 助手 | [腾讯 WorkBuddy](https://copilot.tencent.com/) 或 Cursor（支持自定义 stdio MCP） |
| 网络 | 默认从**阿里云 OSS**拉包（国内稳定）；失败再回退 GitHub / 镜像 |

## 一键安装

### Windows

以**普通用户 PowerShell**执行（不必管理员）：

```powershell
irm https://raw.githubusercontent.com/lonk1989/webclaw-x/main/scripts/install_workbuddy.ps1 | iex
```

可选：指定业务域名白名单草稿、版本：

```powershell
$env:WEBCLAW_VERSION = "0.2.4"
$env:WEBCLAW_HOSTS = "app.example.com,login.example.com"
irm https://raw.githubusercontent.com/lonk1989/webclaw-x/main/scripts/install_workbuddy.ps1 | iex
```

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/lonk1989/webclaw-x/main/scripts/install_workbuddy.sh | bash
```

```bash
export WEBCLAW_VERSION=0.2.4
export WEBCLAW_HOSTS='app.example.com,login.example.com'
curl -fsSL https://raw.githubusercontent.com/lonk1989/webclaw-x/main/scripts/install_workbuddy.sh | bash
```

## 脚本做了什么

1. 下载预编译 **webclaw-lite** → `%LOCALAPPDATA%\webclaw\bin`（或 `~/.webclaw/bin`）
2. 下载 MCP Host（优先 Release 的 `webclaw-x-host.zip`，否则 GitHub 源码包中的 `webclaw_x/`）
3. 在 `…/webclaw/host/.venv` 创建 Python 虚拟环境并 `pip install`
4. 写出 MCP 片段，并**自动合并**到：
   - WorkBuddy：`%USERPROFILE%\.workbuddy\mcp.json` / `~/.workbuddy/mcp.json`
   - Cursor：`%USERPROFILE%\.cursor\mcp.json` / `~/.cursor\mcp.json`
5. 若传了 `WEBCLAW_HOSTS`，生成 `policy.json.draft`（需你审阅后改名为 `policy.json`）

不想改助手配置时：`$env:WEBCLAW_NO_MERGE=1` 或 `WEBCLAW_NO_MERGE=1`。

## 接通后：助手如何用（必读）

WorkBuddy / Cursor 连接 MCP 后，模型会收到内置 **instructions（动词快卡）**。  
人也请打开本机副本（安装脚本已写入）：

- `%LOCALAPPDATA%\webclaw\mcp\RECIPE-VERBS.md`
- 或仓库 [docs/recipe-verbs.md](./recipe-verbs.md)

**核心约定：**

| 你说 | 助手应调用 |
|------|------------|
| 打开 MES / 打开 https://… | `webclaw_run`，菜谱里带动词 `打开…` |
| 打开…，点击…，采集… | **一句菜谱**一次 `webclaw_run` |
| 有哪些网站账号 | 才查 accounts（查列表 ≠ 已打开） |
| 改成有头 / 弹出浏览器 | `webclaw_set_display(headless=false)` |
| 改成无头 / 不要弹窗 | `webclaw_set_display(headless=true)` |

默认**无头**跑（不弹系统 Chrome）。不要期望助手只查保险箱就完成「打开」；「打开」是 webclaw 动词指令。

## 接通 WorkBuddy

1. **完全退出并重新打开** WorkBuddy（或在插件 → MCP 里刷新）
2. 确认 `webclaw-x` 显示可用（绿灯）
3. 对话示例：
   - 「打开 https://example.com，等待 2，采集」
   - 「打开 MES」（需保险箱里已有对应站点名）
   - 「用 webclaw 查一下 status」

Cursor：设置 → MCP，确认 `webclaw-x` 已加载后重连。

## 域名白名单（可选加固）

**默认关闭**，安装后即可打开任意业务站。若要启用：

```json
{
  "enabled": true,
  "allow_localhost": true,
  "allowed_hosts": ["app.example.com", "login.example.com"]
}
```

写入 `%LOCALAPPDATA%\webclaw\policy.json`（或 `~/.webclaw/policy.json`）。只写精确主机名，不要 `*`。安装时也可：`$env:WEBCLAW_HOSTS='a.com,b.com'`。

## 升级

重跑同一条一键命令（可把 `WEBCLAW_VERSION` 改成新版本或 `latest`）。插件版本戳与 lite 会按新包覆盖。

## 国内网络 / OSS

默认下载根：

```text
https://feixingai-agent.oss-cn-beijing.aliyuncs.com/webclaw-x/v0.2.4/
```

内含 Win / macOS arm64 / Linux x64 的 `webclaw-lite-*` 与 `webclaw-x-host.zip`（及 `.sha256`）。  
指针：`https://feixingai-agent.oss-cn-beijing.aliyuncs.com/webclaw-x/latest.json`

安装脚本顺序：**OSS → GitHub → ghfast / ghproxy（仅兜底）**。

发版后同步 OSS（维护者本机）：

```powershell
# 先把 Release 资产下到某目录，再上传
node scripts/upload_oss.mjs --version 0.2.4 --dir $env:TEMP\webclaw-x-oss-v0.2.4
```

覆盖默认 OSS 根或单文件：

```powershell
$env:WEBCLAW_OSS_BASE = "https://feixingai-agent.oss-cn-beijing.aliyuncs.com/webclaw-x"
$env:WEBCLAW_LITE_BASE = "https://your-cdn.example.com/webclaw-x/v0.2.4"
$env:WEBCLAW_HOST_URL  = "https://your-cdn.example.com/webclaw-x-host.zip"
```

## 站点账号（保险箱）

密码不要发给模型。把导出文件放到约定路径后，webclaw 启动会自动探测（找不到就跳过）：

- `%LOCALAPPDATA%\webclaw\host-exports\workbuddy.json`（推荐）
- 或 `%USERPROFILE%\.workbuddy\webclaw-vault.json`

格式见 [`host-vault-export.md`](./host-vault-export.md)。也可用 lite：`accounts ensure` / `accounts set`。

## 与蜂行客户端的区别

| | 蜂行 / DSH 二次开发包 | 本页（WorkBuddy 等） |
|--|----------------------|----------------------|
| 分发 | 安装包内嵌 + 阿里云 OSS | 用户本机一键脚本 + GitHub/镜像 |
| Host | Cordis 插件 `@lonk1989/webclaw` | Python MCP `webclaw_x` |
| 配置 | `cordis.patch.yml` 的 `liteBaseUrl` | `mcp.json` 自动合并 |
| 保险箱 | corp-auth 同步 + `host-exports/fengxing.json` | 用户/插件写 `host-exports/workbuddy.json` |

## 仍做不到的（已知边界）

- 没有独立 `.msi` / App Store 安装器（当前是脚本 + 预编译）
- 未上架 PyPI；Host 来自 GitHub Release / 源码包
- 豆包工作「远程伙伴」若无本机 MCP，需另走远程技能路径，不是本页
- Host 的 Stop 按钮须真实调用 `webclaw_cancel`（见 [third-party-hosts.md](./third-party-hosts.md)）

## 卸载

删除数据目录，并从 mcp.json 去掉 `webclaw-x` 段：

- Windows：`%LOCALAPPDATA%\webclaw`
- macOS / Linux：`~/.webclaw`
