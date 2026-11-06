# webclaw-x

webclaw **二次改造 P0** 工程落地仓：硬化 MCP 网关 + L1 契约验收 + fixture 评测 + 表格双写 + 定位冲突补丁。

上游运行时仍是 MIT 的 [webclaw-oss](https://github.com/lonk1989/webclaw-oss)（`webclaw-lite`）。本仓关系见 [FORK.md](./FORK.md)。

## 安装

```bash
# 1) 已有 release 二进制即可（本机常见路径）
ls ~/.webclaw/bin/webclaw-lite \
  || ls /workspace/webclaw-oss/target/release/webclaw-lite

# 2) Python 依赖（复用已有 venv 或新建）
cd /workspace/webclaw-x
# 默认 .venv → /workspace/webclaw-mcp/.venv（含 mcp）
# 若需独立：
#   python3 -m venv .venv && .venv/bin/pip install mcp pytest

export PYTHONPATH=/workspace/webclaw-x
export WEBCLAW_LITE_BIN="${WEBCLAW_LITE_BIN:-$HOME/.webclaw/bin/webclaw-lite}"
export WEBCLAW_HEADLESS=1   # 无头冒烟；演示可改 0
```

### 启动 MCP（stdio）

```bash
cd /workspace/webclaw-x
PYTHONPATH=. .venv/bin/python -m webclaw_x.server
```

WorkBuddy / Cursor 配置示例见 [docs/third-party-hosts.md](./docs/third-party-hosts.md)。

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

```text
export PATH="$HOME/.cargo/bin:$PATH"
python scripts/eval_smoke.py          # L1 → eval/out/latest.json（目标 green）
python scripts/l2_mcp_client.py       # L2 → eval/out/l2-client.json（目标 green）
python scripts/eval_components.py     # P1 组件包 → eval/out/components.json
# patch 0001（歧义拒绝）+ dualwrite-in-Rust 已编入 ~/.webclaw/bin/webclaw-lite
# 回滚见 FORK.md
```

## 验收用例（L1）

| ID | 内容 | 说明 |
|----|------|------|
| V-01 | `webclaw_status` | 二进制/Chrome 健康检查 |
| V-02 | 冻结菜谱 run | 使用 **本地 fixture HTML**（非内网 MES） |
| V-03 | 模糊「点击确定」 | 期望 `AMBIGUOUS_TARGET`（patch 0001 已编进二进制） |
| V-04 | HITL | 自动化有限 → mock/文档化跳过 |
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

`NEED_HUMAN` 返回时 CLI 保持运行；把返回的 `run_id` / `need_human.prompt_id` 连同人类回复交给 `webclaw_human_reply`，原任务续跑。单网关单活跃任务，不重放归档验证码。

## P1 菜谱库版本管理

新增不可覆盖版本库（正整数自动升版、tags/read_only/default parameters）与共享环境绑定；旧 `recipes/*.webclaw` 保持兼容。

```bash
.venv/bin/python -m webclaw_x.recipe_library --help
.venv/bin/python scripts/eval_recipe_lib.py # eval/out/recipe-library.json
```

MCP：`webclaw_recipe_publish/list/get/bind_env/diff`；回放 `webclaw_run(recipe_ref="name@1", environment="fixture")`。
环境只替换 `{{base_url}}` 等模板参数，不复制正文，也不自动放开域名策略。完整示例见 [recipe-library.md](docs/recipe-library.md)。
