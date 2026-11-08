# Fork provenance — webclaw-x (monorepo)

**webclaw-x** is the primary engineering tree for the “webclaw 二次改造” plan: MCP Host + vendored Rust runtime.

| Tree | Role |
|------|------|
| This repo (`webclaw-x`) | **Primary.** Python MCP gateway (`webclaw_x/`) + vendored `runtime/` (`webclaw-lite`) |
| Upstream source | [`webclaw-oss`](https://github.com/lonk1989/webclaw-oss) (MIT) — original Rust engine / DSH / desktop |
| Local sibling checkout | `/workspace/webclaw-oss` — **kept as read-only mirror / contrast**; not deleted by the monorepo import |
| Local MCP precursor | `/workspace/webclaw-mcp` (absorbed into `webclaw_x/`) |

## Relationship

- **Runtime source of truth for this fork:** `runtime/` in this repo (imported from oss tip `f48483c`, local).
- **Compile-time assets also vendored:** `examples/` and `skills/webclaw{,-lite}/` (required by Rust `include_str!`; x’s own `skills/SKILL.md` kept).
- **Process split unchanged:** MCP Host still launches `webclaw-lite` as a **subprocess**. Rust and Python are not merged into one process.
- **Binary lookup** (`webclaw_x/lite_bin.py`), first existing file wins:
  1. `WEBCLAW_LITE_BIN` (explicit override)
  2. `<repo>/target/release/webclaw-lite` (in-monorepo cargo build)
  3. `<repo>/bin-webclaw-lite` (compat symlink)
  4. `~/.webclaw/bin/webclaw-lite`
  5. `/workspace/webclaw-oss/target/release/webclaw-lite` (legacy sibling transition)
- License: MIT (same as upstream). Keep root `LICENSE` when redistributing. See also `runtime/PROVENANCE.md`.

## Build runtime from this repo

```bash
export PATH="$HOME/.cargo/bin:$PATH"   # prefer rustup toolchain, not distro rustc
cd /workspace/webclaw-x
./scripts/build_runtime.sh            # cargo build --release -p webclaw --bin webclaw-lite
                                      # + install → ~/.webclaw/bin/webclaw-lite
# or:
#   cargo build --release -p webclaw --bin webclaw-lite
#   ./scripts/build_runtime.sh --no-install
```

## Non-goals

- Not a reimplementation of the CDP runtime.
- Not folding Host + lite into a single process.
- Not an enterprise corp-session cloud.
- Does not ship real MES credentials or production recipes with secrets.

## Historical patches (pre-monorepo)

Patches under `patches/` were originally applied against a separate `/workspace/webclaw-oss` checkout. After the monorepo import, prefer editing `runtime/` here directly. Rollback notes below still describe the intent of each change.

| Patch | Files (now under this repo) | Rollback hint |
|-------|------------------------------|---------------|
| 0001 ambiguous click | `runtime/src/commands/scripts.rs`, `frame_eval.rs` | restore files; binary bak `webclaw-lite.pre-0001.bak` |
| dualwrite-in-Rust | `runtime/src/page_collect.rs`, `runtime/src/commands/runtime.rs` | restore files; `webclaw-lite.pre-dualwrite.bak` |
| P1 Component Pack | `component_pack.rs` 等 | `patches/ROLLBACK.md`；`webclaw-lite.pre-p1-components.bak` |

## P1 导航策略与可续跑 HITL

Rust 增加 `navigation_policy.rs`，接到 CDP navigate；`打开/open`、新标签、probe 共用。
MCP 增加 `webclaw_x/jobs.py` 进程生命周期与 prompt 作用域，沿用上游 FileHumanBridge。
本轮最小补丁与精确快照见 `patches/0003-policy-hitl.patch` / `patches/pre-policy-hitl/`。

## P1 Recipe Library overlay

仅 Python 层：不可覆盖的递增版本、环境模板绑定、MCP/CLI 与旧平铺兼容。

## P1 Self-Heal（单步 Rust 包装 + MCP 契约）

Runtime 新增 `runtime/src/self_heal.rs`，`executor.rs` 原单步逻辑保留为 `execute_step_once`。
Overlay：`server.py` / `errors.py` 新增 `heal_trace` 与 `NEED_REPAIR` / `HEAL_CONFIG_INVALID`。
详细行为见 `docs/self-heal.md`，精确回滚见 `patches/ROLLBACK.md`。
