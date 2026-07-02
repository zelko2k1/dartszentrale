# ============================================================================
# DartsZentrale - Update ohne git (Windows / PowerShell)
# [ PRODUKTIV / OPS ] - fuer den Produktivbetrieb gedacht
# ----------------------------------------------------------------------------
# Uebernimmt eine neue App-Version von einem Stick/Ordner in den Projektordner,
# installiert Abhaengigkeiten und (optional) baut das Produktions-Bundle.
#
#   .\update-server.ps1 [-Source <Pfad>] [-Build]
#     -Source = Ordner mit frischem  app\  und  pocketbase\  (Default: E:\)
#     -Build  = zusaetzlich  app\dist  bauen (nur noetig, wenn ihr dist\ ausliefert)
#
# WICHTIG: Im PROJEKTORDNER ausfuehren (dort wo app\ + pocketbase\ liegen),
# NICHT die Kopie auf dem Stick starten.
#
# Wird NIE angefasst:  pb_data\ (Daten) - node_modules\ - app\.env.local -
# die PocketBase-Binaerdatei.
# ============================================================================
param(
  [string]$Source = "E:\",
  [switch]$Build
)
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

# Server-Installation? (von einrichten-lan.ps1 erzeugtes Startskript) -> dann ist
# ein Build PFLICHT (ausgeliefert wird das gebaute dist\) und die Dienste werden neu gestartet.
$ServerBat = Join-Path $Root "start-lan-server.bat"
$IsServer  = Test-Path $ServerBat
if ($IsServer) { $Build = $true }

Write-Host "> Quelle:     $Source"
Write-Host "> Projektort: $Root"
if (-not (Test-Path "$Source\app")) { Write-Error "'$Source\app' nicht gefunden - Stick verbunden? Stimmt -Source?"; exit 1 }
if (-not (Test-Path "$Root\app"))   { Write-Error "'$Root\app' fehlt - laeuft das Skript im Projektordner?"; exit 1 }

function Replace-Dir($src, $dst) {   # Code-Ordner sauber ersetzen (alte Dateien weg)
  if (Test-Path $src) {
    if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
    Copy-Item -Recurse -Force $src $dst
    Write-Host ("  + " + (Split-Path $dst -Leaf) + "\")
  }
}
function Copy-File($src, $dst) {     # Einzeldatei ueberschreiben, falls vorhanden
  if (Test-Path $src) { Copy-Item -Force $src $dst; Write-Host ("  + " + (Split-Path $src -Leaf)) }
}

# --- 1) Frontend (app\) ----------------------------------------------------
Write-Host "-- Frontend aktualisieren (app\) --"
Replace-Dir "$Source\app\src"    "$Root\app\src"
Replace-Dir "$Source\app\public" "$Root\app\public"
foreach ($f in @("package.json","package-lock.json","index.html","vite.config.ts",
                 "tsconfig.json","tsconfig.app.json","tsconfig.node.json",
                 "eslint.config.js","serve-dist.mjs","Dockerfile","nginx.conf",".dockerignore")) {
  Copy-File "$Source\app\$f" "$Root\app\$f"
}

# --- 2) PocketBase (Schema/Hooks/Skripte - NICHT pb_data, NICHT Binary) ----
$PbTouched = $false
if ((Test-Path "$Source\pocketbase") -and (Test-Path "$Root\pocketbase")) {
  Write-Host "-- PocketBase aktualisieren (Schema/Hooks/Skripte) --"
  Replace-Dir "$Source\pocketbase\pb_migrations" "$Root\pocketbase\pb_migrations"
  Replace-Dir "$Source\pocketbase\pb_hooks"      "$Root\pocketbase\pb_hooks"
  Get-ChildItem "$Source\pocketbase\*.mjs" -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-File $_.FullName "$Root\pocketbase\$($_.Name)"
  }
  $PbTouched = $true
}

# --- 3) Abhaengigkeiten + optionaler Build ---------------------------------
Write-Host "-- npm install (app\) --"
Push-Location "$Root\app"; npm install; Pop-Location

if ($Build) {
  Write-Host "-- npm run build (app\dist) --"
  Push-Location "$Root\app"; npm run build; Pop-Location
}

# --- Abschluss: Dienste neu starten (Server) oder Hinweis ------------------
Write-Host ""
if ($IsServer) {
  Write-Host "-- Server-Installation erkannt: Dienste neu starten --"
  # Gezielt nur die DartsZentrale-Fenster schliessen (per Fenstertitel) und neu starten.
  taskkill /FI "WINDOWTITLE eq DartsZentrale PocketBase" /T /F 2>$null | Out-Null
  taskkill /FI "WINDOWTITLE eq DartsZentrale Frontend"   /T /F 2>$null | Out-Null
  Start-Sleep 1
  Start-Process -FilePath $ServerBat -WorkingDirectory $Root
  Write-Host "OK - Update aktiv, Dienste neu gestartet."
} else {
  Write-Host "OK - Update uebernommen."
  Write-Host "   -> App NEU STARTEN:  start-lan.bat  (oder: npm --prefix app run dev -- --port 5173 --strictPort)"
  if ($PbTouched) { Write-Host "   -> Schema evtl. geaendert: PocketBase NEU STARTEN (Migrations laufen beim Start)." }
}
Write-Host "   -> An den Boards die Seite neu laden (ggf. zweimal, wegen PWA-Cache)."
