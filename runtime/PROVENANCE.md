# Runtime provenance

`runtime/` 是本仓 vendored 的 MIT `webclaw-lite` 引擎（历史上自 webclaw-oss 导入；**oss 仓已废弃，勿再改旁路副本**）。

- 引擎真源：本目录
- DSH 插件真源：仓库根下 `packages/webclaw`（`@lonk1989/webclaw`）
- MCP Host：`webclaw_x/`（子进程调用 lite，不合并进程）

上游 LICENSE：见仓库根 `LICENSE`（MIT）。
