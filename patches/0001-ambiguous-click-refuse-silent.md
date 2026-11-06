# Patch 0001 — 多候选拒绝静默点击

Apply against `/workspace/webclaw-oss` (runtime). See also `docs/ambiguity-design.md`.

## Manual application (if `patch` fails)

### A. `runtime/src/commands/scripts.rs` — `parse_click_text_args`

Change default:

```rust
// before
let mut match_index = 1u32;
// after
let mut match_index = 0u32; // 0 = must be unique; explicit #N sets >=1
```

And allow returning index 0 (remove `if n < 1 { return None; }` only for the explicit branch — keep rejecting `#0`).

Update unit test `parse_click_text_args_basic` expectations: bare text → index 0.

### B. `runtime/src/commands/frame_eval.rs` — `locate_global_click_text_once`

After sorting `entries`:

```rust
if global_index == 0 {
    if entries.is_empty() {
        return Err(format!("未找到「{query}」（跨 frame 共 0 个足够匹配）"));
    }
    if entries.len() > 1 {
        let preview: Vec<String> = entries
            .iter()
            .take(8)
            .enumerate()
            .map(|(i, h)| format!("#{} @{}", i + 1, h.target_id))
            .collect();
        return Err(format!(
            "AMBIGUOUS_TARGET:「{query}」匹配到 {} 个候选，请加 #序号（例如 点击{query}#1）。候选：{}",
            entries.len(),
            preview.join("；")
        ));
    }
    let hit = &entries[0];
    return Ok(StructuralLocalHit { /* ... from hit ... */ });
}
```

Also relax `locate_global_click_text_with_hot` early reject `global_index < 1` to allow 0.

### C. Rebuild

```sh
cd /workspace/webclaw-oss/runtime
cargo build --release --bin webclaw-lite
# then re-link ~/.webclaw/bin/webclaw-lite
```

### D. Re-run

```sh
cd /workspace/webclaw-x
python scripts/eval_smoke.py
# expect test_v03 to flip from xfail → pass
```

## 状态（2026-11-06 Asia/Shanghai）

已应用到 webclaw-oss @ 1dec6c1… 并 `cargo build --release -p webclaw --bin webclaw-lite`（rustc 1.99.1）。二进制已同步到 `~/.webclaw/bin/webclaw-lite`。
