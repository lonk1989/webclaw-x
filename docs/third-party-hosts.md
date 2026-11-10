# 第三方 Host 接入调研（P0）

> 目标：验证「第三方 Agent 只靠 MCP 契约就能写菜谱、回放、出产物」。
> 日期：2026-11-06（Asia/Shanghai）
>
> **普通互联网用户请先看：[workbuddy-quickstart.md](./workbuddy-quickstart.md)**（一键安装，无需开发机）。本文偏契约与验收。

## 结论摘要

| Host | 自定义 MCP | stdio | 配置入口 | 本仓 L3 对照 |
|------|------------|-------|----------|--------------|
| **腾讯 WorkBuddy** | **支持** | **支持** | `~/.workbuddy/mcp.json` 或插件 UI | **适合做 L3 加分项** |
| WorkBuddy Enterprise / CodeBuddy | 支持 | 支持（另有 SSE/HTTP） | 同系 mcp.json / CLI | 企业版同协议 |
| Cursor / DSH | 支持 | 支持 | 既有 | L1/L2 主验收 |

**WorkBuddy 可以接自定义 stdio MCP**，因此「装 WorkBuddy 跑本仓 MCP」方向成立。  
本机（Grok Bot box）是否方便安装 WorkBuddy 客户端取决于其发行渠道（多为桌面安装包 / 腾讯系分发）；**P0 发版门禁仍以 L1（本仓 pytest）+ L2（MCP Inspector / 最小 Client）为准**，WorkBuddy 为 L3。

**接通后第一优先级：** MCP `instructions`（`webclaw_x/fast_card.py`）会把「打开/点击/采集 → `webclaw_run`」交给模型；人读 [recipe-verbs.md](./recipe-verbs.md) / `$WEBCLAW_HOME/mcp/RECIPE-VERBS.md`。勿只测 accounts 列表。

## 首载加速：常驻 MCP（强制约定）

第三方 Host / 自研桥 **必须常驻 stdio 会话**：

- ✅ 一次 `command`+`args` 拉起 `python -m webclaw_x.server`，会话内多次 `tools/call`
- ❌ 每个工具调用都重新 spawn Python 网关（旧 `call_tool.py` 单次模式会把就绪从 ~0.4s 打到 ~2s+）
- 评测脚本请用：`python scripts/call_tool.py --persist webclaw_status '{}' webclaw_list_recipes '{}'`
- `webclaw_status` 默认 **Host 热路径**（不进 lite）；深度 HITL 才设 `WEBCLAW_STATUS_MODE=lite`
- 可选 `WEBCLAW_PREWARM=1`：网关启动时后台预热 Chrome（默认关）
- 默认 `WEBCLAW_TOOLS=core`（list_tools ≈7）；完整目录设 `WEBCLAW_TOOLS=all`
- 安装：优先 `./scripts/install_webclaw.sh`（预编译 + 写出 `$WEBCLAW_HOME/mcp/*.mcp.json`），勿默认 cargo
- policy 草稿：`python scripts/policy_draft.py --hosts 'app.example.com' --out $WEBCLAW_HOME/policy.json.draft`（审阅后才启用）
- 登录态：健康 CDP 默认复用；`WEBCLAW_CHROME_RECYCLE=1` 才强制冷启。可选与 `WEBCLAW_PREWARM=1` 搭配
- `webclaw-lite serve`（**Unix only**）：phase-2 支持 `run`/`cancel` 常驻；OCR OnceLock 同进程复用。Host 网关默认仍走 CLI run；Windows serve 未就绪

`chromeOk` = Chrome 二进制存在；`cdpReady` = 调试口可连；多实例/孤儿看 `chromeInstances.orphanRisk` / `chromeWarn`。

## WorkBuddy 证据

1. 腾讯云开发者社区《如何在 WorkBuddy 中使用 MCP Server？》（2026-06-25）  
   - 连接器底层即 MCP。  
   - 支持**配置自定义 MCP Server**。  
   - 配置文件：`~/.workbuddy/mcp.json`。  
   - 示例为 `command` + `args` + `env`（stdio 形态）。

