#Requires -Version 5.1
<#
.SYNOPSIS
  End-user one-click install for WorkBuddy / Cursor (Windows x64).

.DESCRIPTION
  No developer checkout required. Downloads webclaw-lite + MCP host into
  %LOCALAPPDATA%\webclaw, creates a venv, writes MCP fragments, and merges
  into WorkBuddy (~/.workbuddy/mcp.json) and Cursor (~/.cursor/mcp.json).

  Internet users (recommended):
    irm https://raw.githubusercontent.com/lonk1989/webclaw-x/main/scripts/install_workbuddy.ps1 | iex

  Default download source (CN): Aliyun OSS
    https://feixingai-agent.oss-cn-beijing.aliyuncs.com/webclaw-x/v{version}/
  Fallback: GitHub Releases (then optional ghfast mirrors).

  Optional env / params:
    WEBCLAW_VERSION / -Version   tag without v (default 0.2.3; "latest" allowed)
    WEBCLAW_HOME                 install root (default %LOCALAPPDATA%\webclaw)
    WEBCLAW_HOSTS / -Hosts       draft policy hosts (comma-separated)
    WEBCLAW_NO_MERGE=1 / -NoMerge  skip writing WorkBuddy/Cursor mcp.json
    WEBCLAW_LITE_BASE / WEBCLAW_HOST_URL  override CDN URLs
    WEBCLAW_OSS_BASE             override OSS root (default feixingai-agent …/webclaw-x)
