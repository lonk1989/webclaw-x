# Fork provenance — webclaw-x

**webclaw-x** is a P0 engineering overlay / fork workspace for the “webclaw 二次改造” plan.

| Tree | Role |
|------|------|
| Upstream | [`webclaw-oss`](https://github.com/lonk1989/webclaw-oss) (MIT) — Rust `webclaw-lite` + DSH plugin |
| This repo | MCP gateway hardening, L1 eval suite, fixture site, dual-write, ambiguity design/patch, third-party host notes |
| Local MCP precursor | `/workspace/webclaw-mcp` (absorbed into `webclaw_x/`) |

## Relationship

- Runtime binary: consume upstream `webclaw-lite` (release build or `~/.webclaw/bin/webclaw-lite`).
- Optional patches under `patches/` may be applied to a checkout of upstream; see `docs/ambiguity-design.md`.
- License: MIT (same as upstream). Keep this `LICENSE` file when redistributing.

## Non-goals (this overlay)

- Not a reimplementation of the CDP runtime.
- Not an enterprise corp-session cloud.
- Does not ship real MES credentials or production recipes with secrets.

## Applied upstream patches (local dirty tree)

| Patch | Files in webclaw-oss | Rollback |
|-------|----------------------|----------|
| 0001 ambiguous click | `runtime/src/commands/scripts.rs`, `frame_eval.rs` | `git checkout --` those files; restore `~/.webclaw/bin/webclaw-lite.pre-0001.bak` |
| dualwrite-in-Rust | `runtime/src/page_collect.rs`, `runtime/src/commands/runtime.rs` | `git checkout --` those files; restore `~/.webclaw/bin/webclaw-lite.pre-dualwrite.bak` |

Build with:

```bash
export PATH="$HOME/.cargo/bin:$PATH"   # rustc 1.99.x — not /usr/bin/rustc 1.85
cd /workspace/webclaw-oss
cargo build --release -p webclaw --bin webclaw-lite
cp -a target/release/webclaw-lite ~/.webclaw/bin/webclaw-lite
```

| P1 Component Pack | `component_pack.rs`（新）、`builtin.rs`、`store.rs`、`mod.rs` | 见 `patches/ROLLBACK.md`；二进制 `webclaw-lite.pre-p1-components.bak` |

## P1 导航策略与可续跑 HITL

Rust 增加 `navigation_policy.rs`，接到 CDP navigate；`打开/open`、新标签、probe 共用。
MCP 增加 `webclaw_x/jobs.py` 进程生命周期与 prompt 作用域，沿用上游 FileHumanBridge。
本轮最小补丁与精确快照见 `patches/0003-policy-hitl.patch` / `patches/pre-policy-hitl/`；本轮不发布远端仓库。

## P1 Recipe Library overlay

仅 Python 层：不可覆盖的递增版本、环境模板绑定、MCP/CLI 与旧平铺兼容；没有新增 Rust diff。本轮网关快照 `patches/pre-recipe-library/server.py`。

## P1 Self-Heal（单步 Rust 包装 + MCP 契约）

Runtime 新增 `runtime/src/self_heal.rs`，`executor.rs` 原单步逻辑保留为 `execute_step_once`，外围执行默认关闭的有界只读自愈阶梯。`lib.rs` 注册模块。没有重新执行整份菜谱，也未接入任何 LLM；终止边界不进入上游旧 AI 恢复。

Overlay：`server.py` / `errors.py` 新增 `heal_trace` 与 `NEED_REPAIR` / `HEAL_CONFIG_INVALID`，新增配置示例、HTTP fixture 与 `eval_selfheal.py`。本轮前快照 `patches/pre-selfheal/`，二进制 `~/.webclaw/bin/webclaw-lite.pre-selfheal.bak`。MIT 声明与上游关系不变；保留前序 P0/P1 dirty 成果。详细行为见 `docs/self-heal.md`，精确回滚见 `patches/ROLLBACK.md`。

本轮可审阅增量补丁：`patches/0005-self-heal.patch`（从 `/workspace` 以 `-p1` 应用；同时含 oss/x 前缀）。