2. WorkBuddy 手册（neohoy.github.io/workbuddybook）  
   - 用户级：`~/.workbuddy/mcp.json`  
   - 项目级：`<项目>/.workbuddy/mcp.json`  
   - UI：插件 → MCP 服务器 → 配置 MCP；绿灯可用。

3. 腾讯云《WorkBuddy Enterprise MCP 使用文档》  
   - 明确传输类型：**STDIO / SSE / HTTP**。  
   - `command` 字段存在时推断为 stdio。  
   - CLI：`codebuddy mcp add …`

4. 社区实践（吴英延等）  
   - 本地 Windows 上用 `mcp.json` 注册自写 MCP，暴露 open/login 等工具，WorkBuddy 对话内真实调用。


## 一键复制（本机 Linux box 路径）

把下面整段写入 `~/.workbuddy/mcp.json`（或项目级 `.workbuddy/mcp.json`）后看绿灯：

```json
{
  "mcpServers": {
    "webclaw-x": {
      "command": "/workspace/webclaw-x/.venv/bin/python",
      "args": ["-m", "webclaw_x.server"],
      "env": {
        "PYTHONPATH": "/workspace/webclaw-x",
        "WEBCLAW_LITE_BIN": "/home/box/.webclaw/bin/webclaw-lite",
        "WEBCLAW_HOME": "/home/box/.webclaw",
        "WEBCLAW_HEADLESS": "1"
      }
    }
  }
}
```

平台说明：本次生命周期加固使用 POSIX `flock` / 进程组，Linux 已验证；原生 Windows 不能仅替换路径，需另做锁与终止适配（可考虑 Linux/WSL 部署）。

## 推荐接入片段（webclaw-x）

```json
{
  "mcpServers": {
    "webclaw-x": {
      "command": "/workspace/webclaw-x/.venv/bin/python",
      "args": ["-m", "webclaw_x.server"],
      "env": {
        "WEBCLAW_LITE_BIN": "/home/box/.webclaw/bin/webclaw-lite",
        "WEBCLAW_HOME": "/home/box/.webclaw",
        "WEBCLAW_HEADLESS": "1",
        "PYTHONPATH": "/workspace/webclaw-x"
      }
    }
  }
}
```

此配置当前用于 POSIX 部署；不要把路径替换当作原生 Windows 兼容性验证。

## L3 对照用例（WorkBuddy）

与 Canvas「验收」章对齐：

| ID | 在 WorkBuddy 对话中 | 期望 |
|----|---------------------|------|
| W-01 | 「用 webclaw 查一下 status」 | 调用 `webclaw_status`，返回统一 envelope |
| W-02 | 粘贴完整 fixture 菜谱，要求执行 | **只**一次 `webclaw_run`；失败至多 1 次补丁，再失败停并求助；禁止 ps1/裸 CDP 挖页 |
| W-03 | 打开歧义页点「确定」 | 无 `#N` 默认点排名 `#1`，应成功（不要再期望 `AMBIGUOUS_TARGET`） |
| W-04 | 跑采集菜谱 | 产物目录有 md，且 dualwrite 后有 json/csv |

## 停止 / 取消长任务

- 旧版同步 `webclaw_run` 会堵住 FastMCP 事件循环，同一 stdio 会话的 `webclaw_cancel` 只能排队等 run 结束。
- 现 `webclaw_run` 与 `webclaw_human_reply` 在线程中收集结果，`webclaw_cancel` 可在同一会话并行调用，也可从**另一 stdio 会话**调用（必须共享 `WEBCLAW_HOME`）；网关写取消标记、terminate/kill 托管进程组并释放任务槽。
- 成功取消时，cancel 返回 `ok=true, code=RUN_CANCELLED`；原 run 返回 `ok=false, code=RUN_CANCELLED`。可传 `run_id` 精确取消；未命中返回 `NO_ACTIVE_RUN`，不会误发全局取消。无 run_id 且无托管任务仍走原生 CLI 兼容路径，`data.managed_cancel_code=NO_ACTIVE_RUN`。
- 托管取消已在锁内写原生 marker，不会在释放锁后补发 CLI cancel，防止误伤紧接着启动的新任务。`data.native_cancel` 表示 marker 请求结果，不代表额外调用了 CLI。
- **Host UI Stop 必须实际调用 `webclaw_cancel`**，不能只停止 LLM/聊天输出或取消 MCP 请求；否则子进程可能继续运行，下一次得到 `RUN_BUSY`。本修复不会自动改造第三方 Host 的 Stop 按钮。
- 升级后请在 WorkBuddy 等 Host **重连 MCP / 重启网关进程**，无需改 `mcp.json`。验证时启动长任务，未完成前调用 cancel，然后确认可启动下一任务。

