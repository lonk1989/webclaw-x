# Install webclaw-lite Windows x64 from GitHub Releases (no cargo required).
# Env:
#   WEBCLAW_LITE_BASE  directory prefix (default: webclaw-x releases/latest/download)
#   WEBCLAW_WORKER_URL full .exe URL (wins over base)
#   WEBCLAW_HOME       data root (default %LOCALAPPDATA%\webclaw)
$ErrorActionPreference = "Stop"
$base = $env:WEBCLAW_LITE_BASE
$url = $env:WEBCLAW_WORKER_URL
if (-not $url) {
  if (-not $base) {
    $base = "https://github.com/lonk1989/webclaw-x/releases/latest/download"
  }
  $url = ($base.TrimEnd("/") + "/webclaw-lite-windows-x64.exe")
}
$homeDir = if ($env:WEBCLAW_HOME) { $env:WEBCLAW_HOME } else { Join-Path $env:LOCALAPPDATA "webclaw" }
$bin = Join-Path $homeDir "bin"
New-Item -ItemType Directory -Force -Path $bin | Out-Null
$dest = Join-Path $bin "webclaw-lite.exe"
Write-Host "[webclaw-lite] Downloading $url"
Write-Host "[webclaw-lite] -> $dest"
Invoke-WebRequest -Uri $url -OutFile $dest
# Optional checksum if sibling .sha256 is published next to the exe
$shaUrl = $url + ".sha256"
try {
  $tmpSha = Join-Path $bin "webclaw-lite.exe.sha256.download"
  Invoke-WebRequest -Uri $shaUrl -OutFile $tmpSha
  $expected = ((Get-Content -LiteralPath $tmpSha -Raw).Trim() -split "\s+")[0].ToLower()
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $dest).Hash.ToLower()
  if ($expected -and ($expected -ne $actual)) {
    throw "SHA256 mismatch for $dest`nexpected=$expected`nactual=$actual"
  }
  Write-Host "[webclaw-lite] SHA256 ok: $actual"
  Remove-Item -LiteralPath $tmpSha -Force -ErrorAction SilentlyContinue
} catch {
  if ($_.Exception.Message -match "SHA256 mismatch") { throw }
  Write-Host "[webclaw-lite] checksum file not verified ($($_.Exception.Message))"
}
& $dest install
& $dest status
Write-Host "[webclaw-lite] installed -> $dest"
Write-Host "[webclaw-lite] tip: set WEBCLAW_LITE_BIN=$dest in MCP env; default WEBCLAW_TOOLS=core"
Write-Host "[webclaw-lite] tip: default Host path is CLI; opt-in serve with WEBCLAW_LITE_USE_SERVE=1 after starting: webclaw-lite serve"
