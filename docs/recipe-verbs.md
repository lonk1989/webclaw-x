# webclaw 菜谱动词说明书（所有 AI 助手通用）

> 给 **WorkBuddy / Cursor / 豆包工作 / 蜂行** 等任意接入方。  
> MCP 接通后，模型应优先遵守本页与 `webclaw_x` 的 `instructions`（fast card）。

## 一句话

用户话里的 **打开 / 点击 / 输入 / 等待 / 采集 / 登录…** 是菜谱**动词**，不是让你查账号列表。  
正确动作：**拼成一句中文菜谱 → 一次调用 `webclaw_run(recipe=…)`**。

## 用户说法 → 你该怎么做

| 用户说 | 正确 | 错误 |
|--------|------|------|
| 「打开 MES」「打开旧 MES」 | `webclaw_run`，recipe 如：`打开旧MES系统` 或 `登录旧MES系统`（保险箱有 URL 时） | 只调 `webclaw_accounts_*`；`Start-Process` / 默认浏览器打开 URL |
| 「打开 https://…」 | `webclaw_run`，recipe：`打开https://…` | Playwright / `open` / `xdg-open` / 让用户自己点 |
| 「打开…，点确定，采集表格」 | **一整句**进一次 `webclaw_run` | 拆成多次 probe / 「测试：」小 run |
| 跑到一半失败 | 仅廉价明确补丁可试 1 次；找不到控件/下载空等 →**立刻求助**。Agent 下载写 `等待下载30/60`，勿默认 200 | 空等 `等待下载200` 再猜；从登录整本重探；「测试：」串跑；ps1/裸 CDP |
| 跑/补丁成功 | 合并并**展示**完整菜谱；落库须用户知情同意后再 `save_skill`（自建更新 / 他人另存）；非技能默认代码块；禁止默认落库 | 静默 `save_skill`；只交补丁段；覆盖他人技能 |
| 「有哪些网站账号」 | 才用 accounts 类工具（仅列表，无密码） | 用 accounts 代替「打开」 |

`webclaw_accounts_status` / `webclaw_accounts_list`：**只查保险箱**，确认有没有站点 URL。  
查到「旧MES」≠ 已经打开；查完必须再 `webclaw_run`。  
**禁止**把查到的 URL 交给系统默认浏览器（Windows `Start-Process`、macOS `open`、Linux `xdg-open`）后对用户说「已打开」——那不是 webclaw 会话，后续点击/采集无法衔接。

## 核心动词（中英同源）

| 中文 | 英文 | 作用 | 示例 |
|------|------|------|------|
| 打开 | open | 导航到 URL 或保险箱站点名 | `打开https://a.com` / `打开旧MES系统` |
| 登录 | （菜谱别名） | 打开保险箱里该站点的登录 URL | `登录EHR系统` |
| 点击 | click | 点可见文字；无 `#N` 默认 `#1` | `点击确定`（= `#1`） / `点击确定#2` |
| 输入 | type | 往焦点或目标填字 | `输入用户名=张三` |
| 等待 | wait | **Agent 只写秒数**；人手菜谱仍可用智能等待 | Agent：`等待2` / `等待5`；人手：`等待加载` / `等待文字…` |
| 采集 | collect | 采集表格/区域 | `采集表格` |
| 刷新 | reload | 刷新页 | `刷新` |
| 截图 | screenshot | 截图 | `截图` |
| 滚动 | scroll | 滚动 | `滚动` |
| 按 | press | 按键 | `按Enter` |
| 参数 | param | 模板参数声明 | `参数月份=2026-07` |
| `(试探？备选)` | probe / or | 括号试探：先跑 `？` 前；失败则跑后面（可省略=跳过） | `(点击取消?)` · `（点击已有项？点击新建）` |

### 括号试探（务必保留，勿当注释删掉）

| 写法 | 含义 |
|------|------|
| `(点击取消?)` / `（点击取消？）` | 试探点「取消」；没有该按钮就**跳过**，继续后面步骤 |
| `（点击已有项？点击新建）` | 先点「已有项」；失败再点「新建」 |
| `点击考勤月报（新版）` | **普通括号**（无 `?`/`？`）= 按钮文案的一部分，不是试探 |

失败补丁 / 重跑时：**原样保留** `(…?)`，禁止剥掉括号或改成必选点击。

多步用中文逗号 `，` 连成**一句菜谱**：

```text
打开旧MES系统，登录旧MES系统，等待5，点击工单，采集表格
```

```text
open https://example.com, wait 2, click Login, collect table
```

### `等待` 写法（Agent vs 人手）

| 谁写菜谱 | 正确 | 错误 |
|----------|------|------|
| **AI Agent** | 只写时长：`等待2`、`等待5`。如：`点击登录，等待5` · `输入…，点击保存，等待2` | `等待文字…`、`等待加载`、`等待遮罩`、`等待登录成功`、`等待首页加载完成` 等任何「等待目标」 |
| 人手 / 已冻结菜谱 | 可用智能等待（`等待加载`、`等待文字真实字`…）；Agent **原样回放**，勿改写 | Agent 臆造页上不存在的状态句 |

说明：运行时对非秒数参数仍按字面量/保留模式执行（不纠偏）。为避免 Agent 与「等文字」冲突，**生成侧统一只产出秒数等待**。

## 工具怎么选（MCP）

| 意图 | 工具 |
|------|------|
| **执行**打开/点击/采集… | **`webclaw_run`**（默认、最常用） |
| 看引擎是否就绪 | `webclaw_status` |
| 看已冻结菜谱 | `webclaw_list_recipes` |
| 仅查保险箱有哪些站 | `webclaw_accounts_list`（`all` 工具面）/ Host 的 accounts_status |
| 人机验证码 | `webclaw_human_reply` |
| 停长任务 | `webclaw_cancel` |
| 关掉浏览器/实例 | **`webclaw_browser(action=stop)`**（禁止 PowerShell/`taskkill`） |
| 用户接管 / 弹出浏览器 | **`webclaw_set_display(headless=false)`**，保持有头直到用户说隐藏/无头 | 跑完擅自改回无头；用 `webclaw_run(headless=…)` 覆盖持久配置 |
| 隐藏浏览器 / 改成无头 | **`webclaw_set_display(headless=true)`** | 未获用户明确要求就改回无头 |
| 无完整菜谱、新站编排 | `webclaw_probe` → 再 `freeze`（不要对完整菜谱 probe） |
| 已有完整菜谱但中途失败 | 至多 1 次短补丁 / 改后整本再跑一次；再失败就求助 | 从登录重放；ps1/裸 CDP「眼睛」 |
| 看不清控件 | `webclaw_probe` 或菜谱 `采集…` | PowerShell 连 19222、自写 JS 挖 DOM |
| 跑成功后交付 | 先展示完整菜谱；用户明确同意后再 `save_skill`（自建更新 / 他人 asCopy）或 `freeze`；未同意只保留文字 | 默认/静默落库；只交补丁段；覆盖他人技能 |

## 保险箱与密码

- 菜谱写 `登录EHR系统` / `打开旧MES系统`（名称与保险箱一致即可）。
- **禁止**向用户要密码、禁止把密码写进对话或工具参数。
- Host 导出约定见 [host-vault-export.md](./host-vault-export.md)。

## 安装后本地副本

一键安装会把本说明书写到：

`$WEBCLAW_HOME/mcp/RECIPE-VERBS.md`

（Windows 默认 `%LOCALAPPDATA%\webclaw\mcp\RECIPE-VERBS.md`）
