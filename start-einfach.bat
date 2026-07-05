@echo off
REM ═══ DartsZentrale — Einfach-Start (Windows) ═══
REM Ein Programm (PocketBase) liefert App + Daten. Kein Node, kein Build.
REM Ruft die eigentliche Logik in start-einfach.ps1 auf (Erststart legt den Admin an).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-einfach.ps1"
echo.
pause