## 跨进程任务注册与互斥

- `jobs/<run_id>.json`：`id/pid/pgid/owner_pid/process_start/started_at/recipe/status/home/cancel_marker`。`started_at` 为带时区 ISO 时间；`recipe` 仅记录 stdin/command 来源标签，不存正文、参数、命令或秘密。
- 原子 temp+replace、文件权限 0600；`jobs/.lock` 是稳定的 flock inode，**结束后保留是正常的**，不是僵尸任务。
- 同一 home 的存活任务拒绝第二个 run：`RUN_BUSY`。只串行化短生命周期事务，不等待其他 run 执行完毕。进程死亡后清理陈旧记录并允许启动；Linux 额外用 `/proc` starttime 避免 PID 复用误杀，并排除 zombie。
- 取消先写每任务 `.cancel` 回执及原生 `control/cancel`；SIGTERM → 等 0.5 秒 → SIGKILL → 最多再等 2 秒。保留存活任务的注册信息，不把终止失败冒充成功。
- done/失败/timeout/cancel 清理 JSON；HITL 返回后即使 Host 不再 collect，watchdog 仍在超时/退出时清理。跨会话 cancel 可用，**跨会话 human_reply 尚未实现**（原进程内 prompt/collect 状态仍需长会话）。
- 单机、同 home、所有 gateway 升级才受保护；直接运行 lite、不同 home 或网络文件系统不在本轮互斥保证内。

## 结构化信封与兼容迁移

新 Host 不再二次 `json.loads`：

```python
status = json.loads(tool_text)
ready = status["data"]["chromeOk"]
version = status["data"]["version"]
recipes = json.loads(list_tool_text)["data"]["recipes"]
```

status 的 `data` 同时含 `bin/chrome/chromeOk/version/product/…` 与诊断字段 `stderr_tail/exit_code`。**字段别混**：`chromeOk` 只表示 Chrome 二进制存在；`cdpReady` 表示调试口可连；是否多实例/孤儿看 `chromeInstances.orphanRisk` 与 `chromeWarn`。`data.stdout_tail`（status 与 list）已 **deprecated**；list 继续保留原来的 `type=recipes, dir, items` 字符串兼容视图，不增加新的重复视图。旧 list 字符串有 8K 截尾上限，完整列表始终读 `data.recipes`。本轮不移除旧字段，便于渐进迁移。flat 菜谱条目现含内容 `sha256`（与 `bytes` 同源一次读），Host 钉内容请用 sha256，勿只信 mtime。

本仓 `scripts/` 无 `call_tool.py`，豆包 skill 的桥接脚本未修改；因此未新增 `--json-only`。桥接端未来可优先输出单份解析后的信封，避免 structured/text 双份打印。

## 本环境限制

- Grok Bot box 为 Linux 桌面；WorkBuddy 若仅提供 Windows/macOS 安装包，则 **L3 需在用户本机完成**。  
- 不要在自动化环境里违反 WorkBuddy ToS；能装再装，装不上不挡 P0。  
- 真实 MES / 密码禁止进仓库与 WorkBuddy 聊天记录。

## 参考链接

- https://cloud.tencent.com/developer/article/2698011  
- https://neohoy.github.io/workbuddybook/advanced/03-mcp.html  
- https://cloud.tencent.com/document/product/1831/137039  
- https://www.wuyingyan.com/articles/use-mcp-connect-ai-to-local-tools  


## 英文菜谱验收（Host）

在对话里对完整英文菜谱只调用一次 `webclaw_run`（与中文等价），例如仓库 `recipes/fixture-table.en.webclaw`：

```text
open http://127.0.0.1:PORT/table.html, wait 2, collect table
```

禁止拆成逐步 probe。动词小写；`collect table` 与 `采集表格` 同路径。
