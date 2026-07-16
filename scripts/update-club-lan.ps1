# ═══════ DartsZentrale — Update (club mode LAN, single binary, Windows) ═══════
# Replaces the frontend in pb_public\ from the update package (dartszentrale-update-*.tar.gz).
# No Node, no restart — PocketBase serves the new files immediately. pb_data\ stays.
#   .\update-club-lan.ps1                      # newest package in updates\
#   .\update-club-lan.ps1 -Source C:\path.tar.gz   # a specific package
#   .\update-club-lan.ps1 -Source E:\          # folder (e.g. USB stick) containing the package
param([string]$Source)
$ErrorActionPreference = 'Stop'
$ROOT = $PSScriptRoot
$PUB  = Join-Path $ROOT 'pb_public'
if (-not $Source) { $Source = Join-Path $ROOT 'updates' }
# Use the system tar (bsdtar) explicitly — not a possible MSYS/GNU tar on the PATH.
$sysroot = if ($env:SystemRoot) { $env:SystemRoot } else { 'C:\Windows' }
$TAR = Join-Path $sysroot 'System32\tar.exe'

if (-not (Test-Path $PUB)) { Write-Host "x pb_public\ missing — is this the DartsZentrale folder? Run start-club-lan.bat first."; exit 1 }

# Determine the package (folder → newest package inside; otherwise the file directly)
if (Test-Path $Source -PathType Container) {
  $PKG = Get-ChildItem -Path $Source -Filter 'dartszentrale-update-*.tar.gz' -File -ErrorAction SilentlyContinue |
         Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
} else { $PKG = $Source }
if (-not $PKG -or -not (Test-Path $PKG)) { Write-Host "x No update package (dartszentrale-update-*.tar.gz) found in/under: $Source"; exit 1 }
Write-Host "* Update package: $(Split-Path $PKG -Leaf)"

$TMP = Join-Path ([System.IO.Path]::GetTempPath()) ("dz-upd-" + [System.IO.Path]::GetRandomFileName())
$NEW = Join-Path $TMP 'new'
New-Item -ItemType Directory -Path $NEW -Force | Out-Null
try {
  & $TAR -xzf "$PKG" -C "$NEW"
  if (-not (Test-Path (Join-Path $NEW 'index.html'))) { Write-Host "x Package contains no index.html at the root — wrong package?"; exit 1 }
  $BK = Join-Path $ROOT 'backup'; New-Item -ItemType Directory -Path $BK -Force | Out-Null
  $STAMP = Get-Date -Format 'yyyyMMdd-HHmmss'
  Move-Item -Path $PUB -Destination (Join-Path $BK "pb_public-$STAMP")
  Move-Item -Path $NEW -Destination $PUB
  Write-Host "  + pb_public\ updated (old frontend backed up: backup\pb_public-$STAMP)"
  Write-Host "  Reloading in the browser is enough — no restart needed."
} finally { Remove-Item -Path $TMP -Recurse -Force -ErrorAction SilentlyContinue }
