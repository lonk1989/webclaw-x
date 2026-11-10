"""Resolve webclaw-lite binary path without changing Host/runtime process split.

Order (first existing file wins):
1. WEBCLAW_LITE_BIN if set
2. <repo>/target/release/webclaw-lite  (in-monorepo cargo build)
3. <repo>/bin-webclaw-lite             (compat symlink)
4. ~/.webclaw/bin/webclaw-lite  (Windows: %LOCALAPPDATA%/webclaw/bin)
"""

from __future__ import annotations

import os
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]


def candidates(repo_root: Path | None = None) -> list[Path]:
    root = Path(repo_root) if repo_root is not None else _REPO_ROOT
    out: list[Path] = []
    env = os.environ.get("WEBCLAW_LITE_BIN")
    if env:
        out.append(Path(env))
    local = os.environ.get("LOCALAPPDATA")
    win_home = Path(local) / "webclaw" / "bin" / "webclaw-lite.exe" if local else None
    out.extend(
        [
            root / "target" / "release" / "webclaw-lite",
            root / "target" / "release" / "webclaw-lite.exe",
            root / "bin-webclaw-lite",
            Path.home() / ".webclaw" / "bin" / "webclaw-lite",
        ]
    )
    if win_home is not None:
        out.append(win_home)
    # de-dupe while preserving order
    seen: set[str] = set()
    uniq: list[Path] = []
    for p in out:
        key = str(p)
        if key in seen:
            continue
        seen.add(key)
        uniq.append(p)
    return uniq


def resolve_lite_bin(repo_root: Path | None = None) -> Path:
    for p in candidates(repo_root):
        try:
            if p.is_file():
                return p
        except OSError:
            continue
    # Prefer the conventional install path in the error message even if missing.
    return Path.home() / ".webclaw" / "bin" / "webclaw-lite"


__all__ = ["candidates", "resolve_lite_bin"]
