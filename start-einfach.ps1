# ═══════ DartsZentrale — Einfach-Start (Windows, ein Binary, kein Node, kein Build) ═══════
# PocketBase liefert das fertige Frontend aus pb_public\ AUS und ist zugleich die API — ein Port.
# Erststart legt den Admin an (ohne Node, via REST); danach nur noch Server starten.
#   Umgebung optional: $env:PORT, $env:PB_HOST (0.0.0.0 = im LAN erreichbar, 127.0.0.1 = nur lokal)
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

# ── 1) PocketBase-Binary sicherstellen (sonst laden) ─────────────────────────
if (-not (Test-Path $PB)) {
  $arch = if ([Environment]::Is64BitOperatingSystem) { 'windows_amd64' } else { 'windows_386' }
  Write-Host "* Lade PocketBase $PB_VERSION ($arch) ..."
  $zip = Join-Path $env:TEMP 'pb.zip'
  Invoke-WebRequest -Uri "https://github.com/pocketbase/pocketbase/releases/download/v$PB_VERSION/pocketbase_${PB_VERSION}_${arch}.zip" -OutFile $zip
  Expand-Archive -Path $zip -DestinationPath $ROOT -Force
  Remove-Item $zip -Force
}

# ── 2) Erststart (noch keine DB) → Admin anlegen (CLI + REST, ohne Node) ─────
if (-not (Test-Path $DATA)) {
  Write-Host "-- Ersteinrichtung (nur beim ersten Start) --"
  $adminEmail = ''
  while (-not $adminEmail) { $adminEmail = Read-Host '  Admin-E-Mail' }
  $adminPw = ''
  while (-not $adminPw) {
    $s1 = Read-Host '  Admin-Passwort (min. 8)' -AsSecureString
    $s2 = Read-Host '  Passwort wiederholen'    -AsSecureString
    $p1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s1))
    $p2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s2))
    if ($p1.Length -lt 8) { Write-Host '  x mindestens 8 Zeichen.'; continue }
    if ($p1 -ne $p2)      { Write-Host '  x stimmt nicht ueberein.'; continue }
    $adminPw = $p1
  }
  # Interner Superuser (Konsole /_/, nur Recovery) — Zufallspasswort, lokal gespeichert.
  $suEmail = 'superuser@dartszentrale.local'
  $suPw = -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 20 | ForEach-Object { [char]$_ })
  & $PB superuser upsert $suEmail $suPw --dir $DATA | Out-Null
  "PocketBase-Konsole ($LOCAL/_/):`r`n  E-Mail:   $suEmail`r`n  Passwort: $suPw" | Set-Content -Path (Join-Path $ROOT '.superuser')
  Write-Host "  * interner Superuser gespeichert in .superuser (sicher aufbewahren)"
  # PB kurz starten, App-Admin per REST anlegen.
  $boot = Start-Process -FilePath $PB -ArgumentList $serveArgs -PassThru -WindowStyle Hidden
  for ($i=0; $i -lt 40; $i++) { try { Invoke-RestMethod "$LOCAL/api/health" -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep -Milliseconds 500 } }
  try {
    $auth = Invoke-RestMethod -Method Post -Uri "$LOCAL/api/collections/_superusers/auth-with-password" -ContentType 'application/json' -Body (@{identity=$suEmail;password=$suPw} | ConvertTo-Json)
    $body = @{ email=$adminEmail; password=$adminPw; passwordConfirm=$adminPw; emailVisibility=$true; verified=$true; name='Administrator'; first='Administrator'; last=''; role='admin'; active=$true } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "$LOCAL/api/collections/users/records" -Headers @{ Authorization = $auth.token } -ContentType 'application/json' -Body $body | Out-Null
    Write-Host "  + Admin angelegt: $adminEmail"
  } catch { Write-Host "  ! Admin-Anlage fehlgeschlagen — spaeter in der Konsole $LOCAL/_/ nachholen." }
  Stop-Process -Id $boot.Id -Force -ErrorAction SilentlyContinue
  Write-Host "-- Einrichtung fertig --`n"
}

# ── 3) Starten (App + API aus einem Binary) ──────────────────────────────────
$lan = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress
Write-Host "> DartsZentrale laeuft:"
Write-Host "    dieser Rechner : $LOCAL"
if ($lan -and $BIND -ne '127.0.0.1') { Write-Host "    andere Geraete : http://${lan}:$PORT  (Board-PCs als Lesezeichen, Tablets per QR in der App)" }
Write-Host "  (Fenster schliessen zum Beenden)"
Start-Job { Start-Sleep 2; Start-Process $using:LOCAL } | Out-Null
& $PB @serveArgs