#>
[CmdletBinding()]
param(
  [string]$Version = $(if ($env:WEBCLAW_VERSION) { $env:WEBCLAW_VERSION } else { "0.2.3" }),
  [string]$Hosts = $(if ($env:WEBCLAW_HOSTS) { $env:WEBCLAW_HOSTS } else { "" }),
  [switch]$NoMerge = ($env:WEBCLAW_NO_MERGE -eq "1")
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Repo = "lonk1989/webclaw-x"
$Ver = $Version.TrimStart('v')
$Tag = if ($Ver -eq "latest") { "latest" } else { "v$Ver" }
$HomeDir = if ($env:WEBCLAW_HOME) { $env:WEBCLAW_HOME } else { Join-Path $env:LOCALAPPDATA "webclaw" }
$BinDir = Join-Path $HomeDir "bin"
$HostDir = Join-Path $HomeDir "host"
$McpDir = Join-Path $HomeDir "mcp"
$VenvDir = Join-Path $HostDir ".venv"
$LiteName = "webclaw-lite-windows-x64.exe"
$LiteDest = Join-Path $BinDir "webclaw-lite.exe"
$DefaultOssRoot = if ($env:WEBCLAW_OSS_BASE) {
  $env:WEBCLAW_OSS_BASE.TrimEnd("/")
} else {
  "https://feixingai-agent.oss-cn-beijing.aliyuncs.com/webclaw-x"
}

function Write-Step([string]$msg) { Write-Host "[webclaw-x] $msg" -ForegroundColor Cyan }

function Get-OssDir {
  if ($Tag -ne "latest") { return "$DefaultOssRoot/v$Ver" }
  try {
    $tmp = Join-Path $env:TEMP "webclaw-x-latest.json"
    curl.exe -fsSL --connect-timeout 10 --max-time 20 -o $tmp "$DefaultOssRoot/latest.json" | Out-Null
    if ($LASTEXITCODE -eq 0 -and (Test-Path $tmp)) {
      $j = Get-Content $tmp -Raw | ConvertFrom-Json
      if ($j.baseUrl) { return ([string]$j.baseUrl).TrimEnd("/") }
      if ($j.version) { return "$DefaultOssRoot/v$([string]$j.version.TrimStart('v'))" }
    }
  } catch { }
  return "$DefaultOssRoot/v0.2.3"
}

function Get-ReleaseDirUrls {
  $official = if ($Tag -eq "latest") {
    "https://github.com/$Repo/releases/latest/download"
  } else {
    "https://github.com/$Repo/releases/download/$Tag"
  }
  $out = New-Object System.Collections.Generic.List[string]
  if ($env:WEBCLAW_LITE_BASE) {
    $out.Add($env:WEBCLAW_LITE_BASE.TrimEnd("/"))
  }
  # 1) Aliyun OSS (stable for CN)  2) GitHub  3) optional mirrors
  $out.Add((Get-OssDir))
  $out.Add($official)
  foreach ($p in @("https://ghfast.top/", "https://mirror.ghproxy.com/")) {
    $out.Add(($p + $official))
  }
  return $out | Select-Object -Unique
}

function Get-SourceZipUrls {
  $official = "https://github.com/$Repo/archive/refs/heads/main.zip"
  if ($Tag -ne "latest") {
    $official = "https://github.com/$Repo/archive/refs/tags/$Tag.zip"
  }
  $hostOfficial = if ($Tag -eq "latest") {
    "https://github.com/$Repo/releases/latest/download/webclaw-x-host.zip"
  } else {
    "https://github.com/$Repo/releases/download/$Tag/webclaw-x-host.zip"
  }
  $hostOss = "$(Get-OssDir)/webclaw-x-host.zip"
  $out = New-Object System.Collections.Generic.List[string]
  if ($env:WEBCLAW_HOST_URL) { $out.Add($env:WEBCLAW_HOST_URL) }
  $out.Add($hostOss)
  $out.Add($hostOfficial)
  foreach ($p in @("https://ghfast.top/", "https://mirror.ghproxy.com/")) {
    $out.Add($p + $hostOfficial)
    $out.Add($p + $official)
  }
  $out.Add($official)
  return $out | Select-Object -Unique
}

function Download-FirstOk([string[]]$urls, [string]$dest) {
  $last = $null
  # Prefer Aliyun OSS, then everything else in listed order.
  $ordered = @($urls | Where-Object { $_ -match 'aliyuncs\.com' }) `
    + @($urls | Where-Object { $_ -notmatch 'aliyuncs\.com' })
  $ordered = $ordered | Where-Object { $_ } | Select-Object -Unique
  foreach ($u in $ordered) {
    try {
      Write-Step "download $u"
      curl.exe -fL --connect-timeout 15 --max-time 180 --retry 2 -o $dest $u
      if ($LASTEXITCODE -ne 0) { throw "curl exit $LASTEXITCODE" }
      if ((Get-Item $dest).Length -gt 0) { return $u }
    } catch {
      $last = $_
      Write-Host "[webclaw-x]   failed: $($_.Exception.Message)" -ForegroundColor DarkYellow
      Remove-Item $dest -Force -ErrorAction SilentlyContinue
    }
  }
  throw "download failed for $dest : $last"
}

function Resolve-PythonExe {
  $candidates = @()
  try {
    $pyLauncher = & py -3 -c "import sys; print(sys.executable)" 2>$null
    if ($LASTEXITCODE -eq 0 -and $pyLauncher) { $candidates += $pyLauncher.Trim() }
  } catch { }
  foreach ($name in @("python", "python3")) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) { $candidates += $cmd.Source }
  }
  foreach ($exe in ($candidates | Select-Object -Unique)) {
    try {
      $ver = & $exe -c "import sys; print('%d.%d'%sys.version_info[:2])"
      if ($ver -match '^3\.(\d+)$' -and [int]$Matches[1] -ge 10) { return $exe }
    } catch { }
  }
  throw "需要 Python 3.10+。请先安装 https://www.python.org/downloads/ 并勾选 Add to PATH，然后重跑本脚本。"
}

function Merge-McpJson([string]$path, [hashtable]$serverEntry) {
  $dir = Split-Path $path -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $root = @{ mcpServers = @{} }
  if (Test-Path $path) {
    try {
      $raw = Get-Content -LiteralPath $path -Raw -Encoding UTF8
      if ($raw.Trim()) {
        $parsed = $raw | ConvertFrom-Json
        if ($parsed.mcpServers) {
          $map = @{}
          foreach ($p in $parsed.mcpServers.PSObject.Properties) {
            $map[$p.Name] = $p.Value
          }
          $root.mcpServers = $map
        }
      }
    } catch {
      Write-Host "[webclaw-x] warn: could not parse $path, backing up" -ForegroundColor DarkYellow
      Copy-Item $path "$path.bak-$(Get-Date -Format yyyyMMddHHmmss)" -Force
    }
  }
  $root.mcpServers["webclaw-x"] = $serverEntry
  $json = $root | ConvertTo-Json -Depth 10
  Set-Content -LiteralPath $path -Value $json -Encoding UTF8
  Write-Step "merged MCP → $path"
}

# --- layout ---
New-Item -ItemType Directory -Force -Path $BinDir, $HostDir, $McpDir | Out-Null
Write-Step "WEBCLAW_HOME=$HomeDir  version=$Tag"

# --- 1) lite binary ---
$liteTmp = Join-Path $BinDir "$LiteName.download"
$liteBases = @(Get-ReleaseDirUrls)
$liteUrls = $liteBases | ForEach-Object { "$_/$LiteName" }
Download-FirstOk $liteUrls $liteTmp | Out-Null

# checksum (best-effort)
$shaTmp = Join-Path $BinDir "$LiteName.sha256.download"
try {
  $shaUrls = $liteBases | ForEach-Object { "$_/$LiteName.sha256" }
  Download-FirstOk $shaUrls $shaTmp | Out-Null
  $expected = ((Get-Content -LiteralPath $shaTmp -Raw).Trim() -split "\s+")[0].ToLower()
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $liteTmp).Hash.ToLower()
  if ($expected -and $expected -ne $actual) {
    throw "SHA256 mismatch for lite`nexpected=$expected`nactual=$actual"
  }
  Write-Step "SHA256 ok"
} catch {
  if ($_.Exception.Message -match "SHA256 mismatch") { throw }
  Write-Host "[webclaw-x] checksum skipped: $($_.Exception.Message)" -ForegroundColor DarkYellow
} finally {
  Remove-Item $shaTmp -Force -ErrorAction SilentlyContinue
}
Move-Item -Force $liteTmp $LiteDest
& $LiteDest install | Out-Null
try { & $LiteDest status | Out-Null } catch { }
Write-Step "lite → $LiteDest"

# --- 2) MCP host (Python package) ---
$zipPath = Join-Path $HostDir "host-src.zip"
$extractRoot = Join-Path $HostDir "_extract"
if (Test-Path $extractRoot) { Remove-Item $extractRoot -Recurse -Force }
New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null
Download-FirstOk @(Get-SourceZipUrls) $zipPath | Out-Null
Expand-Archive -LiteralPath $zipPath -DestinationPath $extractRoot -Force

# Locate package root (host zip flat, or github archive webclaw-x-*/ )
$pkgRoot = $null
$candidateRoots = New-Object System.Collections.Generic.List[string]
$candidateRoots.Add($extractRoot)
Get-ChildItem $extractRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object {
  $candidateRoots.Add($_.FullName)
}
foreach ($root in $candidateRoots) {
  if (Test-Path (Join-Path $root "webclaw_x\server.py")) { $pkgRoot = $root; break }
}
if (-not $pkgRoot) { throw "downloaded archive missing webclaw_x/ (not a host package)" }

# Stage clean host tree
$stage = Join-Path $HostDir "pkg"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null
Copy-Item (Join-Path $pkgRoot "webclaw_x") (Join-Path $stage "webclaw_x") -Recurse -Force
foreach ($f in @("pyproject.toml", "requirements.txt", "README.md", "LICENSE")) {
  $src = Join-Path $pkgRoot $f
  if (Test-Path $src) { Copy-Item $src (Join-Path $stage $f) -Force }
}
if (-not (Test-Path (Join-Path $stage "pyproject.toml"))) {
  @"
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
"@ | Set-Content (Join-Path $stage "pyproject.toml") -Encoding UTF8
}

$pyExe = Resolve-PythonExe
Write-Step "python: $pyExe"
if (-not (Test-Path (Join-Path $VenvDir "Scripts\python.exe"))) {
  Write-Step "creating venv $VenvDir"
  & $pyExe -m venv $VenvDir
  if ($LASTEXITCODE -ne 0) { throw "venv create failed" }
}
$Py = Join-Path $VenvDir "Scripts\python.exe"
$Pip = Join-Path $VenvDir "Scripts\pip.exe"
& $Pip install -U pip setuptools wheel | Out-Null
& $Pip install -e $stage | Out-Null
Write-Step "MCP host installed into venv"

# cleanup extract
Remove-Item $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $zipPath -Force -ErrorAction SilentlyContinue

# --- 3) MCP fragments ---
$serverEntry = [ordered]@{
  command = $Py
  args = @("-m", "webclaw_x.server")
  env = [ordered]@{
    WEBCLAW_LITE_BIN = $LiteDest
    WEBCLAW_HOME = $HomeDir
    WEBCLAW_HEADLESS = "1"
    WEBCLAW_TOOLS = "core"
    WEBCLAW_STATUS_MODE = "fast"
  }
}
$fragment = [ordered]@{ mcpServers = [ordered]@{ "webclaw-x" = $serverEntry } }
$fragJson = $fragment | ConvertTo-Json -Depth 10
Set-Content (Join-Path $McpDir "workbuddy.mcp.json") $fragJson -Encoding UTF8
Set-Content (Join-Path $McpDir "cursor.mcp.json") $fragJson -Encoding UTF8
Set-Content (Join-Path $McpDir "README.txt") @"
webclaw-x MCP fragments (auto-generated).

WorkBuddy: usually already merged into %USERPROFILE%\.workbuddy\mcp.json
Cursor:    usually already merged into %USERPROFILE%\.cursor\mcp.json

Reconnect the Host and trust tools. Default WEBCLAW_TOOLS=core (~7 tools).
Chrome must be installed. Optional policy: rename policy.json.draft → policy.json
"@ -Encoding UTF8

if (-not $NoMerge) {
  Merge-McpJson (Join-Path $env:USERPROFILE ".workbuddy\mcp.json") $serverEntry
  Merge-McpJson (Join-Path $env:USERPROFILE ".cursor\mcp.json") $serverEntry
}

# --- 4) navigation policy (default OFF for public installs) ---
$policyPath = Join-Path $HomeDir "policy.json"
if ($Hosts) {
  & $Py -c @"
from webclaw_x.policy_draft import draft_policy
import json, pathlib
path = pathlib.Path(r'''$policyPath''')
path.write_text(json.dumps(draft_policy('''$Hosts''', enabled=True), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(path)
"@
  Write-Step "policy ON with hosts → $policyPath"
} else {
  # Only schema fields — lite uses deny_unknown_fields; a stray `_comment` becomes POLICY_DENIED: invalid policy.json
  $policyOff = @{ enabled = $false; allow_localhost = $true; allowed_hosts = @() }
  ($policyOff | ConvertTo-Json -Depth 5) + "`n" | Set-Content -LiteralPath $policyPath -Encoding UTF8
  Write-Step "policy OFF → $policyPath"
}

# --- 5) verb cookbook + quiet Host-vault probe ---
try {
  & $Py -c "from webclaw_x.recipe_verbs_doc import write_recipe_verbs_doc; from pathlib import Path; print(write_recipe_verbs_doc(Path(r'''$HomeDir''')/'mcp'))"
  & $Py -c "from webclaw_x.host_vault_probe import maybe_probe_on_startup; r=maybe_probe_on_startup(webclaw_home=r'''$HomeDir''', lite_bin=r'''$LiteDest'''); print(r.as_dict() if r else 'skipped')"
} catch {
  Write-Host "[webclaw-x] post-install helper skipped: $($_.Exception.Message)" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "安装完成。" -ForegroundColor Green
Write-Host "  lite:  $LiteDest"
Write-Host "  host:  $Py -m webclaw_x.server"
Write-Host "  home:  $HomeDir"
Write-Host "下一步："
Write-Host "  1) 打开 WorkBuddy → 插件/MCP，确认 webclaw-x 绿灯（或重启 WorkBuddy）"
Write-Host "  2) 对话试：打开 https://example.com，等待2，采集（或「用 webclaw 查一下 status」）"
Write-Host "  3) 用户说明：https://github.com/lonk1989/webclaw-x/blob/main/docs/workbuddy-quickstart.md · 动词表 docs/recipe-verbs.md"
Write-Host "  导航白名单默认关闭；需要时写 $HomeDir\policy.json 设 enabled:true + allowed_hosts"
Write-Host "  站点账号：写入 $HomeDir\host-exports\workbuddy.json（见 docs/host-vault-export.md）"
Write-Host "  动词说明书：$HomeDir\mcp\RECIPE-VERBS.md（打开/点击/采集 → webclaw_run）"
