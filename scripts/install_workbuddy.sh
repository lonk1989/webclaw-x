#!/usr/bin/env bash
# End-user one-click install for WorkBuddy / Cursor (macOS arm64 / Linux x64).
# Compatible with macOS system bash 3.2 (no mapfile / process substitution).
#
#   curl -fsSL https://raw.githubusercontent.com/lonk1989/webclaw-x/main/scripts/install_workbuddy.sh | bash
#
# Env:
#   WEBCLAW_VERSION=0.2.3|latest
#   WEBCLAW_HOME=~/.webclaw
#   WEBCLAW_HOSTS=app.example.com,login.example.com
#   WEBCLAW_NO_MERGE=1
#   WEBCLAW_LITE_BASE=…   # optional CDN / mirror prefix
#   WEBCLAW_HOST_URL=…    # optional direct host zip URL
#   WEBCLAW_OSS_BASE=…    # default Aliyun OSS root for webclaw-x
set -euo pipefail

REPO="lonk1989/webclaw-x"
VERSION="${WEBCLAW_VERSION:-0.2.3}"
VER="${VERSION#v}"
if [ "$VER" = "latest" ]; then
  TAG="latest"
else
  TAG="v$VER"
fi

HOME_DIR="${WEBCLAW_HOME:-$HOME/.webclaw}"
BIN_DIR="$HOME_DIR/bin"
HOST_DIR="$HOME_DIR/host"
MCP_DIR="$HOME_DIR/mcp"
VENV="$HOST_DIR/.venv"
HOSTS="${WEBCLAW_HOSTS:-}"
NO_MERGE="${WEBCLAW_NO_MERGE:-0}"
DEFAULT_OSS_ROOT="${WEBCLAW_OSS_BASE:-https://feixingai-agent.oss-cn-beijing.aliyuncs.com/webclaw-x}"
DEFAULT_OSS_ROOT="${DEFAULT_OSS_ROOT%/}"

uname_s="$(uname -s)"
uname_m="$(uname -m)"
case "$uname_s-$uname_m" in
  Darwin-arm64)
    LITE_ASSET="webclaw-lite-macos-arm64"
    LITE_DEST="$BIN_DIR/webclaw-lite"
    ;;
  Linux-x86_64|Linux-amd64)
    LITE_ASSET="webclaw-lite-linux-x64"
    LITE_DEST="$BIN_DIR/webclaw-lite"
    ;;
  *)
    echo "[webclaw-x] unsupported platform: $uname_s $uname_m" >&2
    echo "  supported: macOS arm64, Linux x86_64. Windows: use install_workbuddy.ps1" >&2
    exit 2
    ;;
esac

step() { printf '[webclaw-x] %s\n' "$*"; }

official_release_dir() {
  if [ "$TAG" = "latest" ]; then
    echo "https://github.com/$REPO/releases/latest/download"
  else
    echo "https://github.com/$REPO/releases/download/$TAG"
  fi
}

oss_dir() {
  if [ "$TAG" != "latest" ]; then
    echo "$DEFAULT_OSS_ROOT/v$VER"
    return 0
  fi
  tmp="$HOST_DIR/_latest.json"
  if curl -fsSL --connect-timeout 10 --max-time 20 -o "$tmp" "$DEFAULT_OSS_ROOT/latest.json" 2>/dev/null; then
    base="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1],encoding="utf-8")).get("baseUrl") or "")' "$tmp" 2>/dev/null || true)"
    if [ -n "$base" ]; then
      echo "${base%/}"
      return 0
    fi
  fi
  echo "$DEFAULT_OSS_ROOT/v0.2.3"
}

# Try URL list; write to dest on first success.
download_first() {
  dest="$1"
  shift
  last=""
  for url in "$@"; do
    [ -n "$url" ] || continue
    step "download $url"
    if curl -fL --retry 2 --connect-timeout 15 --max-time 180 -o "$dest" "$url"; then
      if [ -s "$dest" ]; then return 0; fi
    fi
    last="$url"
    echo "[webclaw-x]   failed" >&2
  done
  echo "[webclaw-x] download failed → $dest (last=$last)" >&2
  return 1
}

# Build candidate URLs for lite / sha / host into a temp file (one URL per line).
write_lite_urls() {
  out="$1"
  asset="$2"
  : >"$out"
  official="$(official_release_dir)"
  oss="$(oss_dir)"
  if [ -n "${WEBCLAW_LITE_BASE:-}" ]; then
    echo "${WEBCLAW_LITE_BASE%/}/$asset" >>"$out"
  fi
  echo "${oss}/$asset" >>"$out"
  echo "${official}/$asset" >>"$out"
  for prefix in "https://ghfast.top/" "https://mirror.ghproxy.com/"; do
    echo "${prefix}${official}/$asset" >>"$out"
  done
}

