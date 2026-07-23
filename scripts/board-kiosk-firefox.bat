@echo off
chcp 65001 >nul
title DartsZentrale board kiosk (Firefox)
REM ============ DartsZentrale - board kiosk autostart (Firefox, Windows) ============
REM Turns THIS PC into a board display: opens Firefox fullscreen (kiosk) on the app URL
REM and launches it automatically every time you sign in to Windows.
REM
REM Do this ONCE per board PC. On first open, sign in with the BOARD account -
REM it stays signed in across restarts (other accounts must sign in again each time).
REM Uses the normal Firefox profile on purpose (NOT private) so the login is kept.
REM Needs Firefox 71 or newer (older versions have no --kiosk).
setlocal

set "URL=%~1"
if "%URL%"=="" set /p "URL=App address (e.g. http://192.168.1.50:8090): "
if "%URL%"=="" (echo No address given. & pause & exit /b 1)

set "FF=%ProgramFiles%\Mozilla Firefox\firefox.exe"
if not exist "%FF%" set "FF=%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe"
if not exist "%FF%" (echo Firefox not found. Install Firefox, or use board-kiosk-chrome.bat. & pause & exit /b 1)

set "ARGS=--kiosk %URL%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$wsh=New-Object -ComObject WScript.Shell; $lnk=[IO.Path]::Combine($env:APPDATA,'Microsoft\Windows\Start Menu\Programs\Startup','DartsZentrale-Board.lnk'); $s=$wsh.CreateShortcut($lnk); $s.TargetPath='%FF%'; $s.Arguments='%ARGS%'; $s.Save()"
if errorlevel 1 goto :err

echo.
echo Autostart set up. This board opens %URL% in fullscreen at sign-in.
echo To remove: press Win+R, type  shell:startup  and delete "DartsZentrale-Board.lnk".
echo Exit kiosk anytime with  Alt+F4 .
echo.
echo Starting now...
start "" "%FF%" %ARGS%
exit /b 0

:err
echo.
echo ERROR while setting up autostart.
pause
exit /b 1
