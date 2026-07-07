# ═══════ DartsZentrale — Update (Vereinsmodus LAN, Single-Binary, Windows) ═══════
# Tauscht das Frontend in pb_public\ aus dem Update-Paket (dartszentrale-update-*.tar.gz).
# Kein Node, kein Neustart — PocketBase liefert die neuen Dateien sofort aus. pb_data\ bleibt.
#   .\update-verein-lan.ps1                      # neuestes Paket in updates\
#   .\update-verein-lan.ps1 -Source C:\pfad.tar.gz   # bestimmtes Paket
#   .\update-verein-lan.ps1 -Source E:\          # Ordner (z. B. USB-Stick) mit dem Paket
param([string]$Source)
$ErrorActionPreference = 'Stop'
$ROOT = $PSScriptRoot
$PUB  = Join-Path $ROOT 'pb_public'
if (-not $Source) { $Source = Join-Path $ROOT 'updates' }
# System-tar (bsdtar) gezielt ansprechen — nicht ein evtl. im PATH liegendes MSYS/GNU-tar.
$sysroot = if ($env:SystemRoot) { $env:SystemRoot } else { 'C:\Windows' }
$TAR = Join-Path $sysroot 'System32\tar.exe'

if (-not (Test-Path $PUB)) { Write-Host "x pb_public\ fehlt — ist das der DartsZentrale-Ordner? Zuerst start-verein-lan.bat ausfuehren."; exit 1 }

# Paket ermitteln (Ordner → neuestes Paket darin; sonst direkt die Datei)
if (Test-Path $Source -PathType Container) {
  $PKG = Get-ChildItem -Path $Source -Filter 'dartszentrale-update-*.tar.gz' -File -ErrorAction SilentlyContinue |
         Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
} else { $PKG = $Source }
if (-not $PKG -or -not (Test-Path $PKG)) { Write-Host "x Kein Update-Paket (dartszentrale-update-*.tar.gz) gefunden in/unter: $Source"; exit 1 }
Write-Host "* Update-Paket: $(Split-Path $PKG -Leaf)"

$TMP = Join-Path ([System.IO.Path]::GetTempPath()) ("dz-upd-" + [System.IO.Path]::GetRandomFileName())
$NEW = Join-Path $TMP 'new'
New-Item -ItemType Directory -Path $NEW -Force | Out-Null
try {
  & $TAR -xzf "$PKG" -C "$NEW"
  if (-not (Test-Path (Join-Path $NEW 'index.html'))) { Write-Host "x Paket enthaelt kein index.html an der Wurzel — falsches Paket?"; exit 1 }
  $BK = Join-Path $ROOT 'backup'; New-Item -ItemType Directory -Path $BK -Force | Out-Null
  $STAMP = Get-Date -Format 'yyyyMMdd-HHmmss'
  Move-Item -Path $PUB -Destination (Join-Path $BK "pb_public-$STAMP")
  Move-Item -Path $NEW -Destination $PUB
  Write-Host "  + pb_public\ aktualisiert (altes Frontend gesichert: backup\pb_public-$STAMP)"
  Write-Host "  Im Browser neu laden genuegt — kein Neustart noetig."
} finally { Remove-Item -Path $TMP -Recurse -Force -ErrorAction SilentlyContinue }
