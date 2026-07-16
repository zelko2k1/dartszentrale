@echo off
REM ═══ DartsZentrale — Update (club mode LAN, Windows) ═══
REM Replaces the frontend in pb_public from the update package (dartszentrale-update-*.tar.gz).
REM Without an argument: newest package in the "updates" folder. Otherwise pass a path/drive, e.g. update-club-lan.bat E:\
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-club-lan.ps1" -Source "%~1"
echo.
pause
