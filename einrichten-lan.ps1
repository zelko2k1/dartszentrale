# ============================================================================
# DartsHub - Gefuehrte Vereinsmodus-Einrichtung im LAN (Windows / PowerShell)
# [ PRODUKTIV / OPS ]
# ----------------------------------------------------------------------------
# Richtet DartsHub auf DIESEM PC komplett ein - mit Abfragen, bis alles laeuft
# inkl. erstem App-Admin:
#   - laedt pocketbase.exe (falls nicht vorhanden)
#   - baut das Frontend (mit der richtigen Server-Adresse)
#   - legt Superuser + Schema + ersten App-Admin an
#   - startet PocketBase + Frontend und richtet Autostart beim Anmelden ein
#
# Start per Doppelklick auf  einrichten-lan.bat  (oder hier direkt).
# Voraussetzung: Node.js ist installiert (node -v).
# ============================================================================
$ErrorActionPreference = "Stop"
$Root    = $PSScriptRoot
$PbDir   = Join-Path $Root "pocketbase"
$AppDir  = Join-Path $Root "app"
$PbExe   = Join-Path $PbDir "pocketbase.exe"
$PbPort  = 8090
$WebPort = 4173
$PbVer   = if ($env:PB_VERSION) { $env:PB_VERSION } else { "0.39.5" }

function Read-Secret($prompt) {
  while ($true) {
    $a = Read-Host -AsSecureString $prompt
    $b = Read-Host -AsSecureString "  wiederholen"
    $pa = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($a))
    $pb = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($b))
    if (-not $pa)        { Write-Host "  x darf nicht leer sein"; continue }
    if ($pa -ne $pb)     { Write-Host "  x stimmt nicht ueberein"; continue }
    return $pa
  }
}

# --- Voraussetzungen -------------------------------------------------------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js fehlt - bitte installieren (nodejs.org, LTS). Siehe docs\admin-anleitung-windows.md (0b)."
  exit 1
}

# --- 0) Abfragen (vorab) ---------------------------------------------------
Write-Host "-- Sollen ANDERE Geraete im Netz (Bretter/Tablets) auf diesen Server zugreifen? --"
$lan = Read-Host "  [J] = Vereinsmodus im LAN (empfohlen)   [n] = nur dieser PC"
if ($lan -match '^[nN]') {
  $bind = "127.0.0.1"; $srvHost = "127.0.0.1"
} else {
  $bind = "0.0.0.0"
  $guess = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254*' } |
            Select-Object -First 1).IPAddress
  $inp = Read-Host "  Server-IP im Netz (Enter = $guess)"
  $srvHost = if ([string]::IsNullOrWhiteSpace($inp)) { $guess } else { $inp }
  if (-not $srvHost) { Write-Error "Keine Server-IP - bitte erneut starten und IP angeben."; exit 1 }
}
$pbUrlLocal = "http://127.0.0.1:$PbPort"
$viteUrl    = "http://${srvHost}:$PbPort"

Write-Host "-- PocketBase-Superuser (verwaltet die Datenbank unter /_/) --"
$suEmailDef = if ($env:PB_SU_EMAIL) { $env:PB_SU_EMAIL } else { "admin@dartshub.local" }
$suEmail = Read-Host "  Superuser-E-Mail (Enter = $suEmailDef)"
if ([string]::IsNullOrWhiteSpace($suEmail)) { $suEmail = $suEmailDef }
$suPass  = if ($env:PB_SU_PASS) { $env:PB_SU_PASS } else { Read-Secret "  Superuser-Passwort:" }

Write-Host "-- Erster App-Admin (dein Login IN der App) --"
$admEmail = if ($env:APP_ADMIN_EMAIL) { $env:APP_ADMIN_EMAIL } else { Read-Host "  App-Admin-E-Mail" }
$admPass  = if ($env:APP_ADMIN_PASS)  { $env:APP_ADMIN_PASS }  else { Read-Secret "  App-Admin-Passwort:" }

Write-Host ""
Write-Host "> Einrichtung startet - Bindung: $bind, Bretter erreichen: $viteUrl"
Write-Host ""

# --- 1) pocketbase.exe holen (falls nicht vorhanden) -----------------------
if (-not (Test-Path $PbExe)) {
  $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'windows_arm64' } else { 'windows_amd64' }
  $url  = "https://github.com/pocketbase/pocketbase/releases/download/v$PbVer/pocketbase_${PbVer}_$arch.zip"
  Write-Host "- PocketBase $PbVer ($arch) herunterladen ..."
  $zip = Join-Path $env:TEMP "pb_dl.zip"
  Invoke-WebRequest $url -OutFile $zip
  Expand-Archive $zip -DestinationPath $PbDir -Force
  Remove-Item $zip -Force
}
Write-Host "- PocketBase vorhanden."

