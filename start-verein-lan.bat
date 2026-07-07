@echo off
REM ═══ DartsZentrale — Vereinsmodus LAN (Windows) ═══
REM Ein Programm (PocketBase) liefert App + Daten. Kein Node, kein Build.
REM Ruft die eigentliche Logik in start-verein-lan.ps1 auf (Erststart legt die Admin-Konten an).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-verein-lan.ps1"
echo.
pause