write_host_urls() {
  out="$1"
  : >"$out"
  oss="$(oss_dir)"
  if [ -n "${WEBCLAW_HOST_URL:-}" ]; then
    echo "$WEBCLAW_HOST_URL" >>"$out"
  fi
  if [ "$TAG" = "latest" ]; then
    host_zip="https://github.com/$REPO/releases/latest/download/webclaw-x-host.zip"
    src_zip="https://github.com/$REPO/archive/refs/heads/main.zip"
  else
    host_zip="https://github.com/$REPO/releases/download/$TAG/webclaw-x-host.zip"
    src_zip="https://github.com/$REPO/archive/refs/tags/$TAG.zip"
  fi
  echo "${oss}/webclaw-x-host.zip" >>"$out"
  echo "$host_zip" >>"$out"
  for prefix in "https://ghfast.top/" "https://mirror.ghproxy.com/"; do
    echo "${prefix}${host_zip}" >>"$out"
    echo "${prefix}${src_zip}" >>"$out"
  done
  echo "$src_zip" >>"$out"
}

merge_mcp() {
  path="$1"
  py="$2"
  lite="$3"
  home="$4"
  mkdir -p "$(dirname "$path")"
  "$py" - "$path" "$py" "$lite" "$home" <<'PY'
import json, pathlib, sys
path, command, lite, home = map(pathlib.Path, sys.argv[1:5])
entry = {
    "command": str(command),
    "args": ["-m", "webclaw_x.server"],
    "env": {
        "WEBCLAW_LITE_BIN": str(lite),
        "WEBCLAW_HOME": str(home),
        "WEBCLAW_HEADLESS": "1",
        "WEBCLAW_TOOLS": "core",
        "WEBCLAW_STATUS_MODE": "fast",
    },
}
root = {"mcpServers": {}}
if path.exists():
    try:
        data = json.loads(path.read_text(encoding="utf-8") or "{}")
        if isinstance(data, dict) and isinstance(data.get("mcpServers"), dict):
            root["mcpServers"] = dict(data["mcpServers"])
    except Exception:
        bak = path.with_name(path.name + ".bak")
        bak.write_bytes(path.read_bytes())
root["mcpServers"]["webclaw-x"] = entry
path.write_text(json.dumps(root, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(path)
PY
}

mkdir -p "$BIN_DIR" "$HOST_DIR" "$MCP_DIR"
step "WEBCLAW_HOME=$HOME_DIR  version=$TAG  asset=$LITE_ASSET"

URL_FILE="$HOST_DIR/_urls.txt"
TMP_LITE="$BIN_DIR/${LITE_ASSET}.download"
write_lite_urls "$URL_FILE" "$LITE_ASSET"
# shellcheck disable=SC2046
download_first "$TMP_LITE" $(tr '\n' ' ' <"$URL_FILE")

TMP_SHA="$BIN_DIR/${LITE_ASSET}.sha256.download"
write_lite_urls "$URL_FILE" "${LITE_ASSET}.sha256"
if download_first "$TMP_SHA" $(tr '\n' ' ' <"$URL_FILE") 2>/dev/null; then
  expected="$(awk '{print tolower($1); exit}' "$TMP_SHA")"
  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$TMP_LITE" | awk '{print tolower($1)}')"
  else
    actual="$(shasum -a 256 "$TMP_LITE" | awk '{print tolower($1)}')"
  fi
  if [ -n "$expected" ] && [ "$expected" != "$actual" ]; then
    echo "[webclaw-x] SHA256 mismatch expected=$expected actual=$actual" >&2
    exit 1
  fi
  step "SHA256 ok"
fi
mv -f "$TMP_LITE" "$LITE_DEST"
chmod +x "$LITE_DEST"
"$LITE_DEST" install >/dev/null 2>&1 || true
"$LITE_DEST" status >/dev/null 2>&1 || true
if [ "$uname_s" = "Darwin" ]; then
  xattr -d com.apple.quarantine "$LITE_DEST" 2>/dev/null || true
fi
step "lite → $LITE_DEST"

ZIP_PATH="$HOST_DIR/host-src.zip"
write_host_urls "$URL_FILE"
download_first "$ZIP_PATH" $(tr '\n' ' ' <"$URL_FILE")
EXTRACT="$HOST_DIR/_extract"
rm -rf "$EXTRACT"
mkdir -p "$EXTRACT"
unzip -q "$ZIP_PATH" -d "$EXTRACT"

PKG_ROOT=""
if [ -f "$EXTRACT/webclaw_x/server.py" ]; then
  PKG_ROOT="$EXTRACT"
else
  for d in "$EXTRACT"/*; do
    if [ -f "$d/webclaw_x/server.py" ]; then PKG_ROOT="$d"; break; fi
  done
fi
if [ -z "$PKG_ROOT" ]; then
  echo "[webclaw-x] archive missing webclaw_x/" >&2
  exit 1
fi

STAGE="$HOST_DIR/pkg"
rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -R "$PKG_ROOT/webclaw_x" "$STAGE/"
for f in pyproject.toml requirements.txt README.md LICENSE; do
  if [ -f "$PKG_ROOT/$f" ]; then cp "$PKG_ROOT/$f" "$STAGE/"; fi
done
if [ ! -f "$STAGE/pyproject.toml" ]; then
  cat > "$STAGE/pyproject.toml" <<'EOF'
[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"
[project]
name = "webclaw-x"
version = "0.2.3"
requires-python = ">=3.10"
dependencies = ["mcp>=1.0,<2.0", "anyio>=4.0"]
[tool.setuptools.packages.find]
include = ["webclaw_x*"]
EOF
fi

PYTHON_BIN=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1; then
    if "$c" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)'; then
      PYTHON_BIN="$c"
      break
    fi
  fi
done
if [ -z "$PYTHON_BIN" ]; then
  echo "[webclaw-x] need Python 3.10+" >&2
  exit 1
fi

if [ ! -x "$VENV/bin/python" ]; then
  step "creating venv $VENV"
  "$PYTHON_BIN" -m venv "$VENV"
fi
"$VENV/bin/pip" install -U pip setuptools wheel >/dev/null
"$VENV/bin/pip" install -e "$STAGE" >/dev/null
PY="$VENV/bin/python"
step "MCP host installed"

rm -rf "$EXTRACT"
rm -f "$ZIP_PATH" "$URL_FILE" "$TMP_SHA"

python_json_escape() { "$PY" -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1"; }
PY_J=$(python_json_escape "$PY")
LITE_J=$(python_json_escape "$LITE_DEST")
HOME_J=$(python_json_escape "$HOME_DIR")
cat > "$MCP_DIR/workbuddy.mcp.json" <<JSON
{
  "mcpServers": {
    "webclaw-x": {
      "command": ${PY_J},
      "args": ["-m", "webclaw_x.server"],
      "env": {
        "WEBCLAW_LITE_BIN": ${LITE_J},
        "WEBCLAW_HOME": ${HOME_J},
        "WEBCLAW_HEADLESS": "1",
        "WEBCLAW_TOOLS": "core",
        "WEBCLAW_STATUS_MODE": "fast"
      }
    }
  }
}
JSON
cp "$MCP_DIR/workbuddy.mcp.json" "$MCP_DIR/cursor.mcp.json"

if [ "$NO_MERGE" != "1" ]; then
  merge_mcp "$HOME/.workbuddy/mcp.json" "$PY" "$LITE_DEST" "$HOME_DIR"
  merge_mcp "$HOME/.cursor/mcp.json" "$PY" "$LITE_DEST" "$HOME_DIR"
fi

POLICY_PATH="$HOME_DIR/policy.json"
if [ -n "$HOSTS" ]; then
  "$PY" -c "from webclaw_x.policy_draft import draft_policy; import json, pathlib; p=pathlib.Path(r'''$POLICY_PATH'''); p.write_text(json.dumps(draft_policy('''$HOSTS''', enabled=True), ensure_ascii=False, indent=2)+'\n', encoding='utf-8'); print(p)"
  step "policy ON with hosts → $POLICY_PATH"
else
  cat > "$POLICY_PATH" <<'EOF'
{
  "enabled": false,
  "allow_localhost": true,
  "allowed_hosts": []
}
EOF
  step "policy OFF → $POLICY_PATH"
fi

"$PY" -c "from webclaw_x.recipe_verbs_doc import write_recipe_verbs_doc; from pathlib import Path; print(write_recipe_verbs_doc(Path(r'''$HOME_DIR''')/'mcp'))" 2>/dev/null || true
"$PY" -c "from webclaw_x.host_vault_probe import maybe_probe_on_startup; r=maybe_probe_on_startup(webclaw_home=r'''$HOME_DIR''', lite_bin=r'''$LITE_DEST'''); print(r.as_dict() if r else 'skipped')" 2>/dev/null || true

echo
echo "安装完成。"
echo "  lite:  $LITE_DEST"
echo "  host:  $PY -m webclaw_x.server"
echo "  home:  $HOME_DIR"
echo "下一步：重启 WorkBuddy，确认 webclaw-x 绿灯；试「打开 https://example.com，等待2，采集」"
echo "说明：https://github.com/lonk1989/webclaw-x/blob/main/docs/workbuddy-quickstart.md"
echo "动词说明书：$HOME_DIR/mcp/RECIPE-VERBS.md"
echo "导航白名单默认关闭；需要时编辑 $POLICY_PATH"
echo "站点账号：写入 $HOME_DIR/host-exports/workbuddy.json（见 docs/host-vault-export.md）"
