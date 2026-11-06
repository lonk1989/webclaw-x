# webclaw-x Skill

确定性中文菜谱浏览器 RPA。通过 MCP 工具调用，不要用 Playwright/CSS 重写。

## 铁律

1. **完整/冻结菜谱 → 只 `webclaw_run` 一次。禁止逐步 probe。**
2. `webclaw_probe` 仅编排期写菜谱；写完 `webclaw_freeze`，复跑只用 run。
3. 密码/验证码永不进菜谱或聊天；HITL 用 `webclaw_human_reply`。
4. 若返回 `AMBIGUOUS_TARGET`：展示候选，让用户选 `#N`，禁止猜点。
5. 优先 `recipe_path` 指向已冻结 `.webclaw`。

## 工具

| 工具 | 用途 |
|------|------|
| webclaw_status | 健康检查 |
| webclaw_run | 执行完整菜谱 |
| webclaw_probe | 编排期扫页 |
| webclaw_freeze | 保存菜谱 |
| webclaw_list_recipes | 列出库 |
| webclaw_human_reply | 验证码/确认 |
| webclaw_cancel | 停跑 |
| webclaw_dualwrite_run | 补写 JSON/CSV |

## 示例

```
打开http://127.0.0.1:PORT/table.html，等待2，采集表格
```

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
