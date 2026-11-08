# webclaw-x Skill

> 与 MCP `instructions` 共用同一张快卡（`webclaw_x/fast_card.py`）。**不要**再叠读 `skills/webclaw-lite/SKILL.md` 全文，除非走伙伴远程路径。

确定性菜谱浏览器 RPA（菜谱 = 指令 + 目标/参数；中英动词同源）。通过 MCP 工具调用，不要用 Playwright/CSS 重写。

## 首载（Host 必读）

1. **常驻 MCP stdio**：一个会话只拉起一次 `python -m webclaw_x.server`，禁止每个工具 respawn（评测桥请用 `scripts/call_tool.py --persist`）。
2. **status 热路径**：默认不 spawn lite；`chromeOk`=二进制存在，`cdpReady`=调试口可连，实例看 `chromeInstances`。深度 HITL 字段才设 `WEBCLAW_STATUS_MODE=lite`。
3. **可选预热**：`WEBCLAW_PREWARM=1` 在网关启动时后台拉起/复用 Chrome（默认关，不改语义）。
4. 首轮 `status`∥`list_recipes` 各一次即可；勿 status×3。

## 铁律

1. **完整/冻结菜谱 → 只 `webclaw_run` 一次。禁止逐步 probe。**
2. `webclaw_probe` 仅编排期写菜谱；写完 `webclaw_freeze`，复跑只用 run。
3. 密码/验证码永不进菜谱或聊天；HITL 用 `webclaw_human_reply`。
4. 若返回 `AMBIGUOUS_TARGET`：展示可读候选（旁文案/坐标），让用户选 `#N`（同文案后加，如 `点击确定#1`），禁止猜点。
5. 优先 `recipe_path` 指向已冻结 `.webclaw`。
6. 菜谱含 `{{参数}}`，须先让用户确认非秘密参数，再传 `params_confirmed=true`；网关未确认会返回 `PARAMS_UNCONFIRMED` 和参数名，不启动 lite。环境绑定/默认值也不能替代用户确认。
7. 发现菜谱读 `webclaw_list_recipes` 的 `data.recipes`，平铺和版本库统一列出；用 `id` 固定 `recipe_ref`，不要猜文件路径。

## 工具

| 工具 | 用途 |
|------|------|
| webclaw_status | 健康检查（热路径；`chromeOk`/`cdpReady`/`chromeInstances`） |
| webclaw_run | 执行完整菜谱 |
| webclaw_probe | 编排期扫页 |
| webclaw_freeze | 保存菜谱 |
| webclaw_list_recipes | 列出库 |
| webclaw_human_reply | 验证码/确认 |
| webclaw_cancel | 停跑 |
| webclaw_dualwrite_run | 补写 JSON/CSV |

## 示例

中文：

```
打开http://127.0.0.1:PORT/table.html，等待文字加油记录5，采集表格
```

英文（同一 AST / 回放路径；动词小写）：

```
open http://127.0.0.1:PORT/table.html, wait 加油记录5, collect table
```

MVP 动词：打开/open、点击/click、等待/wait、输入/type、采集/collect、刷新/reload、截图/screenshot、滚动/scroll、按/press、参数/param。英文粘连合法（如 `openhttps://…`、`wait2`），也可用空格分隔。

优先 `等待文字…` / `等待消失…` / `等待下载`，少写固定 `等待N`。画面断言（可选）：`断言画面含 登录`（需 `WEBCLAW_VISION_ASSERT=1`）。多候选点击会返回 `AMBIGUOUS_TARGET` 与可读候选（旁文案/坐标）；请在同文案后加 `#N`（如 `点击确定#1`）。

不要：`打开…` → probe → 点按钮 → probe → …（复跑期禁止）。

## P1 Policy / HITL

- `POLICY_DENIED`：停止，不自动设置 `WEBCLAW_POLICY_ENABLED=0`；请部署者审阅具体 host。
- `NEED_HUMAN`：展示提示并等人的回复；用返回的 `run_id` 与 `need_human.prompt_id` 调 `webclaw_human_reply` 续跑。
- 禁止自动猜验证码或凭空确认人的操作；`NO_ACTIVE_HUMAN` 不得向归档文件重放回复。
- 同网关只有一个活跃运行；遇 `RUN_BUSY` 先结束/回复原任务。

## P1 Self-Heal

- 默认关闭；由部署者审阅 `heal.json` 显式启用，短重试/刷新只针对失败的只读单步。
- `NEED_REPAIR`：停止并审阅失败，不得为了自愈重跑整份菜谱，不得静默猜位置/AI 改写。
- 自愈触发 `NEED_HUMAN` 时按页面修复提示等人完成，再用原 run_id/prompt_id 续跑；不能虚构确认。
- `HEAL_CONFIG_INVALID`：交部署者修配置，不自动禁用白名单。AI hook 当前未实现、调用数为 0。
- 详见 `docs/self-heal.md`。
