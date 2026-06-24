@echo off
chcp 65001 >nul
title DartsHub
cd /d "%~dp0app"

where node >nul 2>nul
if errorlevel 1 (
  echo [DartsHub] Node.js wurde nicht gefunden.
  echo Bitte zuerst installieren: https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [DartsHub] Installiere Abhaengigkeiten ^(einmalig, kann etwas dauern^)...
  call npm install || goto :error
)

if not exist "dist\index.html" (
  echo [DartsHub] Baue App ^(einmalig^)...
  call npm run build || goto :error
)

echo [DartsHub] Starte Server auf http://localhost:4173 ...
start "DartsHub Server" /D "%~dp0app" cmd /k "npm run preview -- --port 4173 --strictPort"

timeout /t 4 >nul
start "" "http://localhost:4173"

echo.
echo [DartsHub] Laeuft. Das Fenster "DartsHub Server" offen lassen, solange du die App nutzt.
echo Zum Beenden einfach das Server-Fenster schliessen.
timeout /t 5 >nul
exit /b 0

:error
echo.
echo [DartsHub] FEHLER beim Einrichten. Siehe Meldungen oben.
pause
exit /b 1
