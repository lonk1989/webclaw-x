# P1 Self-Heal：有界、单步、默认关闭

本轮是可测的确定性阶梯，不是 AI 自动改写菜谱。**禁止从 MCP 重跑整份菜谱**：前面的提交、上传、点击不应因后续等待失败而重放。因此在 Rust `executor` 的单步入口加薄包装，MCP 仅映射错误码、返回脱敏后的 `heal_trace`，沿用现有 HITL 通道。

## 配置与运行

读取顺序：`WEBCLAW_HEAL_FILE` → `$WEBCLAW_HOME/heal.json` → `~/.webclaw/heal.json`；无配置则默认关闭。示例 `config/heal.example.json` 也默认关闭。没有自动改写现有用户配置。

```bash
cd /workspace/webclaw-x
# 在新路径演示，不覆盖已有用户配置
cp config/heal.example.json /tmp/webclaw-heal-demo.json
# 编辑文件设置 enabled=true；或以环境开关启用：
WEBCLAW_HEAL_FILE=/tmp/webclaw-heal-demo.json WEBCLAW_HEAL_ENABLED=1 \
  PYTHONPATH=. .venv/bin/python -m webclaw_x.server
# 紧急停用（优先于文件内容/路径有效性）：WEBCLAW_HEAL_ENABLED=0
.venv/bin/python scripts/eval_selfheal.py
# 报告：eval/out/selfheal.json；日志 selfheal-*.txt
```

```json
{
  "enabled": true,
  "short_retries": 1,
  "retry_interval_ms": 200,
  "refresh": false,
  "structural_anchors": {"等待 文字Recovered0.2": "按钮#1 1"},
  "hitl": false,
  "hitl_timeout_secs": 60,
  "ai_hook_budget": 0
}
```

- 重试次数 0–3，间隔 0–2000ms；刷新/HITL 分别显式开启。
- HITL 超时 10–300 秒；仍受 MCP 总运行时限（默认 600 秒，包含等待人工）约束。
- AI 接口预算 0–1（预留单步额度）；当前没有 provider/LLM 调用，`used` 恒为 0。
- 最多 100 条结构映射；只允许 `等待 <原参数>` → `按钮#N` / `输入框#N` / `链接#N`。N≥1，最多四位；可带 1–5 秒超时，省略默认 1 秒。禁止 JS、CSS、自定义动作或拼接第二条命令。
- 未知字段、非法 JSON、超限/非法锚点、显式文件不存在，均 `HEAL_CONFIG_INVALID`，不静默回默认值。每步加载配置；建议仅在没有活跃任务时修改。

## 按序执行

0. 先执行原步骤一次。原步骤成功、关闭自愈、试探步骤（或尝试）与断言保持原语义。
1. **同锚点短重试**：仅 `等待` / `采集` 且错误为未命中、超时、CDP 等瞬时故障；重试完全相同参数。不会重新打开 URL 或重放之前的步骤。
2. **刷新再试**：只有 `refresh=true` 才执行一次刷新，再试同一步；刷新前重新检查当前 URL 的域名白名单。刷新可能导致表单重提交，所以生产环境默认关闭。
3. **显式结构降级**：只对等待启用映射。匹配键是解析后的 `关键词 + 空格 + 参数`，例如 `等待 文字Never0.2`。映射目标是审核过的结构位置，不会自动猜 `#1`。仅验证结构可见性，不点击；它是业务预先允许的替代成功条件，不保证与原文本语义完全等价。
4. 无法恢复，记录 `need_repair`。开启 HITL 时产生真正的 `NEED_HUMAN`，原 CLI 保持运行。人修复页面后用返回的 `run_id`、`need_human.prompt_id` 调 `webclaw_human_reply(mode="ok", ...)`。**确认后必须重新验证原失败步骤**，不能把确认当成功。没有修复则最终 `NEED_REPAIR`。
5. 记录 `ai_hook_unimplemented`，返回 `NEED_REPAIR`。预算不意味着授权调用模型。本轮绝不自动改菜谱、调用上游 AI 或再次执行有副作用动作。未来只允许限额提出补丁，经审批、版本化发布后另开运行；此接口尚未实现。

非只读/非瞬时错误直接 `NEED_REPAIR`，不自动重试/刷新/HITL。`POLICY_DENIED`、`AMBIGUOUS_TARGET`、取消等是终止边界，保留原错误，绝不通过降级或旧版 AI 恢复绕过。当前阶梯不支持逐个命令声明幂等性，也不实现断点跨进程恢复。

## 返回契约

`webclaw_run` / `webclaw_human_reply` 保持原参数；新增失败码 `NEED_REPAIR`、`HEAL_CONFIG_INVALID`。有自愈尝试时附：

```json
{"heal_trace":[{"step_index":2,"stage":"short_retry","attempt":1,"ai_hook":{"budget":0,"used":0,"implemented":false}}]}
```

trace 不包含原始步骤、密码、验证码或页面文本。整体结果仍通过现有 `scrub_obj`；人工回复文本继续注册动态脱敏。错误优先级保留 TIMEOUT / POLICY_DENIED / AMBIGUOUS_TARGET，暂停不误报为 NEED_REPAIR。

## 自动验收

`tests/test_selfheal.py` 使用真实 release runtime + 本地 HTTP fixture（不访问 MES，不用真实密码/验证码）：

- 收到第一次失败后的短重试日志才让 fixture 显示目标，证明确实先失败再成功；打开次数为 1。
- 短重试→一次刷新→恢复；页面请求计数为 2，不重放整菜谱。
- 无文本但显式结构映射命中，仅读不点。
- 阶梯耗尽→NEED_REPAIR；AI 预算 1 仍然调用 0 次。
- 真 FileHumanBridge 暂停/回复/续跑；fixture 信号模拟人工修复，不自动操作真实验证码；只确认而不修复必须失败。
- 默认关闭、强制关闭覆盖坏配置、非法配置、策略拒绝、点击歧义、非安全动作不重试。

共享 CDP 端口 19222，所有浏览器评测串行运行，勿并行启动多个套件。回滚见 `patches/ROLLBACK.md` 的 Self-Heal 节。
