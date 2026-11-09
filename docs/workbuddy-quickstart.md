# WorkBuddy / Cursor 用户安装（无需开发机）

面向**任意互联网用户**：不 clone 仓库、不碰 cargo、不依赖蜂行 / DSH 客户端。装好后在 WorkBuddy（或 Cursor）里直接调用 `webclaw_*` 工具。

> 当前钉选版本：**v0.2.1**（可用环境变量改成 `latest`）。  
> 仓库：<https://github.com/lonk1989/webclaw-x>

## 你需要什么

| 项 | 说明 |
|----|------|
| 系统 | Windows x64 / macOS Apple Silicon / Linux x86_64 |
| 软件 | [Google Chrome](https://www.google.com/chrome/)（或 Chromium）、[Python 3.10+](https://www.python.org/downloads/)（Windows 安装时勾选 Add to PATH） |
| 助手 | [腾讯 WorkBuddy](https://copilot.tencent.com/) 或 Cursor（支持自定义 stdio MCP） |
| 网络 | 能访问 GitHub Releases（国内脚本会自动尝试 `ghfast.top` 等镜像） |

## 一键安装

### Windows

以**普通用户 PowerShell**执行（不必管理员）：

```powershell
irm https://raw.githubusercontent.com/lonk1989/webclaw-x/main/scripts/install_workbuddy.ps1 | iex
```

可选：指定业务域名白名单草稿、版本：

```powershell
$env:WEBCLAW_VERSION = "0.2.1"
$env:WEBCLAW_HOSTS = "app.example.com,login.example.com"
irm https://raw.githubusercontent.com/lonk1989/webclaw-x/main/scripts/install_workbuddy.ps1 | iex
```

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/lonk1989/webclaw-x/main/scripts/install_workbuddy.sh | bash
```

```bash
export WEBCLAW_VERSION=0.2.1
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

## 接通 WorkBuddy

1. **完全退出并重新打开** WorkBuddy（或在插件 → MCP 里刷新）
2. 确认 `webclaw-x` 显示可用（绿灯）
3. 对话示例：
   - 「用 webclaw 查一下 status」
   - 粘贴一整段菜谱，要求**一次**执行（不要逐步点）

Cursor：设置 → MCP，确认 `webclaw-x` 已加载后重连。

## 域名白名单（跑真实业务前必做）

未配置时，导航到未放行域名会被拒绝（`POLICY_DENIED`）。

```text
%LOCALAPPDATA%\webclaw\policy.json.draft   → 审阅后改名为 policy.json
~/.webclaw/policy.json.draft               → 同上
```

只写精确主机名，不要 `*`。改完后无需重装，重连 MCP 即可。

## 升级

重跑同一条一键命令（可把 `WEBCLAW_VERSION` 改成新版本或 `latest`）。插件版本戳与 lite 会按新包覆盖。

## 国内网络

脚本默认按顺序尝试：你自定义的 `WEBCLAW_LITE_BASE` → `ghfast.top` 镜像 → `mirror.ghproxy.com` → 官方 GitHub。  
若公司有内网 OSS，可事先设置：

```powershell
$env:WEBCLAW_LITE_BASE = "https://your-cdn.example.com/webclaw-lite/v0.2.1"
$env:WEBCLAW_HOST_URL  = "https://your-cdn.example.com/webclaw-x-host-0.2.1.zip"
```

## 与蜂行客户端的区别

| | 蜂行 / DSH 二次开发包 | 本页（WorkBuddy 等） |
|--|----------------------|----------------------|
| 分发 | 安装包内嵌 + 阿里云 OSS | 用户本机一键脚本 + GitHub/镜像 |
| Host | Cordis 插件 `@lonk1989/webclaw` | Python MCP `webclaw_x` |
| 配置 | `cordis.patch.yml` 的 `liteBaseUrl` | `mcp.json` 自动合并 |

## 仍做不到的（已知边界）

- 没有独立 `.msi` / App Store 安装器（当前是脚本 + 预编译）
- 未上架 PyPI；Host 来自 GitHub Release / 源码包
- 豆包工作「远程伙伴」若无本机 MCP，需另走远程技能路径，不是本页
- Host 的 Stop 按钮须真实调用 `webclaw_cancel`（见 [third-party-hosts.md](./third-party-hosts.md)）

## 卸载

删除数据目录，并从 mcp.json 去掉 `webclaw-x` 段：

- Windows：`%LOCALAPPDATA%\webclaw`
- macOS / Linux：`~/.webclaw`
