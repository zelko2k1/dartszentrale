# ═══════ DartsZentrale — Club mode LAN (Windows, one binary, no Node, no build) ═══════
# PocketBase SERVES the built frontend from pb_public\ and is also the API — one port.
# The first run creates two admin accounts (console + app) — the operator sets the passwords, nothing is stored.
#   Environment (optional): $env:PORT, $env:PB_HOST (0.0.0.0 = reachable on the LAN, 127.0.0.1 = local only)
$ErrorActionPreference = 'Stop'
$ROOT = $PSScriptRoot
$PB_VERSION = if ($env:PB_VERSION) { $env:PB_VERSION } else { '0.39.5' }
$PORT = if ($env:PORT) { $env:PORT } else { '8090' }
$BIND = if ($env:PB_HOST) { $env:PB_HOST } else { '0.0.0.0' }
$PB   = Join-Path $ROOT 'pocketbase.exe'
$DATA = Join-Path $ROOT 'pb_data'
$LOCAL = "http://127.0.0.1:$PORT"
$serveArgs = @('serve','--automigrate=0',"--http=${BIND}:${PORT}","--dir=$DATA",
  "--migrationsDir=$(Join-Path $ROOT 'pb_migrations')","--hooksDir=$(Join-Path $ROOT 'pb_hooks')",
  "--publicDir=$(Join-Path $ROOT 'pb_public')")

# ── Input helpers (first run only) ───────────────────────────────────────────
function Read-NonEmpty([string]$prompt, [string]$default='') {
  while ($true) {
    $v = Read-Host $prompt
    if (-not $v) { if ($default) { return $default } else { continue } }
    return $v
  }
}
function Read-Pw([string]$prompt) {
  while ($true) {
    $s1 = Read-Host "$prompt (min. 8)" -AsSecureString
    $s2 = Read-Host '     repeat'  -AsSecureString
    $p1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s1))
    $p2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s2))
    if ($p1.Length -lt 8) { Write-Host '     x at least 8 characters.'; continue }
    if ($p1 -ne $p2)      { Write-Host '     x does not match.'; continue }
    return $p1
  }
}

# ── 1) Ensure the PocketBase binary is present (otherwise download it) ───────
if (-not (Test-Path $PB)) {
  $arch = if ([Environment]::Is64BitOperatingSystem) { 'windows_amd64' } else { 'windows_386' }
  Write-Host "* Downloading PocketBase $PB_VERSION ($arch) ..."
  $zip = Join-Path $env:TEMP 'pb.zip'
  Invoke-WebRequest -Uri "https://github.com/pocketbase/pocketbase/releases/download/v$PB_VERSION/pocketbase_${PB_VERSION}_${arch}.zip" -OutFile $zip
  Expand-Archive -Path $zip -DestinationPath $ROOT -Force
  Remove-Item $zip -Force
}

# ── 2) First run (no DB yet) → create two admin accounts (CLI + REST, no Node) ─────
if (-not (Test-Path $DATA)) {
  Write-Host "-- Initial setup (first run only) --"
  Write-Host "   Two administrator accounts will be created. The passwords are"
  Write-Host "   NOT stored - please note them down safely (password manager)."
  Write-Host ""
  Write-Host "  1) PocketBase console (maintenance/recovery at $LOCAL/_/):"
  $suEmail = Read-NonEmpty '     Email [superuser@dartszentrale.local]' 'superuser@dartszentrale.local'
  $suPw    = Read-Pw       '     Password'
  Write-Host ""
  Write-Host "  2) App administrator (login in DartsZentrale):"
  $adminEmail = Read-NonEmpty '     Email'
  $adminPw    = Read-Pw       '     Password'
  # Create the superuser (password only as a CLI argument — never stored anywhere).
  & $PB superuser upsert $suEmail $suPw --dir $DATA | Out-Null
  Write-Host ""
  Write-Host "  * Creating accounts ..."
  # Start PB briefly, create the app admin via REST.
  $boot = Start-Process -FilePath $PB -ArgumentList $serveArgs -PassThru -WindowStyle Hidden
  for ($i=0; $i -lt 40; $i++) { try { Invoke-RestMethod "$LOCAL/api/health" -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep -Milliseconds 500 } }
  try {
    $auth = Invoke-RestMethod -Method Post -Uri "$LOCAL/api/collections/_superusers/auth-with-password" -ContentType 'application/json' -Body (@{identity=$suEmail;password=$suPw} | ConvertTo-Json)
    $body = @{ email=$adminEmail; password=$adminPw; passwordConfirm=$adminPw; emailVisibility=$true; verified=$true; name='Administrator'; first='Administrator'; last=''; role='admin'; active=$true } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "$LOCAL/api/collections/users/records" -Headers @{ Authorization = $auth.token } -ContentType 'application/json' -Body $body | Out-Null
    Write-Host "  + App administrator created: $adminEmail"
  } catch { Write-Host "  ! Creating the app admin failed - do it later in the console $LOCAL/_/." }
  Stop-Process -Id $boot.Id -Force -ErrorAction SilentlyContinue
  Write-Host "-- Setup complete --`n"
}

# ── 3) Start (app + API from one binary) ─────────────────────────────────────
$lan = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress
Write-Host "> DartsZentrale is running:"
Write-Host "    this computer  : $LOCAL"
if ($lan -and $BIND -ne '127.0.0.1') { Write-Host "    other devices  : http://${lan}:$PORT  (board PCs as a bookmark, tablets via QR in the app)" }
Write-Host "  (close this window to stop)"
Start-Job { Start-Sleep 2; Start-Process $using:LOCAL } | Out-Null
& $PB @serveArgs
