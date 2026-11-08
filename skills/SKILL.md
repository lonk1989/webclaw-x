# webclaw-x · 新助手 1 页上手

> **只读本页。** 勿叠读 `skills/webclaw-lite/`、`skills/webclaw/`（伙伴远程）全文——那些不是 MCP 主路径。  
> 与 MCP `instructions` 共用快卡 `webclaw_x/fast_card.py`。

确定性菜谱浏览器 RPA。菜谱 = **指令 + 目标/参数**；中英动词同源。经 MCP 调用，禁止 Playwright/CSS 重写。

## 0. 发现 → 安装 → 接通（人/部署者）

```bash
# 默认：预编译 lite（~61MB），不要 cargo
./scripts/install_webclaw.sh
# 产出：$WEBCLAW_HOME/bin/webclaw-lite  +  $WEBCLAW_HOME/mcp/*.mcp.json
# 把 mcp 片段拷进 Cursor / WorkBuddy，重连并信任工具
```

- 仅当**改引擎源码**才用 `./scripts/build_runtime.sh`（会生成巨大 `target/`，终端用户勿走）。
- 默认 `WEBCLAW_TOOLS=core` → list_tools 只暴露 **core7**；完整工具设 `WEBCLAW_TOOLS=all`。
- **常驻 stdio**：一会话只拉起一次网关；禁止每工具 respawn（评测：`scripts/call_tool.py --persist …`）。

## 1. 掌握（会话内，分钟级）

1. `webclaw_status`∥`webclaw_list_recipes` 各一次（status 热路径，勿×3）
2. 跑 fixture：`webclaw_run` 一次完整菜谱（见 `recipes/fixture-table.webclaw`）
3. 墙钟参考（已装好）：就绪 ~0.4s；CLI fixture ~2.7s

**core7**：`status` / `run` / `probe` / `freeze` / `list_recipes` / `human_reply` / `cancel`

## 2. 铁律

1. **完整/冻结菜谱 → 只 `webclaw_run` 一次。禁止逐步 probe。**
2. `probe` 仅编排期；写完 `freeze`，复跑只用 run。
3. 密码/验证码不进菜谱/聊天；HITL 用 `webclaw_human_reply`；密码走 accounts 金库。
4. `AMBIGUOUS_TARGET` → 展示候选，让用户选 `#N`（如 `点击确定#1`），禁止猜点。
5. 含 `{{参数}}` → 先问用户确认 → `params_confirmed=true`；否则 `PARAMS_UNCONFIRMED`。
6. 长停必须调 `webclaw_cancel`（Host UI Stop 同理）；空闲 cancel → `NO_ACTIVE_RUN`。

## 3. 真业务 checklist（开跑前勾完）

- [ ] **policy**：业务 host 已写入 `$WEBCLAW_HOME/policy.json` 的 `allowed_hosts`  
      草稿：`python scripts/policy_draft.py --hosts 'app.example.com' --out $WEBCLAW_HOME/policy.json.draft`  
      → 部署者审阅后改名为 `policy.json`。**禁止**自动设 `WEBCLAW_POLICY_ENABLED=0`。
- [ ] **params_confirmed**：非秘密 `{{…}}` 已由用户确认。
- [ ] **HITL / 登录**：验证码与确认等人；不猜码。需要登录态时复用 Chrome profile（见下）。
- [ ] **cancel**：Host Stop = 真调 `webclaw_cancel`，防 `RUN_BUSY` 残留。
- [ ] **禁逐步 probe**：回放路径只 `webclaw_run` 一次；新站点先 probe→freeze→publish，再 run。

### 登录 profile 复用

- 健康 CDP **默认复用**同一调试 Chrome（Cookie/登录态可保留）。
- 可选 `WEBCLAW_PREWARM=1`：网关启动时后台确保 CDP 就绪。
- 仅当必须冷启动时设 `WEBCLAW_CHROME_RECYCLE=1`（杀端口再启，登录态可能丢）。
- Profile 目录在应用数据下的 `chrome-debug` / `chrome-profiles/<task>`；同 `WEBCLAW_HOME` 会话间复用，勿每跑清 profile。

## 4. 示例

```
打开http://127.0.0.1:PORT/table.html，等待文字加油记录5，采集表格
```

```
open http://127.0.0.1:PORT/table.html, wait 加油记录5, collect table
```

MVP：打开/open、点击/click、等待/wait、输入/type、采集/collect、刷新/reload、截图/screenshot、滚动/scroll、按/press、参数/param。

## 5. 出错时

| 码 | 动作 |
|----|------|
| `POLICY_DENIED` | 停；找部署者改 `allowed_hosts`（可用 policy_draft） |
| `NEED_HUMAN` | 展示提示；`webclaw_human_reply(run_id, prompt_id, …)` |
| `PARAMS_UNCONFIRMED` | 问用户后重跑并带 `params_confirmed=true` |
| `RUN_BUSY` | 先 cancel/结束原任务 |
| `NO_ACTIVE_RUN` / `NO_ACTIVE_HUMAN` | 勿重放归档 |

进阶（按需再打开）：`docs/third-party-hosts.md`、`docs/policy-and-hitl.md`、`docs/recipe-library.md`、`docs/self-heal.md`。
