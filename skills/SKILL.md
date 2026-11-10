# webclaw-x · 新助手 1 页上手

> **只读本页。** 勿叠读 `skills/webclaw-lite/`、`skills/webclaw/`（伙伴远程）全文——那些不是 MCP 主路径。  
> 与 MCP `instructions` 共用快卡 `webclaw_x/fast_card.py`。

确定性菜谱浏览器 RPA。菜谱 = **动词指令 + 目标/参数**；中英动词同源。经 MCP 调用，禁止 Playwright/CSS 重写。

**用户说「打开 MES」≠ 查账号，也 ≠ 用默认浏览器打开 URL。**  
→ 立刻 `webclaw_run(recipe="打开旧MES系统")`。禁止 `Start-Process` / `open` / `xdg-open`。  
动词表：[docs/recipe-verbs.md](../docs/recipe-verbs.md)（安装后 `$WEBCLAW_HOME/mcp/RECIPE-VERBS.md`）。

## 0. 发现 → 安装 → 接通（人/部署者）

**互联网用户（推荐，无需 clone）：** 见 [`docs/workbuddy-quickstart.md`](../docs/workbuddy-quickstart.md)

```powershell
# Windows
irm https://raw.githubusercontent.com/lonk1989/webclaw-x/main/scripts/install_workbuddy.ps1 | iex
```

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/lonk1989/webclaw-x/main/scripts/install_workbuddy.sh | bash
```

**已有仓库检出时：**

```bash
./scripts/install_webclaw.sh
# 产出：$WEBCLAW_HOME/bin/webclaw-lite  +  $WEBCLAW_HOME/mcp/*.mcp.json
```

- 仅当**改引擎源码**才用 `./scripts/build_runtime.sh`（会生成巨大 `target/`，终端用户勿走）。
- 默认 `WEBCLAW_TOOLS=core` → list_tools 只暴露 **core7**；完整工具设 `WEBCLAW_TOOLS=all`。
- **常驻 stdio**：一会话只拉起一次网关；禁止每工具 respawn（评测：`scripts/call_tool.py --persist …`）。

## 1. 掌握（会话内，分钟级）

1. 用户含「打开/点击/采集/登录」→ **直接 `webclaw_run`**，不要先空转 accounts
2. `webclaw_status`∥`webclaw_list_recipes` 各一次即可（status 热路径，勿×3）
3. 跑 fixture：`webclaw_run` 一次完整菜谱（见 `recipes/fixture-table.webclaw`）

**core7**：`status` / `run` / `probe` / `freeze` / `list_recipes` / `human_reply` / `cancel`

## 2. 铁律（省 token：一条菜谱、一次 run）

RPA 的目的是**少消耗模型 token**。禁止用多次 `webclaw_run` / 碎片「测试：」/ 旁路脚本代替一次完整回放。

1. **完整/冻结菜谱 → 只 `webclaw_run` 一次。** 禁止逐步 probe；禁止拆成一串 1–3 步小 run。
2. **失败要早问人。** 仅当错误明确且补丁廉价（改 `#N`、补漏点的「确定/导出」且一步可验证）才允许 **1 次**短补丁（勿再 `登录…`）。  
   **立刻停并求助（禁止再补丁）**：找不到控件超时、`等待下载` 无文件（pending=0）、同一目标连点无效、补丁仍失败。求助用 2–4 句 + 侧栏「执行画面」+ 编号选项。  
   Agent 自写下载等待用 `等待下载30`/`等待下载60`，**禁止**默认 `等待下载200`（空等数分钟才失败=晚求助）。
3. **成功必须交付完整更新菜谱**（主流程 + 补丁合并成一句/一份，见 §6）。
4. **眼睛只用** `webclaw_probe` / 菜谱「采集…」。**禁止** PowerShell / 裸 CDP / 自写 JS 挖 DOM（与禁 Playwright 同级）。
5. `probe` 仅编排期；复跑只用 `recipePath`。
6. 密码/验证码不进菜谱/聊天；HITL 用 `webclaw_human_reply`。
7. 点击文字：**不写 `#N` 即默认 `#1`**；其它候选写 `#2`…。
8. 含「参数名=值」或 `{{名}}` → **运行前先确认**：保留声明/占位符原样传入（禁止先展开成字面量）；Host 会弹参数确认；若返回 `needParams` 则展示表等用户。禁止静默用占位默认值开跑；禁止首次就 `paramsConfirmed=true`。失败补丁/重跑：**复用**已确认 params，禁止再问或清空。
9. **试探** `(点击取消?)` / `（试探？备选）`：合法运行时语法（先试探，失败走备选或跳过）。必须原样保留，禁止当注释删掉。
10. 长停调 `webclaw_cancel`；空闲 cancel → `NO_ACTIVE_RUN`。

