# Write a Cursor/WorkBuddy-style mcp.json fragment for Windows CLI Host.
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File skills/webclaw-lite/scripts/write_mcp_fragment.ps1
# Optional env: WEBCLAW_HOME, WEBCLAW_LITE_BIN, WEBCLAW_REPO
$ErrorActionPreference = "Stop"
$repo = if ($env:WEBCLAW_REPO) { $env:WEBCLAW_REPO } else { (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path }
$homeDir = if ($env:WEBCLAW_HOME) { $env:WEBCLAW_HOME } else { Join-Path $env:LOCALAPPDATA "webclaw" }
$lite = if ($env:WEBCLAW_LITE_BIN) { $env:WEBCLAW_LITE_BIN } else { Join-Path $homeDir "bin\webclaw-lite.exe" }
$py = Join-Path $repo ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
  Write-Host "[mcp] creating venv at $repo\.venv"
  python -m venv (Join-Path $repo ".venv")
  & (Join-Path $repo ".venv\Scripts\pip.exe") install -r (Join-Path $repo "requirements.txt")
}
$mcpDir = Join-Path $homeDir "mcp"
New-Item -ItemType Directory -Force -Path $mcpDir | Out-Null
$fragment = [ordered]@{
  mcpServers = [ordered]@{
    "webclaw-x" = [ordered]@{
      command = $py
      args = @("-m", "webclaw_x.server")
      env = [ordered]@{
        PYTHONPATH = $repo
        WEBCLAW_LITE_BIN = $lite
        WEBCLAW_HOME = $homeDir
        WEBCLAW_HEADLESS = "0"
        WEBCLAW_TOOLS = "core"
        WEBCLAW_STATUS_MODE = "fast"
      }
    }
  }
}
$out = Join-Path $mcpDir "cursor.mcp.json"
$json = $fragment | ConvertTo-Json -Depth 8
# PowerShell ConvertTo-Json is fine for this shape
Set-Content -LiteralPath $out -Value $json -Encoding UTF8
Copy-Item $out (Join-Path $mcpDir "workbuddy.mcp.json") -Force
Set-Content -LiteralPath (Join-Path $mcpDir "README.txt") -Value @"
Merge cursor.mcp.json into your Host mcp.json, reconnect, and trust tools.
Default WEBCLAW_TOOLS=core (~7 tools). Set WEBCLAW_TOOLS=all for the full catalog.
Keep the MCP stdio session resident — do not respawn per tool call.
Default path: Host launches lite via CLI subprocess (stable).
Opt-in persistent serve (Windows TCP endpoint or Unix socket):
  1) start: webclaw-lite serve
  2) set WEBCLAW_LITE_USE_SERVE=1 (and optional WEBCLAW_LITE_SOCKET) in mcp env
  3) unreachable serve => Host falls back to CLI once (no double-run)
  4) unset / 0 to disable. quit serve or kill process to stop.
Cross-process cancel/job lock is best-effort on Windows compared with POSIX.
"@ -Encoding UTF8
Write-Host "[mcp] wrote $out"
Write-Host "[mcp] lite=$lite"
Write-Host "[mcp] python=$py"
