#!/usr/bin/env bash
# webclaw-x 终端用户安装（默认：预编译 lite，不走 cargo）
# 用法：
#   ./scripts/install_webclaw.sh [--repo /path/to/webclaw-x] [--skip-download] [--hosts a.com,b.com]
#   WEBCLAW_LITE_BASE=… WEBCLAW_HOME=… ./scripts/install_webclaw.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SKIP_DOWNLOAD=0
HOSTS=""
WRITE_MCP=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO="$(cd "$2" && pwd)"; shift 2 ;;
    --skip-download) SKIP_DOWNLOAD=1; shift ;;
    --hosts) HOSTS="$2"; shift 2 ;;
    --no-mcp) WRITE_MCP=0; shift ;;
    -h|--help)
      cat <<'H'
Usage: install_webclaw.sh [--repo DIR] [--skip-download] [--hosts h1,h2] [--no-mcp]

Default path for end users:
  1) Download precompiled webclaw-lite (~61MB) into $WEBCLAW_HOME/bin
  2) Ensure Python venv + mcp
  3) Write mcp.json fragments under $WEBCLAW_HOME/mcp/
  4) Optional: draft policy.json.draft from --hosts (never auto-opens the world)

Developer-only (edit engine source): ./scripts/build_runtime.sh  → large target/
H
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

HOME_DIR="${WEBCLAW_HOME:-$HOME/.webclaw}"
BIN_DIR="$HOME_DIR/bin"
MCP_DIR="$HOME_DIR/mcp"
mkdir -p "$BIN_DIR" "$HOME_DIR/runs" "$HOME_DIR/recipes" "$HOME_DIR/jobs" "$MCP_DIR"

echo "[install] WEBCLAW_HOME=$HOME_DIR"
echo "[install] repo=$REPO"

# --- 1) lite binary (precompiled default) ---
DEST="$BIN_DIR/webclaw-lite"
if [[ "$SKIP_DOWNLOAD" -eq 1 ]]; then
  if [[ -x "$DEST" ]]; then
    echo "[install] skip download; using $DEST"
  elif [[ -x "$REPO/target/release/webclaw-lite" ]]; then
    cp -a "$REPO/target/release/webclaw-lite" "$DEST"
    echo "[install] copied local release build → $DEST"
  elif [[ -x "$REPO/bin-webclaw-lite" ]]; then
    cp -a "$(readlink -f "$REPO/bin-webclaw-lite" 2>/dev/null || echo "$REPO/bin-webclaw-lite")" "$DEST" 2>/dev/null \
      || cp -a "$REPO/bin-webclaw-lite" "$DEST"
    echo "[install] copied bin-webclaw-lite → $DEST"
  else
    echo "[install] ERROR: --skip-download but no lite binary found" >&2
    exit 2
  fi
else
  LITE_INSTALL="$REPO/skills/webclaw-lite/scripts/install.sh"
  if [[ -x "$LITE_INSTALL" ]]; then
    WEBCLAW_HOME="$HOME_DIR" bash "$LITE_INSTALL"
  else
    echo "[install] ERROR: missing $LITE_INSTALL" >&2
    exit 2
  fi
fi
chmod +x "$DEST" 2>/dev/null || true
export WEBCLAW_HOME="$HOME_DIR"
export WEBCLAW_LITE_BIN="$DEST"

# --- 2) Python venv ---
VENV="$REPO/.venv"
if [[ ! -x "$VENV/bin/python" ]]; then
  echo "[install] creating venv at $VENV"
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -U pip
  if [[ -f "$REPO/requirements.txt" ]]; then
    "$VENV/bin/pip" install -r "$REPO/requirements.txt"
  else
    "$VENV/bin/pip" install mcp pytest
  fi
else
  echo "[install] reusing venv $VENV"
  "$VENV/bin/pip" install -q mcp pytest 2>/dev/null || true
fi
PY="$VENV/bin/python"

# --- 3) lite install marker + status ---
"$DEST" install || true
"$DEST" status || true

