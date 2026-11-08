#!/usr/bin/env bash
# Build webclaw-lite from the monorepo runtime/ and optionally install it.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="${HOME}/.cargo/bin:${PATH}"
cd "$ROOT"

INSTALL=1
PROFILE=release
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-install) INSTALL=0; shift ;;
    --debug) PROFILE=debug; shift ;;
    -h|--help)
      echo "Usage: $0 [--no-install] [--debug]"
      echo "  Builds -p webclaw --bin webclaw-lite from repo-root Cargo workspace."
      echo "  Default: copy target/\$PROFILE/webclaw-lite → ~/.webclaw/bin/webclaw-lite"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

echo "[build_runtime] cargo build --${PROFILE} -p webclaw --bin webclaw-lite"
cargo build --"${PROFILE}" -p webclaw --bin webclaw-lite

BIN="${ROOT}/target/${PROFILE}/webclaw-lite"
test -x "$BIN"
echo "[build_runtime] ok: $BIN"

if [[ "$INSTALL" -eq 1 ]]; then
  DEST="${HOME}/.webclaw/bin/webclaw-lite"
  mkdir -p "$(dirname "$DEST")"
  cp -a "$BIN" "$DEST"
  echo "[build_runtime] installed: $DEST"
  # Keep repo-root compat symlink if present or recreate
  ln -sfn "$DEST" "${ROOT}/bin-webclaw-lite"
  echo "[build_runtime] symlink: ${ROOT}/bin-webclaw-lite -> $DEST"
fi
