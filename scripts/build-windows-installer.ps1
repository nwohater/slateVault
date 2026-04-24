$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$SrcTauriDir = Join-Path $RootDir "src-tauri"
$Target = if ($env:TARGET) { $env:TARGET } else { "x86_64-pc-windows-msvc" }
$TargetDir = Join-Path $SrcTauriDir "target\release"
$SigningKeyPath = if ($env:TAURI_SIGNING_PRIVATE_KEY_PATH) {
  $env:TAURI_SIGNING_PRIVATE_KEY_PATH
} else {
  "C:\Users\brand\.tauri\slatevault.key"
}

if ($Target -ne "x86_64-pc-windows-msvc") {
  $TargetDir = Join-Path $SrcTauriDir "target\$Target\release"
}

$McpBinary = Join-Path $TargetDir "slatevault-mcp.exe"
$SidecarDir = Join-Path $SrcTauriDir "binaries"
$SidecarBinary = Join-Path $SidecarDir "slatevault-mcp-$Target.exe"
$InstallerDir = Join-Path $SrcTauriDir "target\release\bundle\nsis"

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

if ($args -contains "--help" -or $args -contains "-h") {
  @"
Build a Windows NSIS installer for slateVault.

Environment:
  TARGET                         Rust target triple. Defaults to x86_64-pc-windows-msvc.
  SKIP_TAURI_BUILD               Set to 1 to only build/copy the MCP sidecar.
  TAURI_SIGNING_PRIVATE_KEY_PATH Path to updater private key. Defaults to C:\Users\brand\.tauri\slatevault.key.
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD Required if the updater private key is password protected.

Examples:
  powershell -ExecutionPolicy Bypass -File scripts/build-windows-installer.ps1
  npm run build:windows-installer
"@ | Write-Host
  exit 0
}

Require-Command cargo
Require-Command npm.cmd

Write-Host "==> Stopping running slatevault-mcp processes"
Get-Process slatevault-mcp -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "==> Building slatevault-mcp for $Target"
$CargoArgs = @("build", "--manifest-path", (Join-Path $SrcTauriDir "Cargo.toml"), "--release", "-p", "slatevault-mcp")
if ($Target -ne "x86_64-pc-windows-msvc") {
  $CargoArgs += @("--target", $Target)
}
& cargo @CargoArgs

if (-not (Test-Path $McpBinary)) {
  throw "Expected MCP binary was not built: $McpBinary"
}

Write-Host "==> Updating Tauri sidecar binary"
New-Item -ItemType Directory -Force $SidecarDir | Out-Null
Copy-Item -Force $McpBinary $SidecarBinary

if ($env:SKIP_TAURI_BUILD -eq "1") {
  Write-Host "==> Skipping Tauri build because SKIP_TAURI_BUILD=1"
  exit 0
}

if (-not (Test-Path $SigningKeyPath)) {
  throw "Updater signing key not found: $SigningKeyPath"
}

if (-not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
  throw "TAURI_SIGNING_PRIVATE_KEY_PASSWORD is required to build signed updater artifacts."
}

$env:TAURI_SIGNING_PRIVATE_KEY_PATH = $SigningKeyPath

Write-Host "==> Building Tauri NSIS installer with updater artifacts"
Push-Location $RootDir
try {
  if ($Target -ne "x86_64-pc-windows-msvc") {
    & npm.cmd run tauri build -- --target $Target
  } else {
    & npm.cmd run tauri build
  }
} finally {
  Pop-Location
}

$Installer = Get-ChildItem -Path $InstallerDir -Filter "*setup.exe" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $Installer) {
  throw "Expected NSIS installer was not found in: $InstallerDir"
}

$Signature = Get-ChildItem -Path $InstallerDir -Filter "*.sig" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

$LatestJson = Get-ChildItem -Path $InstallerDir -Filter "latest.json" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

Write-Host ""
Write-Host "Built installer:"
Write-Host "  $($Installer.FullName)"
if ($Signature) {
  Write-Host "Updater signature:"
  Write-Host "  $($Signature.FullName)"
}
if ($LatestJson) {
  Write-Host "Updater manifest:"
  Write-Host "  $($LatestJson.FullName)"
}
Write-Host ""
Write-Host "Installer behavior:"
Write-Host "  Installs slateVault app"
Write-Host "  Installs bundled slatevault-mcp sidecar"
Write-Host "  Creates slatevault-mcp.exe alias in install directory"
Write-Host "  Adds install directory to current user's PATH"
Write-Host "  Produces signed updater artifacts for GitHub Releases"