## 3. 真业务 checklist（开跑前勾完）

- [ ] **policy（可选）**：默认关闭。若要加固，把业务 host 写入 `$WEBCLAW_HOME/policy.json` 并设 `enabled: true`  
      `python scripts/policy_draft.py --hosts 'app.example.com' --out $WEBCLAW_HOME/policy.json`
- [ ] **params_confirmed**：非秘密 `{{…}}` 已由用户确认。
- [ ] **HITL / 登录**：验证码与确认等人；不猜码。需要登录态时复用 Chrome profile（见下）。
- [ ] **cancel**：Host Stop = 真调 `webclaw_cancel`，防 `RUN_BUSY` 残留。
- [ ] **一次 run**：回放只 `webclaw_run` 一次；失败至多 1 次补丁，再失败就停并求助；禁止 ps1/裸 CDP；新站点先 probe→freeze→publish，再 run。

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

| 码 / 情况 | 动作 |
|-----------|------|
| 某步失败 | 仅廉价明确补丁可试 1 次；找不到控件 / 下载空等 / 补丁仍败 → **立刻求助**（勿再开长等待） |
| 跑/补丁成功 | 展示完整菜谱（见 §6）；落库须用户同意后再 save_skill；非技能默认只发代码块 |
| 看不清页面 | 一次 `webclaw_probe` 或 `采集…`；禁止写 ps1/裸 CDP |
| `POLICY_DENIED` | 停；找部署者改 `allowed_hosts`（可用 policy_draft） |
| `NEED_HUMAN` | 展示提示；`webclaw_human_reply(run_id, prompt_id, …)` |
| `PARAMS_UNCONFIRMED` | 问用户后重跑并带 `params_confirmed=true` |
| `RUN_BUSY` | 先 cancel/结束原任务 |
| `NO_ACTIVE_RUN` / `NO_ACTIVE_HUMAN` | 勿重放归档 |

### 向用户求助（无头默认；保持短）

用户**看不到**系统 Chrome。正确求助通道：

1. **看图**：请用户打开右侧栏「执行画面」（`webclaw-live`）对照当前截图。  
2. **选型**：把候选列成编号（来自失败信息 / 一次 `webclaw_probe`），用户回 `1` / `#2` / 文案即可；你再短补丁 `webclaw_run`。  
3. **验证码**：对话/卡片里出图 → `webclaw_human_reply`（不要说「请看浏览器」）。  
4. **用户接管**：用户说「接管 / 我来点 / 弹出浏览器」→ 立刻 `webclaw_set_display(headless=false)`（持久写入 `display.json`）。**保持有头**，直到用户主动说「隐藏浏览器 / 改成无头」再 `webclaw_set_display(headless=true)`。禁止任务结束后擅自改回无头；后续 `webclaw_run` 勿传 `headless` 覆盖。切换模式会重启 Chrome（当前页可能丢，Cookie 通常保留）。

模板：

> 卡在第 N 步「…」：…。侧栏执行画面是当前页。请回复选项：**1=… 2=… 3=…**（或说「接管，弹出浏览器我来点」）。

## 6. 成功后交付完整菜谱

任务成功（含「主跑失败 → 短补丁成功」）后，**必须**整理出一条可回放的完整菜谱（把补丁写回主流程对应位置，不要只交补丁段）。

DSH / 蜂行对接：**业务菜谱主存贮是技能 `body`（后端 `formula`）**，激活后注入 Host `skills.register`；执行时 `webclaw_run(recipe=技能正文中的菜谱)`。`.webclaw` / `webclaw_freeze` 只是本地冻结旁路，**不是**自建技能的默认落库方式。

**铁律：** 先展示完整菜谱；任何 `save_skill`（更新/另存）必须用户知情并**明确同意**，禁止默认/静默落库。

| 发起方式 | 你怎么交付 |
|----------|------------|
| **自建技能**发起 | 展示完整菜谱 → 询问是否更新本技能 → **仅同意后** `save_skill(skillId+overwrite)` |
| **他人或预制技能**发起 | 展示完整菜谱 → 询问是否另存为我的副本（新名）→ **仅同意后** `save_skill(asCopy)`；勿覆盖原技能 |
| **非技能**（对话临时拼的菜谱） | 代码块发出方便复制；**不要**主动 `save_skill`，除非用户明确要求保存为技能 / `freeze` |

复跑：技能场景继续 `webclaw_run(recipe=…)`；仅当用户已有冻结文件时才用 `recipePath`。

进阶（按需再打开）：`docs/third-party-hosts.md`、`docs/policy-and-hitl.md`、`docs/recipe-library.md`、`docs/self-heal.md`。
