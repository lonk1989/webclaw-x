# 回滚 webclaw-oss 本地改动

基线 SHA：`1dec6c1aae994ad0b4ccc15807adf11a3ab21914`

```bash
cd /workspace/webclaw-oss
git checkout -- \
  runtime/src/commands/scripts.rs \
  runtime/src/commands/frame_eval.rs \
  runtime/src/page_collect.rs \
  runtime/src/commands/runtime.rs

# 二进制回滚（任选较新备份之前的）
cp -a ~/.webclaw/bin/webclaw-lite.pre-0001.bak ~/.webclaw/bin/webclaw-lite
# 或 dualwrite 前：
# cp -a ~/.webclaw/bin/webclaw-lite.pre-dualwrite.bak ~/.webclaw/bin/webclaw-lite
```

## P1 Component Pack

额外文件：

- `runtime/src/commands/component_pack.rs`（新文件，回滚时删除）
- `runtime/src/commands/mod.rs`（去掉 `pub(crate) mod component_pack;`）
- `runtime/src/commands/builtin.rs` / `store.rs`

```bash
cd /workspace/webclaw-oss
git checkout -- runtime/src/commands/builtin.rs runtime/src/commands/store.rs runtime/src/commands/mod.rs
rm -f runtime/src/commands/component_pack.rs
# 若仍保留 0001+dualwrite，不要 checkout scripts/frame_eval/page_collect/runtime（采集）除非也要回滚
cp -a ~/.webclaw/bin/webclaw-lite.pre-p1-components.bak ~/.webclaw/bin/webclaw-lite
```

## P1 policy / resumable HITL（只退本轮，保留前序改动）

应用前快照：`/workspace/webclaw-x/patches/pre-policy-hitl/`。

```bash
cd /workspace/webclaw-oss
cp /workspace/webclaw-x/patches/pre-policy-hitl/runtime.rs runtime/src/commands/runtime.rs
cp /workspace/webclaw-x/patches/pre-policy-hitl/builtin.rs runtime/src/commands/builtin.rs
cp /workspace/webclaw-x/patches/pre-policy-hitl/mod.rs runtime/src/cdp/mod.rs
cp /workspace/webclaw-x/patches/pre-policy-hitl/lib.rs runtime/src/lib.rs
# 删除本轮新增文件（确认无后续修改后）：runtime/src/navigation_policy.rs
cp ~/.webclaw/bin/webclaw-lite.pre-policy-hitl.bak ~/.webclaw/bin/webclaw-lite
```

网关 `server.py`、`scrub.py` 原文件也在快照目录。恢复它们时一并撤销 `errors.py` 新增枚举，移走本轮 `jobs.py` / `tests/test_policy_hitl.py` / `scripts/eval_policy.py` 即回到前序代码。不要用全仓 `git reset --hard` 丢弃前序 P0/P1。

`errors.py` 精确原件已加入同一快照目录；完整本轮代码 diff：`patches/0003-policy-hitl.patch`（oss/x 两树前缀，不含前序改动）。

本轮在 box 新建了 `~/.webclaw/policy.json`（localhost-only，权限 600，与代码缺省值相同）；若完整回滚可在审阅后移走此文件。若是在本轮之后修改过名单，不要覆盖其更改。

## P1 recipe-library（不改 Rust）

本轮前网关：`patches/pre-recipe-library/server.py`。回滚先停用正在运行的 MCP 任务，再恢复该文件；本轮新增的 `recipe_library.py`、`test_recipe_library.py`、`eval_recipe_lib.py` 可移走。

版本数据位于 `$WEBCLAW_HOME/recipe-library/`，不要删除其数据来做代码回滚；平铺 `recipes/*.webclaw` 未被迁移或覆盖。

## P1 Self-Heal（只退本轮，保留 L1/L2/components/policy/recipe-library）

优先无需回滚代码即停用：`WEBCLAW_HEAL_ENABLED=0`（重新启动 MCP，或设置文件 `enabled=false`）。本轮没有写入真实 `~/.webclaw/heal.json`。

完整回滚前先停用活跃 MCP/CLI 任务；**确认这些文件没有后续变更后**再执行（否则先 diff 并手工合并，勿覆盖后续工作）：

```bash
cd /workspace/webclaw-oss
cp /workspace/webclaw-x/patches/pre-selfheal/executor.rs runtime/src/executor.rs
cp /workspace/webclaw-x/patches/pre-selfheal/lib.rs runtime/src/lib.rs
# 新文件不再被 mod 引用，可保留或移至仓外：runtime/src/self_heal.rs
cd /workspace/webclaw-x
cp patches/pre-selfheal/server.py webclaw_x/server.py
cp patches/pre-selfheal/errors.py webclaw_x/errors.py
cp patches/pre-selfheal/host-skill.md skills/SKILL.md
cp ~/.webclaw/bin/webclaw-lite.pre-selfheal.bak ~/.webclaw/bin/webclaw-lite
# bin-webclaw-lite 是该二进制的符号链接，无需第二次复制
```

回退源码后，如需重新编译：`PATH="$HOME/.cargo/bin:$PATH" cargo build --release -p webclaw --bin webclaw-lite`（在 oss 执行）。本轮新增 `tests/test_selfheal.py` / `scripts/eval_selfheal.py` 与配置/fixture/文档可归档，勿继续运行新测试验证旧二进制。旧评测命令仍可使用；不要全仓 reset/checkout，不要清除菜谱库或运行产物。

本轮完整增量：`patches/0005-self-heal.patch`；已用 `patch --dry-run --reverse --batch -p1` 验证与当前树匹配（在 `/workspace`）。不要对后续变更盲目逆向应用；源码快照只覆盖本轮前状态。文档原件亦在 `pre-selfheal/`，可按需恢复 README/FORK/ROLLBACK。

## Host 契约加固（params / 发现 / 结构化错误码，2026-11-06）

只退本轮的原件：`patches/pre-contract-fixes/x/` 与 `oss/`（保留前序 P0/P1）。增量为 `patches/0006-host-contract.patch`。**先停止活跃 MCP/CLI 任务，确认文件没有后续变更；否则仅手工合并本轮逆向 diff。不要全仓 reset/checkout。**

- 网关原件：`x/webclaw_x/{server,errors,recipe_library}.py`。
- Rust 原件：`oss/runtime/src/{executor,run_sink,worker,lite}.rs` 与 `oss/runtime/src/cdp/mod.rs`；按同目录相对路径复制回 `/workspace/webclaw-oss/`，只替换本轮文件。
- 测试/示例/文档原件：`x/tests/`、`x/scripts/l2_mcp_client.py`、`x/docs/recipe-library.md`、`x/README.md`、`x/skills/SKILL.md`；新增 `tests/test_host_contract_fixes.py` 可归档。
- 二进制本轮前备份：`~/.webclaw/bin/webclaw-lite.pre-contract-fixes.bak`；停任务后可复制回 `~/.webclaw/bin/webclaw-lite`。`bin-webclaw-lite` 符号链接未变。
- 若重编译，在 oss：`PATH="$HOME/.cargo/bin:$PATH" RUSTC="$HOME/.cargo/bin/rustc" cargo build --release -p webclaw --bin webclaw-lite`。本轮同命令已编译并同步 release 到原 MCP 使用位置。
- 重启/重连 Host 的 MCP 进程；无需改 WorkBuddy mcp.json。回滚会撤销参数确认门禁和统一发现，但不要删除版本库/环境绑定/运行产物。
