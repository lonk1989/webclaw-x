# 定位冲突（AMBIGUOUS_TARGET）设计补丁

## 现状（upstream webclaw-oss）

- `parse_click_text_args("确定")` → `(query="确定", match_index=1)`  
  无 `#N` 时**默认 1**，静默点得分最高的第一个。
- `locate_global_click_text_once` 按排名取 `entries[global_index-1]`，不区分「用户显式 #1」与「默认」。
- 上传附件路径已有「无序号 = 须唯一」语义（`index == 0`），点击文字尚未对齐。

## 目标行为

| 菜谱写法 | 候选数 | 行为 |
|----------|--------|------|
| `点击确定` | 0 | 失败：未找到 |
| `点击确定` | 1 | 点击该唯一候选 |
| `点击确定` | ≥2 | **拒绝静默点击**，返回 `AMBIGUOUS_TARGET` + 候选列表（text/frame/score/#N） |
| `点击确定#2` | ≥2 | 显式序号，点第 2 个（保持现行为） |

## 建议改动点（Rust）

1. `commands/scripts.rs` `parse_click_text_args`  
   - 无 `#N` → `match_index = 0`（须唯一）；有 `#N` → 显式序号。  
2. `commands/frame_eval.rs` `locate_global_click_text_once`  
   - `global_index == 0`：`entries.len()==1` 用之；`>1` 返回错误字符串含 `AMBIGUOUS_TARGET` 与候选摘要。  
3. JS `compose_click_script` 内同逻辑（防非 fan-out 路径漏网）。  
4. MCP 网关已能用正则把「共 N 个足够匹配」等映射为 `code=AMBIGUOUS_TARGET`。

## 本仓产物

- 补丁说明：`patches/0001-ambiguous-click-refuse-silent.md`  
- 试验性 diff：`patches/0001-ambiguous-click-refuse-silent.patch`（对 oss 树）  
- 验收：`tests/test_l1_contract.py::test_v03_ambiguous_target`（patch 前 xfail）

## 风险

- 旧菜谱依赖「多个确定时点第一个」会开始失败 → 需改成 `#1` 或收紧文案。  
- 属**有意破坏性**改进，应在 CHANGELOG / Skill 中写明。
