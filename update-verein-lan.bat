@echo off
REM ═══ DartsZentrale — Update (Vereinsmodus LAN, Windows) ═══
REM Tauscht das Frontend in pb_public aus dem Update-Paket (dartszentrale-update-*.tar.gz).
REM Ohne Argument: neuestes Paket im Ordner "updates". Sonst Pfad/Laufwerk angeben, z. B. update-verein-lan.bat E:\
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-verein-lan.ps1" -Source "%~1"
echo.
pause
