@echo off
chcp 65001 >nul
title DartsZentrale einrichten (Vereinsmodus LAN)
REM ====== [ PRODUKTIV / OPS ] - Windows-Starter fuer die gefuehrte Einrichtung ======
REM Ruft einrichten-lan.ps1 auf (Abfragen, Download, Build, Superuser, Admin, Autostart).
where node >nul 2>nul
if errorlevel 1 (
  echo [DartsZentrale] Node.js wurde nicht gefunden. Bitte zuerst installieren: https://nodejs.org
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0einrichten-lan.ps1"
if errorlevel 1 (
  echo.
  echo [DartsZentrale] Einrichtung abgebrochen - siehe Meldungen oben.
  pause
  exit /b 1
)
exit /b 0
