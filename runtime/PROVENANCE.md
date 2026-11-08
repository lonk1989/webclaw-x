# Runtime provenance

This `runtime/` tree is the MIT-licensed `webclaw-lite` engine vendored from
[webclaw-oss](https://github.com/lonk1989/webclaw-oss) into the webclaw-x monorepo.
Snapshot tip at import: `f48483c` (local oss, 2026-11-08).

Upstream LICENSE: see repo-root `LICENSE` (MIT).
Do not merge this process into the Python MCP host; lite stays a subprocess.

Also vendored for `include_str!` build deps:
- `skills/webclaw/`, `skills/webclaw-lite/` (oss)
- `examples/` (oss rhai + guides)