# --- 2) Frontend bauen (VITE_PB_URL = Build-Zeit!) -------------------------
Write-Host "- Frontend bauen (VITE_PB_URL=$viteUrl) ..."
"VITE_PB_URL=$viteUrl" | Out-File -Encoding ascii (Join-Path $AppDir ".env.local")
Push-Location $AppDir
if (-not (Test-Path "node_modules")) { npm install }
npm run build
Pop-Location

# --- 3) Superuser anlegen (offline, bevor der Dienst die DB oeffnet) -------
Write-Host "- PocketBase-Superuser anlegen/aktualisieren ..."
& $PbExe superuser upsert $suEmail $suPass --dir (Join-Path $PbDir "pb_data") | Out-Null

# --- 4) Server-Startskript erzeugen (bind-bewusst) -------------------------
$startBat = Join-Path $Root "start-lan-server.bat"
@"
@echo off
chcp 65001 >nul
title DartsHub Server
start "DartsHub PocketBase" /D "%~dp0pocketbase" cmd /k "pocketbase.exe serve --automigrate=0 --http=$bind`:$PbPort --dir=pb_data --migrationsDir=pb_migrations --hooksDir=pb_hooks"
start "DartsHub Frontend" /D "%~dp0app" cmd /k "set HOST=$bind&& set PORT=$WebPort&& node serve-dist.mjs"
"@ | Out-File -Encoding ascii $startBat
Write-Host "- start-lan-server.bat erzeugt."

# --- 5) Server starten + auf PocketBase warten -----------------------------
Write-Host "- Server starten ..."
Start-Process -FilePath $startBat -WorkingDirectory $Root
$ok = $false
foreach ($i in 1..30) {
  try { Invoke-WebRequest "$pbUrlLocal/api/health" -UseBasicParsing -TimeoutSec 2 | Out-Null; $ok = $true; break } catch { Start-Sleep 1 }
}
if (-not $ok) { Write-Error "PocketBase nicht erreichbar - laeuft das Fenster 'DartsHub PocketBase'?"; exit 1 }

# --- 6) Schema + erster App-Admin (provision.mjs) --------------------------
Write-Host "- Schema + erster App-Admin (provision.mjs) ..."
$env:PB_URL = $pbUrlLocal; $env:PB_SU_EMAIL = $suEmail; $env:PB_SU_PASS = $suPass
$env:APP_ADMIN_EMAIL = $admEmail; $env:APP_ADMIN_PASS = $admPass
Push-Location $PbDir
node provision.mjs
Pop-Location

# --- 7) Autostart beim Anmelden (Verknuepfung im Startup-Ordner) -----------
$lnk = [System.IO.Path]::Combine($env:APPDATA,'Microsoft\Windows\Start Menu\Programs\Startup','DartsHub.lnk')
$wsh = New-Object -ComObject WScript.Shell
$s = $wsh.CreateShortcut($lnk)
$s.TargetPath = $startBat; $s.WorkingDirectory = $Root; $s.WindowStyle = 7
$s.Save()
Write-Host "- Autostart eingerichtet (Verknuepfung im Autostart-Ordner)."

# --- 8) Update-Freigabe: Token fuer In-App-Updates von einem anderen Board (LAN-IP) ---
$updDir = Join-Path $Root "updates"
if (-not (Test-Path $updDir)) { New-Item -ItemType Directory $updDir | Out-Null }
$tokFile = Join-Path $Root ".update-token"
if (-not (Test-Path $tokFile)) {
  $tok = -join ((1..32) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
  Set-Content -Path $tokFile -Value $tok -Encoding ascii -NoNewline
}
$updTok = (Get-Content $tokFile -Raw).Trim()

Write-Host ""
Write-Host "OK - DartsHub-Vereinsmodus laeuft:"
Write-Host "   App im Browser :  http://${srvHost}:$WebPort   (an den Brettern diese Adresse oeffnen)"
Write-Host "   PocketBase-UI  :  http://${srvHost}:$PbPort/_/"
Write-Host ""
Write-Host "Hinweis: Beim ersten App-Aufruf 'Vereinsmodus' waehlen und mit dem App-Admin anmelden."
Write-Host "Hinweis Update: 'dartshub-update-*.tar.gz' nach '$Root\updates\' legen -> Einstellungen -> 'App & Updates' -> Installieren."
Write-Host "   Am Board selbst ohne Token; von einem anderen Geraet mit Token:  $updTok"
if ($bind -eq "0.0.0.0") { Write-Host "Hinweis LAN: Windows-Firewall fragt ggf. -> 'Zugriff zulassen'." }
Start-Sleep 4
Start-Process "http://127.0.0.1:$WebPort"
