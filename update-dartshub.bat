@echo off
chcp 65001 >nul
title DartsHub aktualisieren
REM ====== [ PRODUKTIV / OPS ] - Windows-Update (Board/Kiosk) ======
cd /d "%~dp0app"

where node >nul 2>nul
if errorlevel 1 (
  echo [DartsHub] Node.js wurde nicht gefunden: https://nodejs.org
  pause
  exit /b 1
)

echo [DartsHub] Aktualisiere Abhaengigkeiten und baue App neu...
call npm install || goto :error
call npm run build || goto :error

echo.
echo [DartsHub] Fertig. Beim naechsten Start ist die neue Version aktiv.
pause
exit /b 0

:error
echo.
echo [DartsHub] FEHLER beim Aktualisieren. Siehe Meldungen oben.
pause
exit /b 1
