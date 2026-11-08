# P1 域名策略与 HITL（最小可演示切片）

## 域名白名单：Rust 导航入口强制执行

默认配置文件：`$WEBCLAW_HOME/policy.json`（默认 `~/.webclaw/policy.json`）。也可显式指定 `WEBCLAW_POLICY_FILE`。

```json
{
  "enabled": true,
  "allow_localhost": true,
  "allowed_hosts": ["example.com"]
}
```

- 未配文件：**默认启用**，仅放行 `localhost` / `127.0.0.1` / `[::1]` 与内部 `about:blank`。
- 精确 host 匹配，大小写/尾点规范化；不支持通配符。`example.com` **不**放行子域、`example.com.evil.test`。
- 含 URL 用户名/密码，以及 `file:` / `data:` / `javascript:` 默认拒绝。
- 错误/不可读的显式文件、未知配置字段：fail-closed，`POLICY_DENIED`。
- 每次导航重读配置；无需重启。
- `打开`、英文别名 `open`、`打开标签`、`probe --url` 走导航校验；直接 CLI 同样生效，不能绕过 MCP。
- 环境开关：`WEBCLAW_POLICY_ENABLED=0`（或配置 `"enabled": false`）；**由部署者设置，不根据页面内容自动关闭**。
- `allow_localhost: false` 可关闭 fixture 豁免；通过 `allowed_hosts` 精确开放所需 host。

示例文件：`config/policy.example.json`。复制到自己的 `$WEBCLAW_HOME/policy.json` 前应审阅 host 列表。

### 草稿向导（不自动放行）

```bash
python scripts/policy_draft.py --hosts 'app.example.com,login.example.com' \
  --out "$WEBCLAW_HOME/policy.json.draft"
# 审阅后：cp "$WEBCLAW_HOME/policy.json.draft" "$WEBCLAW_HOME/policy.json"
```

安装脚本也可：`./scripts/install_webclaw.sh --hosts '…'`。草稿**不会**写入正式 `policy.json`，也**不会**设置 `WEBCLAW_POLICY_ENABLED=0`。MCP 工具 `webclaw_policy_draft` 在 `WEBCLAW_TOOLS=all` 时可用。

### 安全边界（必须看）

这是**显式导航动作白名单，不是网络防火墙/完整浏览器沙箱**。本轮不阻断页面子资源、HTTP 重定向、页面 JavaScript、普通点击导致的导航/弹窗、既有浏览器会话、下载、第三方请求。不能声称实现了跨域数据隔离。下一阶段应在 CDP Fetch/Network 层执行所有顶层跳转策略，并加入重定向/弹窗回归；高风险真实站点仍建议专用 profile 与网络 egress 限制。

## HITL：保留进程，回复同一任务后续跑

沿用上游 `FileHumanBridge`，不重做 UI：

1. `webclaw_run` 使用 live JSONL reader。遇 `need_human` 时立即返回：
   - `code=NEED_HUMAN`
   - `run_id`：MCP job ID（不等同于 Rust worker ID）
   - `need_human.prompt_id` / `kind` / `hint`
2. 原 CLI 子进程仍在等待 `human/human_reply.{txt,json}`；不超时杀掉后再假装续跑。
3. Host 展示提示；**真实业务必须等用户明确提供验证码或完成操作**。不自动猜码/确认。
4. 回复原任务：
   ```text
   webclaw_human_reply(mode="text", text="<用户提供的码>", run_id="<返回值>", prompt_id="<返回值>")
   webclaw_human_reply(mode="ok", run_id="<返回值>", prompt_id="<返回值>")
   ```
5. 工具调用已限定到活跃任务和当前 prompt；回复后等待下一个 `NEED_HUMAN` 或最终 `done`，不重新执行整段菜谱。
6. 错误/陈旧 `run_id` / `prompt_id` / 没有等待中的进程：`NO_ACTIVE_HUMAN`；不向 `last-need-human.json` 归档写码。
7. 同一网关暂只允许一个活跃 browser run（否则 `RUN_BUSY`）。整体 `WEBCLAW_RUN_TIMEOUT_MS` 包含人机等待；网关重启不支持恢复内存中的任务句柄。中断后需显式处理遗留 CLI 进程。

### 脱敏

- JSON 对象、嵌套 JSONL 的 password/验证码键值递归脱敏。
- `human_reply` 收到的文本只在进程内加入敏感值集合，之后即使无字段标签回显也替换成 `***REDACTED***`。
- 不在评测报告中写入真实凭据；集成测试仅使用合成字符串。
- 上游文件桥会短暂把回复写入本机 human 文件，消费后删除；本轮仅保证 **MCP 返回结果脱敏**，不承诺 CLI 原始日志、截图或浏览器页面自动 DLP。Host 自身工具调用参数日志也需单独保护。

## 验收命令

```bash
cd /workspace/webclaw-x
export PATH="$HOME/.cargo/bin:$PATH"
export WEBCLAW_LITE_BIN=$HOME/.webclaw/bin/webclaw-lite WEBCLAW_HEADLESS=1
.venv/bin/python scripts/eval_policy.py     # eval/out/policy.json
.venv/bin/python scripts/eval_smoke.py      # L1 + policy/HITL 自动测试
.venv/bin/python scripts/eval_components.py # 原 P1 回归
```

HITL 用真实 Rust 文件通道 + 本地 fixture + 合成确认文本闭环，**没有调用真实验证码服务，没有模拟用户业务授权**。测试额外覆盖：拒绝非名单 URL、raw CLI/probe 防旁路、localhost 放行、显式 whitelist/关闭开关、配置错误、陈旧 prompt、嵌套 JSONL/无标签敏感值回显。

回滚：`patches/ROLLBACK.md`（保留前序 P0/P1 改动的局部快照）。

## 本轮实测结果

- Rust policy 单测：3 passed
- L1（含新增集成）：21 passed，0 failed / xfailed / skipped
- 独立策略/HITL：11 passed
- Component Pack：2 passed
- L2 MCP stdio：3 passed

报告目录：`eval/out/`（`latest.json` / `policy.json` / `components.json` / `l2-client.json`）。
