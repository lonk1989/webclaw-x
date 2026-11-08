# webclaw-x

webclaw **二次改造** 主仓（monorepo）：硬化 MCP 网关 + 内嵌 Rust `runtime/`（`webclaw-lite`）+ L1 契约验收 + fixture 评测。

上游引擎源自 MIT 的 [webclaw-oss](https://github.com/lonk1989/webclaw-oss)；本仓以 **x 为主** 收纳 `runtime/`，Host 仍 subprocess 调用 lite（不揉成单进程）。关系与归因见 [FORK.md](./FORK.md)、`runtime/PROVENANCE.md`。本地 `/workspace/webclaw-oss` 保留作镜像/对照，默认不删。

**菜谱语义**：一步 = **指令（verb）** + **目标/参数（args）**；中英动词同一套回放（`打开`/`open`、`等待`/`wait`、`采集`/`collect` …）。示例见 `recipes/fixture-table.webclaw` 与 `recipes/fixture-table.en.webclaw`。

## 安装（终端用户默认：预编译）

**不要**一上来 `cargo build`。预编译 `webclaw-lite` 约 **61MB**；从源码编译会在本机留下数 GB 级的 `target/`，只适合改引擎的人。

```bash
cd /path/to/webclaw-x

# 一键：拉预编译 lite → venv/mcp → 写出 mcp.json 片段
./scripts/install_webclaw.sh
# 可选业务域名草稿（不会自动放行全世界）：
# ./scripts/install_webclaw.sh --hosts 'app.example.com,login.example.com'

# 片段在 $WEBCLAW_HOME/mcp/（默认 ~/.webclaw/mcp/）
# 拷进 Cursor / WorkBuddy 的 mcp.json 后重连并信任工具
```

仅下载 lite：`skills/webclaw-lite/scripts/install.sh`（或 Windows `install.ps1`）。  
macOS Gatekeeper：`xattr -d com.apple.quarantine ~/.webclaw/bin/webclaw-lite`。

手工接通时：

```bash
export PYTHONPATH=/path/to/webclaw-x
export WEBCLAW_LITE_BIN=$HOME/.webclaw/bin/webclaw-lite
export WEBCLAW_HOME=$HOME/.webclaw
export WEBCLAW_TOOLS=core          # 默认；完整工具面设 all
export WEBCLAW_HEADLESS=1          # 无头冒烟；演示可改 0
PYTHONPATH=. .venv/bin/python -m webclaw_x.server
```

二进制查找顺序：`WEBCLAW_LITE_BIN` → 仓内 `target/release` → `bin-webclaw-lite` → `~/.webclaw/bin`。

### 附录：开发者从源码编 lite

```bash
export PATH="$HOME/.cargo/bin:$PATH"
./scripts/build_runtime.sh   # → ~/.webclaw/bin/webclaw-lite，并产生巨大 target/
```

### 首载约定（Agent / 第三方 Host）

- **常驻 stdio**：禁止每工具 respawn；评测用 `scripts/call_tool.py --persist …`
- **status 热路径**：默认不 spawn lite（`WEBCLAW_STATUS_MODE=fast`）；`WEBCLAW_STATUS_MODE=lite` 才走 CLI
- **可选预热**：`WEBCLAW_PREWARM=1` 在网关启动时后台确保 CDP 就绪
- Skill 与 MCP instructions 共用 `webclaw_x/fast_card.py` 一张快卡，勿叠读 lite/伙伴 Skill 全文
- **工具面**：默认 `WEBCLAW_TOOLS=core`（约 7 个）；`WEBCLAW_TOOLS=all` 暴露完整目录（含 recipe_* / accounts / policy_draft 等）
- **新助手入口**：只读 [`skills/SKILL.md`](./skills/SKILL.md)（含真业务 checklist）
- **policy 草稿**：`python scripts/policy_draft.py --hosts '…' --out $WEBCLAW_HOME/policy.json.draft`（审阅后才改名 `policy.json`）
- **登录态**：默认复用健康 CDP；`WEBCLAW_PREWARM=1` 可选预热；`WEBCLAW_CHROME_RECYCLE=1` 才强制冷启
- **lite serve**（Unix）：`webclaw-lite serve` 支持 ping/status/prewarm/**run/cancel**；OCR 模型在同进程二次 run 可复用；Windows serve 未就绪

### 启动 MCP（stdio）

```bash
cd /workspace/webclaw-x
PYTHONPATH=. .venv/bin/python -m webclaw_x.server
```

WorkBuddy / Cursor 配置示例见 [docs/third-party-hosts.md](./docs/third-party-hosts.md)。

## 一键总回归看板（P1 收口）

```bash
cd /workspace/webclaw-x
source .venv/bin/activate  # 本机 python 由现有 venv 提供
python scripts/eval_all.py
```

自动使用本仓 `.venv`，按 L1 → components → policy → recipe_lib → selfheal → L2 串行跑现有评测，避免共享 CDP 冲突。输出 `eval/out/dashboard.json` 与极简表格 `eval/out/dashboard.md`，包含每套件状态、passed/failed、耗时、原报告路径及日志。汇总计数含 L1/专项的重复执行，非去重用例数；仅全部 green 返回 0，yellow/red 返回 1。缺失/未更新的旧报告不会误记 green。运行时看板状态为 running；请勿同时启动独立 eval。

快速检查看板逻辑（不启动浏览器）：`python -m unittest discover -s scripts -p test_eval_all.py`。

## 跑 L1 验收 / 看报告

```bash
cd /workspace/webclaw-x
python scripts/eval_smoke.py
# 或
bash scripts/eval_smoke.sh

# 报告
cat eval/out/latest.json
```

状态含义：

| status | 含义 |
|--------|------|
| green | 断言全过 |
| yellow | 仅有合理 skip（或环境性 xfail）；P0 现目标为 green |
| red | 硬失败 |

也可直接：

```bash
PYTHONPATH=. .venv/bin/python -m pytest tests/ -q
```


## L2 MCP Client（无大模型黑盒）

```bash
cd /workspace/webclaw-x
export PATH="$HOME/.cargo/bin:$PATH"
export WEBCLAW_LITE_BIN=$HOME/.webclaw/bin/webclaw-lite
export WEBCLAW_HEADLESS=1
.venv/bin/python scripts/l2_mcp_client.py
cat eval/out/l2-client.json
```

通过 stdio 拉起 `python -m webclaw_x.server`，直接调工具跑 V-01/V-02/V-03，不经 LLM。

## 最新验收

Host 契约加固后实测全部 **green**：L1 86 passed（含新增 Host 契约 37 项；0 failed / xfailed / skipped）；L2 7、components 2、policy 11、recipe-library 18、Self-Heal 10 passed。Rust 错误码单测 2 passed，release 已同步。看板：`eval/out/dashboard.json` / `dashboard.md`（2026-11-06 13:44，Asia/Shanghai；各套件有重复执行，不是 134 个去重用例）。

```text
export PATH="$HOME/.cargo/bin:$PATH"
python scripts/eval_smoke.py          # L1 → eval/out/latest.json（目标 green）
python scripts/l2_mcp_client.py       # L2 → eval/out/l2-client.json（目标 green）
python scripts/eval_components.py     # P1 组件包 → eval/out/components.json
python scripts/eval_policy.py         # P1 策略/HITL → eval/out/policy.json
python scripts/eval_recipe_lib.py     # P1 版本库 → eval/out/recipe-library.json
python scripts/eval_selfheal.py       # P1 单步自愈 → eval/out/selfheal.json
# runtime 已纳入本仓 runtime/；编译见 ./scripts/build_runtime.sh
# 回滚与上游归因见 FORK.md
```

## 验收用例（L1）

| ID | 内容 | 说明 |
|----|------|------|
| V-01 | `webclaw_status` | 二进制/Chrome 健康检查 |
| V-02 | 冻结菜谱 run | 使用 **本地 fixture HTML**（非内网 MES） |
| V-03 | 模糊「点击确定」 | 期望 `AMBIGUOUS_TARGET`（patch 0001 已编进二进制） |
| V-04 | HITL | 本地 FileHumanBridge 实测暂停/回复/续跑；真实验证码仍须人处理 |
| V-05 | probe→freeze→二次 run | fixture |

Fixture 站点：`fixtures/site/`（login / table / ambiguous）。

## 表格双写

**Runtime 一等产物**（已沉到 Rust）：`采集` / `采集表格` 在 `runs/*/documents/` 同时写出：

- `页面采集-*.md`
- `页面采集-*.tables.json`
- `页面采集-*.csv`（多表时 `*.1.csv` …）

MCP 层 `webclaw_x/dualwrite.py` 仅作旧二进制回退补写。

## 关键路径

```
webclaw_x/server.py     MCP 网关（统一错误码、脱敏、Skill 指令、双写）
webclaw_x/scrub.py      密码/验证码脱敏
webclaw_x/dualwrite.py  MD 表 → JSON/CSV（旧二进制回退）
scripts/l2_mcp_client.py  L2 stdio 黑盒 Client
webclaw_x/errors.py     ErrorCode 契约
tests/                  L1 + 单测
scripts/eval_smoke.py   一键评测
docs/third-party-hosts.md   WorkBuddy 等
docs/component-pack.md      P1 日期/下拉/分页
docs/self-heal.md           P1 单步自愈阶梯
scripts/eval_selfheal.py    自愈自动验收
docs/ambiguity-design.md    定位冲突设计
patches/                Rust 补丁说明
skills/SKILL.md         给 Host Agent 的用法
```

## 许可

MIT — 见 [LICENSE](./LICENSE)。

## P1 域名策略 + HITL

默认导航白名单开启，仅 localhost/loopback 放行。配置 `$WEBCLAW_HOME/policy.json` 的 `allowed_hosts` 可开放具体 host；部署者可用 `WEBCLAW_POLICY_ENABLED=0` 关闭。不是完整浏览器网络防火墙，边界见 [policy-and-hitl.md](docs/policy-and-hitl.md)。

```bash
.venv/bin/python scripts/eval_policy.py  # → eval/out/policy.json
```

`NEED_HUMAN` 返回时 CLI 保持运行；把返回的 `run_id` / `need_human.prompt_id` 连同人类回复交给 `webclaw_human_reply`，原任务续跑。同一 `WEBCLAW_HOME` 跨进程单活跃 run（POSIX 文件锁，冲突返回 `RUN_BUSY`），不重放归档验证码。

## P1 菜谱库版本管理

新增不可覆盖版本库（正整数自动升版、tags/read_only/default parameters）与共享环境绑定；旧 `recipes/*.webclaw` 保持兼容。

```bash
.venv/bin/python -m webclaw_x.recipe_library --help
.venv/bin/python scripts/eval_recipe_lib.py # eval/out/recipe-library.json
```

MCP：`webclaw_recipe_publish/list/get/bind_env/diff`；回放 `webclaw_run(recipe_ref="name@1", environment="fixture", params_confirmed=true)`。
环境只替换 `{{base_url}}` 等模板参数，不复制正文，也不自动放开域名策略。完整示例见 [recipe-library.md](docs/recipe-library.md)。

## P1 自愈阶梯（单步、默认关闭）

```bash
.venv/bin/python scripts/eval_selfheal.py # eval/out/selfheal.json
```

配置 `$WEBCLAW_HOME/heal.json` / `WEBCLAW_HEAL_FILE`，示例 [config/heal.example.json](config/heal.example.json)。默认关闭；`WEBCLAW_HEAL_ENABLED=0` 可强制停用。只对失败的只读步骤依次短重试→可选刷新→显式结构等待→可选 HITL；从不重跑整菜谱，不重试点击/输入等动作，也不绕过白名单或歧义。耗尽返回 `NEED_REPAIR`，AI 只保留有界接口（本轮调用 0 次）。配置、可测行为与边界见 [docs/self-heal.md](docs/self-heal.md)。所有浏览器评测需串行。

## Host 契约加固（WorkBuddy 点评后）

- 含 `{{...}}` 的正文/路径/版本菜谱，网关要求 `params_confirmed=true`，否则返回 `PARAMS_UNCONFIRMED` 与参数名，不启动 lite；无占位符不受影响。Host 必须先真实询问用户，密码仍走金库。
- `webclaw_list_recipes` 与 `webclaw_recipe_list` 均返回平铺 + 版本库的 `data.recipes`，含 source/version/tags/参数名摘要；原工具名保留；旧 `data.stdout_tail` 兼容视图已 deprecated，请只读结构化字段。
- lite 失败 `done.error_code` 优先于日志解析；策略拒绝/定位歧义/CDP 超时使用稳定码；旧二进制仍有日志兼容回退。
- 运行中的 WorkBuddy MCP 需重启/重连以加载网关；不改 mcp.json。豆包验证留待下一轮。


### Host 生命周期加固（2026-11-06）

- 活跃任务原子落盘于 `WEBCLAW_HOME/jobs/<run_id>.json`，记录 PID/PGID、启动时间、状态等；不保存菜谱正文、参数或秘密。
- 共享同一 home 的不同 stdio 会话，可调用 `webclaw_cancel`（可选 `run_id`）停止同一任务。SIGTERM 等 0.5 秒后必要时 SIGKILL；完成、超时、取消均清理任务 JSON。
- scan → spawn → register 在同一 `flock` 事务中；冲突拒绝 `RUN_BUSY`，不排队等待整个 run。死亡 PID 自动清理；损坏元数据则 fail-closed 返回 `INTERNAL`，请部署者审阅，勿盲目删除活跃记录。
- `webclaw_status` 直接读 `data.bin / data.chrome / data.chromeOk / data.version / …`；`webclaw_list_recipes` 读 `data.recipes`。二者的 `stdout_tail` 是 deprecated 兼容字段，不再作为新 Host 契约。
- 需重连所有网关进程；新旧进程混用不能保证互斥。互斥范围是同一 home，不是同一 CDP 端口；不同 home 共用 Chrome 仍需部署隔离。
- 当前跨进程实现面向 POSIX（Linux 本轮验证），原生 Windows 尚需锁/进程组适配。详情见 `docs/third-party-hosts.md`。