# --- 4) mcp.json fragments ---
if [[ "$WRITE_MCP" -eq 1 ]]; then
  # Escape paths for JSON (minimal)
  json_escape() { printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'; }
  PY_J=$(json_escape "$PY")
  REPO_J=$(json_escape "$REPO")
  DEST_J=$(json_escape "$DEST")
  HOME_J=$(json_escape "$HOME_DIR")

  cat > "$MCP_DIR/cursor.mcp.json" <<JSON
{
  "mcpServers": {
    "webclaw-x": {
      "command": ${PY_J},
      "args": ["-m", "webclaw_x.server"],
      "env": {
        "PYTHONPATH": ${REPO_J},
        "WEBCLAW_LITE_BIN": ${DEST_J},
        "WEBCLAW_HOME": ${HOME_J},
        "WEBCLAW_HEADLESS": "1",
        "WEBCLAW_TOOLS": "core",
        "WEBCLAW_STATUS_MODE": "fast"
      }
    }
  }
}
JSON

  cat > "$MCP_DIR/workbuddy.mcp.json" <<JSON
{
  "mcpServers": {
    "webclaw-x": {
      "command": ${PY_J},
      "args": ["-m", "webclaw_x.server"],
      "env": {
        "PYTHONPATH": ${REPO_J},
        "WEBCLAW_LITE_BIN": ${DEST_J},
        "WEBCLAW_HOME": ${HOME_J},
        "WEBCLAW_HEADLESS": "1",
        "WEBCLAW_TOOLS": "core",
        "WEBCLAW_STATUS_MODE": "fast"
      }
    }
  }
}
JSON

  cat > "$MCP_DIR/README.txt" <<TXT
Copy one fragment into your Host MCP config, then reconnect / trust tools.

  Cursor:    merge $MCP_DIR/cursor.mcp.json into project or user mcp.json
  WorkBuddy: copy to ~/.workbuddy/mcp.json (or project .workbuddy/mcp.json)

Default WEBCLAW_TOOLS=core exposes ~7 tools. Set "WEBCLAW_TOOLS": "all" for the full set.
Keep the MCP stdio session resident — do not respawn per tool call.
Read RECIPE-VERBS.md: 打开/点击/采集 are recipe verbs → webclaw_run once.
macOS Gatekeeper: xattr -d com.apple.quarantine "$DEST"
TXT
  "$PY" -c "from webclaw_x.recipe_verbs_doc import write_recipe_verbs_doc; from pathlib import Path; print(write_recipe_verbs_doc(Path(r'''$MCP_DIR''')))" 2>/dev/null \
    || PYTHONPATH="$REPO${PYTHONPATH:+:$PYTHONPATH}" "$PY" -c "from webclaw_x.recipe_verbs_doc import write_recipe_verbs_doc; from pathlib import Path; print(write_recipe_verbs_doc(Path(r'''$MCP_DIR''')))" 2>/dev/null \
    || true
  echo "[install] wrote MCP fragments → $MCP_DIR/"
fi

# --- 5) navigation policy (default OFF) ---
POLICY_PATH="$HOME_DIR/policy.json"
if [[ -n "$HOSTS" ]]; then
  "$PY" "$REPO/scripts/policy_draft.py" --hosts "$HOSTS" --out "$POLICY_PATH"
  # policy_draft writes enabled:true — intentional opt-in allowlist when --hosts given
  echo "[install] policy ON with hosts → $POLICY_PATH"
else
  cat > "$POLICY_PATH" <<'EOF'
{
  "enabled": false,
  "allow_localhost": true,
  "allowed_hosts": []
}
EOF
  echo "[install] policy OFF → $POLICY_PATH"
fi

echo
echo "[install] done."
echo "  lite:  $DEST"
echo "  python:$PY"
echo "  verbs: $MCP_DIR/RECIPE-VERBS.md"
echo "  next:  copy $MCP_DIR/*.mcp.json → Host, reconnect; try「打开 https://example.com，等待2，采集」"
echo "  cargo: only if you edit runtime/ — ./scripts/build_runtime.sh (creates large target/)"
