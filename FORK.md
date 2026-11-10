# Fork provenance — webclaw-x (monorepo)

**webclaw-x** 是当前唯一工程真源：MCP Host + 自带 Rust 运行时 + DSH Cordis 插件。

| Tree | Role |
|------|------|
| This repo (`webclaw-x`) | **唯一真源。** `webclaw_x/`（Python MCP）+ `runtime/`（`webclaw-lite`）+ `packages/webclaw`（`@lonk1989/webclaw` DSH 插件） |
| Historical upstream | 原 [webclaw-oss](https://github.com/lonk1989/webclaw-oss)（MIT）已废弃；勿再改、勿再当依赖路径 |

## Relationship

- **引擎：** `runtime/`（`cargo build --release -p webclaw --bin webclaw-lite`）
- **DSH 插件：** `packages/webclaw`（`@lonk1989/webclaw`）；本地热更：`cd packages/webclaw && npm run sync:local`
- **MCP Host：** `webclaw_x/`，仍以**子进程**调用 lite（不合并进程）
- **二进制查找**（`webclaw_x/lite_bin.py`），先命中先用：
  1. `WEBCLAW_LITE_BIN`
  2. `<repo>/target/release/webclaw-lite[.exe]`
  3. `<repo>/bin-webclaw-lite`
  4. `~/.webclaw/bin/webclaw-lite`（Windows：`%LOCALAPPDATA%\webclaw\bin\`）
- License: MIT。见根目录 `LICENSE` 与 `runtime/PROVENANCE.md`。

## Build runtime

```bash
cd /path/to/webclaw-x
./scripts/build_runtime.sh
# or: cargo build --release -p webclaw --bin webclaw-lite
```

## Sync DSH plugin into 蜂行

```bash
cd packages/webclaw
npm install
npm run sync:local          # cargo lite + copy into fengxing bundle
# or: npm run sync:local:plugin
```

蜂行 `ensure-webclaw.mjs` 默认本地路径：`E:/Workspace/webclaw-x/packages/webclaw`。

## Non-goals

- Not a reimplementation of the CDP runtime.
- Not folding Host + lite into a single process.
- Not shipping real MES credentials.

## Historical patches

`patches/` 记录早期对独立 oss 仓的改动；现一律改本仓 `runtime/` / `webclaw_x/` / `packages/webclaw`。
