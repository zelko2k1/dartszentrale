@echo off
chcp 65001 >nul
title DartsZentrale Autostart einrichten
REM ====== [ PRODUKTIV / OPS ] - Windows-Einrichtung (Board/Kiosk) ======

echo Richtet DartsZentrale so ein, dass es beim Anmelden automatisch startet.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$wsh=New-Object -ComObject WScript.Shell; $lnk=[System.IO.Path]::Combine($env:APPDATA,'Microsoft\Windows\Start Menu\Programs\Startup','DartsZentrale.lnk'); $s=$wsh.CreateShortcut($lnk); $s.TargetPath='%~dp0start-lan.bat'; $s.WorkingDirectory='%~dp0'; $s.WindowStyle=7; $s.Save()"
if errorlevel 1 goto :error

echo Autostart eingerichtet. DartsZentrale startet kuenftig automatisch beim Anmelden.
echo.
echo Zum Entfernen: Win+R druecken, "shell:startup" eingeben und dort "DartsZentrale.lnk" loeschen.
pause
exit /b 0

:error
echo.
echo FEHLER beim Einrichten des Autostarts.
pause
exit /b 1
