# Component Pack（P1 最小切片）

> 目标：让菜谱（中英动词）能稳定操作 **日期范围 / 下拉 / 分页**，先以 fixture + 适配器证明闭环，再演进到真 Element/Ant 站点。

## 已交付动词

| 动词 | 示例 | 行为 |
|------|------|------|
| `选择日期范围` | `选择日期范围 2026-01-01至2026-11-06` | 写入起止 input，派发 input/change |
| | `选择日期范围 开始=2026-01-01，结束=2026-11-06` | 同上 |
| `选择下拉` | `选择下拉 状态=已完成` | 打开下拉并点选项 |
| | `选择下拉 已完成` | 页上仅一个 select 时可用 |
| `翻页` | `翻页下一页` / `翻页上一页` / `翻页第2页` | 点分页控件 |
| `翻到` | `翻到第3页` / `翻到 2` | 与翻页同脚本 |

上述动词为 **新增**，不改写既有 `点击`/`输入`/`等待` 语义。

## 定位策略（适配器层）

1. **优先** `[data-webclaw-comp="date-range|select|pager"]`（webclaw-x fixture 契约）
2. **回退** Element 风格 class：`.el-range-editor` / `.el-select` / `.el-pagination`
3. 脚本标记：`component-pack-v1`（`commands` 库可 refresh 升级）

实现位置（upstream 本地改动）：

- `runtime/src/commands/component_pack.rs` — JS 适配器
- `runtime/src/commands/builtin.rs` — 注册动词
- `runtime/src/commands/store.rs` — merge/refresh

## Fixture

`fixtures/site/components.html` — 简化 DOM，**未**引入真实 Element 包，但 class 命名对齐 Element。

## 验收

```bash
export PATH="$HOME/.cargo/bin:$PATH"
cd /workspace/webclaw-x
export WEBCLAW_LITE_BIN=$HOME/.webclaw/bin/webclaw-lite WEBCLAW_HEADLESS=1
python scripts/eval_components.py   # → eval/out/components.json
python scripts/eval_smoke.py        # L1 仍须 green
```

## 能力边界（P1）

- ✅ 本地 fixture 回放成功
- ✅ 中文动词可解析、可冻结进 `.webclaw`
- ⚠️ 真站 Element/Ant 的弹层挂载、虚拟列表、Teleport 到 `body` 的 dropdown **未**充分覆盖
- ⚠️ 日期面板「点选日历格子」未做；当前是 **直接写 input 值**（对可控表单足够，对强校验只读 picker 可能不够）
- ⚠️ 不保证所有 EasyUI / 自研组件

## 后续计划

| 阶段 | 内容 |
|------|------|
| P1.1 | 日历面板点选（打开 picker → 点日） |
| P1.2 | Ant Design `ant-picker` / `ant-select` / `ant-pagination` 回退选择器 |
| P1.3 | 真站抽样（需账号的走 HITL/金库，不进仓库） |
| P1.4 | probe 输出 `compCmd`（如 `选择下拉 状态=`）辅助编排 |

## 回滚

见 `patches/ROLLBACK.md`（含 `webclaw-lite.pre-p1-components.bak`）。
