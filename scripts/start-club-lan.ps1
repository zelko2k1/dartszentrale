# ═══════ DartsZentrale — Club mode LAN (Windows, one binary, no Node, no build) ═══════
# PocketBase SERVES the built frontend from pb_public\ and is also the API — one port.
# The first run creates two admin accounts (console + app) — the operator sets the passwords, nothing is stored.
#   Environment (optional): $env:PORT, $env:PB_HOST (0.0.0.0 = reachable on the LAN, 127.0.0.1 = local only)
#
# Unattended first run: set $env:PB_SU_EMAIL / $env:PB_SU_PASS (console) and
# $env:APP_ADMIN_EMAIL / $env:APP_ADMIN_PASS (app) — the same names setup-cloud.sh uses. Whatever
# is preset is not asked for. Meant for automated setups and for the CI smoke test; at the club
# just start the script and answer the questions.
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
# Preset values win over the prompt — that is what makes an unattended run (and the CI smoke
# test) possible at all: Read-Host -AsSecureString cannot be fed from a pipe.
function Read-NonEmpty([string]$prompt, [string]$preset='') {
  if ($preset) { return $preset }
  while ($true) {
    $v = Read-Host $prompt
    if (-not $v) { continue }
    return $v
  }
}
function Read-Pw([string]$prompt, [string]$preset='') {
  if ($preset) {
    if ($preset.Length -lt 8) { Write-Host "x The preset password is shorter than 8 characters - PocketBase rejects it."; exit 1 }
    return $preset
  }
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
# Removes a half-finished pb_data again: this block only runs when pb_data is MISSING, so an
# aborted setup would otherwise leave an installation nobody can log into — and never ask again.
function Remove-HalfSetup($proc) {
  if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 300 }
  if (Test-Path $DATA) {
    Remove-Item -Recurse -Force $DATA -ErrorAction SilentlyContinue
    if (Test-Path $DATA) {
      # Windows keeps database files locked for a moment — say so plainly, because a leftover
      # pb_data would make the next start skip the setup without asking anything.
      Write-Host "  ! Could not delete '$DATA' (file still in use). Please delete the folder"
      Write-Host "    manually before starting again - otherwise no accounts will be created."
    } else {
      Write-Host "  -> Nothing was kept - the next start asks for the accounts again."
    }
  }
}

if (-not (Test-Path $DATA)) {
  # The port has to be free BEFORE anything is created (the setup starts PocketBase briefly).
  $busy = $false
  try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1',[int]$PORT); $busy = $c.Connected; $c.Close() } catch { $busy = $false }
  if ($busy) {
    Write-Host "x Port $PORT is already taken - is DartsZentrale (or PocketBase) already running?"
    Write-Host "  Stop the other program, or pick a different port:  `$env:PORT=8091"
    exit 1
  }
  Write-Host "-- Initial setup (first run only) --"
  Write-Host "   Two administrator accounts will be created. The passwords are"
  Write-Host "   NOT stored - please note them down safely (password manager)."
  Write-Host ""
  Write-Host "  1) PocketBase console (maintenance/recovery at $LOCAL/_/):"
  # No preset address on purpose: this repo is public, and a built-in admin address
  # both reveals the account name and invites leaving it unchanged.
  $suEmail = Read-NonEmpty '     Email' $env:PB_SU_EMAIL
  $suPw    = Read-Pw       '     Password' $env:PB_SU_PASS
  Write-Host ""
  Write-Host "  2) App administrator (login in DartsZentrale):"
  $adminEmail = Read-NonEmpty '     Email' $env:APP_ADMIN_EMAIL
  $adminPw    = Read-Pw       '     Password' $env:APP_ADMIN_PASS
  Write-Host ""
  Write-Host "  * Creating accounts ..."
  # Create the superuser (password only as a CLI argument — never stored anywhere).
  # CAREFUL: the PocketBase CLI reports errors on STDOUT and exits with 0 anyway — the exit code
  # says nothing, so the output has to be inspected. Deliberately WITHOUT '2>&1': with
  # $ErrorActionPreference='Stop' a redirected stderr stream can turn into a terminating
  # NativeCommandError — and the error text arrives on stdout regardless.
  $suOut = (& $PB superuser upsert $suEmail $suPw --dir $DATA | Out-String)
  if ($suOut -match 'Error') {
    Write-Host "  x The console account could not be created:"
    Write-Host "    $($suOut.Trim())"
    Remove-HalfSetup $null
    exit 1
  }
  # Start PB briefly, create the app admin via REST.
  $boot = Start-Process -FilePath $PB -ArgumentList $serveArgs -PassThru -WindowStyle Hidden
  $healthy = $false
  for ($i=0; $i -lt 60; $i++) { try { Invoke-RestMethod "$LOCAL/api/health" -TimeoutSec 2 | Out-Null; $healthy = $true; break } catch { Start-Sleep -Milliseconds 500 } }
  if (-not $healthy) {
    Write-Host "  x PocketBase did not start within 30 seconds - setup aborted."
    Remove-HalfSetup $boot
    exit 1
  }
  # Login separately from creating the account: a failed login means a broken setup (start over),
  # a failed creation only means the app admin is missing (can be added in the console).
  try {
    $auth = Invoke-RestMethod -Method Post -Uri "$LOCAL/api/collections/_superusers/auth-with-password" -ContentType 'application/json' -Body (@{identity=$suEmail;password=$suPw} | ConvertTo-Json)
  } catch {
    Write-Host "  x Login with the console account failed - setup aborted."
    Remove-HalfSetup $boot
    exit 1
  }
  try {
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
