@echo off
chcp 65001 >nul
title DartsZentrale (lokal)
REM ====== [ PRODUKTIV / OPS ] - Lokaler Modus, ein Board (nur Frontend) ======
REM Kein PocketBase, kein Server: liefert die gebaute App auf http://127.0.0.1:4173 aus.
cd /d "%~dp0app"

where node >nul 2>nul
if errorlevel 1 (
  echo [DartsZentrale] Node.js wurde nicht gefunden. Bitte zuerst installieren: https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [DartsZentrale] Installiere Abhaengigkeiten ^(einmalig^)...
  call npm install || goto :error
)
if not exist "dist\index.html" (
  echo [DartsZentrale] Baue App ^(einmalig^)...
  call npm run build || goto :error
)

echo [DartsZentrale] Starte lokal auf http://127.0.0.1:4173 ...
start "DartsZentrale" /D "%~dp0app" cmd /k "set HOST=127.0.0.1&& set PORT=4173&& node serve-dist.mjs"
timeout /t 5 >nul
start "" "http://127.0.0.1:4173"
echo.
echo [DartsZentrale] Laeuft. Beim ersten Start in der App "Lokal" waehlen.
echo            Das Fenster "DartsZentrale" offen lassen; zum Beenden schliessen.
timeout /t 6 >nul
exit /b 0

:error
echo.
echo [DartsZentrale] FEHLER beim Starten. Siehe Meldungen oben.
pause
exit /b 1
