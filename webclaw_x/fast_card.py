"""Single fast-card text shared by MCP instructions and Skill guidance.

Keep Skill.md and INSTRUCTIONS aligned: Hosts that inject both should not
double-pay ~1k tokens of duplicate iron rules.
"""

from __future__ import annotations

# Compact iron rules + core tools. Skill.md mirrors this; MCP instructions use it.
FAST_CARD = """\
webclaw-x：确定性菜谱浏览器 RPA（CDP）。菜谱=指令+目标/参数；中英动词同源。

【铁律】
1. 完整/冻结菜谱 → 只 webclaw_run 一次；禁止逐步 probe。
2. probe 仅编排；写完 freeze，复跑只用 run。禁止 Playwright/CSS 重写。
3. 密码/验证码不进菜谱/聊天；HITL 用 webclaw_human_reply；密码走 accounts 金库。
4. AMBIGUOUS_TARGET → 展示可读候选，让用户选 #N（如 点击确定#1），禁止猜点。
5. {{参数}} 须用户确认后 params_confirmed=true；否则 PARAMS_UNCONFIRMED。
6. 长停调 webclaw_cancel（可并行）；POLICY_DENIED/NEED_REPAIR/HEAL_CONFIG_INVALID 交部署者，禁止自动关策略或整份重跑。

【核心工具 core7】status / run / probe / freeze / list_recipes / human_reply / cancel
默认 WEBCLAW_TOOLS=core；完整工具 WEBCLAW_TOOLS=all。
【首载】常驻 MCP stdio（禁每工具 respawn）。status 热路径。可选 WEBCLAW_PREWARM=1。
真业务前：policy allowed_hosts、params_confirmed、HITL、cancel、禁逐步 probe。登录态默认复用 CDP；WEBCLAW_CHROME_RECYCLE=1 才强制冷启。
"""

__all__ = ["FAST_CARD"]
