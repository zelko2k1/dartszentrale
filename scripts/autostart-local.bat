@echo off
chcp 65001 >nul
title Set up DartsZentrale autostart (local)
REM ====== [ PRODUCTION / OPS ] - Windows autostart for local mode (frontend only) ======
echo Sets up DartsZentrale (local mode) to start automatically at sign-in.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$wsh=New-Object -ComObject WScript.Shell; $lnk=[System.IO.Path]::Combine($env:APPDATA,'Microsoft\Windows\Start Menu\Programs\Startup','DartsZentrale.lnk'); $s=$wsh.CreateShortcut($lnk); $s.TargetPath='%~dp0start-local.bat'; $s.WorkingDirectory='%~dp0'; $s.WindowStyle=7; $s.Save()"
if errorlevel 1 goto :error

echo Autostart set up. DartsZentrale will now start automatically at sign-in.
echo.
echo To remove: press Win+R, enter "shell:startup" and delete "DartsZentrale.lnk" there.
pause
exit /b 0

:error
echo.
echo ERROR while setting up autostart.
pause
exit /b 1
