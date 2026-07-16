@echo off
REM ═══ DartsZentrale — Club mode LAN (Windows) ═══
REM One program (PocketBase) serves the app + data. No Node, no build.
REM Calls the actual logic in start-club-lan.ps1 (first run creates the admin accounts).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-club-lan.ps1"
echo.
pause
