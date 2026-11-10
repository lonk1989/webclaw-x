"""Single fast-card text shared by MCP instructions and Skill guidance.

Keep Skill.md and INSTRUCTIONS aligned: Hosts that inject both should not
double-pay ~1k tokens of duplicate iron rules.

This text is the FIRST thing WorkBuddy / Cursor / other MCP hosts show the
model after connecting — keep verb→webclaw_run mapping unmistakable.
"""

from __future__ import annotations

# Compact iron rules + verb cookbook. Skill.md / docs/recipe-verbs.md expand this.
FAST_CARD = """\
webclaw-x：确定性菜谱浏览器 RPA（CDP）。菜谱 = 动词指令 + 目标/参数；中英同源。

【用户口语 → 你必须做什么】
- 「打开 MES / 打开旧MES / 打开 https://… / 点确定 / 采集表格」→ 这些是菜谱动词，不是让你查账号。
- 正确：立刻 webclaw_run(recipe="打开旧MES系统") 或把多步用中文逗号连成一句一次 run。
- 错误（一律禁止）：只查 accounts 就结束；Start-Process / open / xdg-open / 默认浏览器；Playwright；裸 CDP/WebSocket/写 ps1 挖 DOM；把完整流程拆成多次「测试：」小 run。
- 查到保险箱 URL ≠ 已用 webclaw 打开；禁止把 URL 丢给系统浏览器后跟用户说「已打开」。

【常用动词】打开/open · 登录(保险箱别名) · 点击/click · 输入/type · 等待/wait · 采集/collect · 刷新/reload · 截图/screenshot · 滚动/scroll · 按/press · 参数/param
示例：打开旧MES系统，登录旧MES系统，等待5，点击工单，采集表格
等待（Agent）：只写秒数「等待2/等待5」；禁止「等待文字…/等待加载/等待登录成功」等目标。人手冻结菜谱里的智能等待原样回放。
下载（Agent）：写「等待下载30」或「等待下载60」，禁止默认「等待下载200」——空等太久才失败等于晚求助。
眼睛：只用 webclaw_probe / 菜谱「采集…」。禁止自写 PowerShell/JS 脚本连 19222 挖页面。

【铁律 · 省 token】RPA 目标就是少轮次；卡死要早问人。
1. 一条完整/冻结菜谱 → 只 webclaw_run 一次。复跑只用 recipePath。
2. 失败：仅当错误明确且补丁廉价（如改 #N / 补漏点的「确定」且一步内可验证）才允许 1 次短补丁。下列情况**禁止再补丁、立刻求助**（侧栏画面 + 编号选项）：找不到控件超时、等待下载无文件(pending=0)、同一控件连点无效、补丁仍失败。禁止再开一串长等待「赌一把」。
3. 成功交付（含补丁成功后）：必须合并并展示「一条完整更新菜谱」（主流程+补丁）。DSH/蜂行业务菜谱在技能 body。落库前必须用户知情并明确同意，禁止默认 save_skill：
   - 自建技能 → 先问是否更新该技能；同意后再 save_skill(skillId+overwrite)；
   - 他人/预制技能 → 先问是否另存副本（新名）；同意后再 save_skill(asCopy)；
   - 非技能临时 → 代码块发出方便复制；仅当用户主动要求时才保存为技能 / freeze。
4. 无头求助：(a) 侧栏执行画面；(b) 编号选项；(c) human_reply 验证码；(d) 用户「接管」→ set_display(headless=false) 并保持，直到用户说「隐藏/无头」。切换模式会重启 Chrome。勿空喊「请看浏览器」。
5. 禁止：从登录整本重探；「测试：」碎片 run；裸 CDP/ps1；Playwright/CSS。
6. 点击：不写 #N=默认 #1。密码不进菜谱。含「参数名=值」→运行前先让用户确认/改默认（Host 弹窗或 needParams 表），禁止静默用占位值开跑。失败补丁/重跑复用已确认 params，禁止再问一遍或清空。
7. 试探：`(点击取消?)` / `（点击已有？点击新建）` 是合法语法（失败跳过或走备选），必须原样保留，禁止当注释删掉。
8. 长停 webclaw_cancel；关浏览器 webclaw_browser(action=stop)。

【核心工具】status / run / probe / freeze / list_recipes / human_reply / cancel / set_display / browser
说明书：docs/recipe-verbs.md（安装后亦在 $WEBCLAW_HOME/mcp/RECIPE-VERBS.md）
"""

__all__ = ["FAST_CARD"]
