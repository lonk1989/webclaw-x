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
