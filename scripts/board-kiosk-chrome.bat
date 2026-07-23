@echo off
chcp 65001 >nul
title DartsZentrale board kiosk (Chrome)
REM ============ DartsZentrale - board kiosk autostart (Chrome, Windows) ============
REM Turns THIS PC into a board display: opens Chrome fullscreen (kiosk) on the app URL
REM and launches it automatically every time you sign in to Windows.
REM
REM Do this ONCE per board PC. On first open, sign in with the BOARD account -
REM it stays signed in across restarts (other accounts must sign in again each time).
REM Uses the normal Chrome profile on purpose (NOT incognito) so the login is kept.
setlocal

set "URL=%~1"
if "%URL%"=="" set /p "URL=App address (e.g. http://192.168.1.50:8090): "
if "%URL%"=="" (echo No address given. & pause & exit /b 1)

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (echo Chrome not found. Install Chrome, or use board-kiosk-firefox.bat. & pause & exit /b 1)

REM URLs have no spaces, so the flags can stay unquoted (keeps the PowerShell shortcut simple).
set "ARGS=--kiosk %URL% --noerrdialogs --disable-infobars --disable-session-crashed-bubble --disable-pinch --overscroll-history-navigation=0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$wsh=New-Object -ComObject WScript.Shell; $lnk=[IO.Path]::Combine($env:APPDATA,'Microsoft\Windows\Start Menu\Programs\Startup','DartsZentrale-Board.lnk'); $s=$wsh.CreateShortcut($lnk); $s.TargetPath='%CHROME%'; $s.Arguments='%ARGS%'; $s.Save()"
if errorlevel 1 goto :err

echo.
echo Autostart set up. This board opens %URL% in fullscreen at sign-in.
echo To remove: press Win+R, type  shell:startup  and delete "DartsZentrale-Board.lnk".
echo Exit kiosk anytime with  Alt+F4 .
echo.
echo Starting now...
start "" "%CHROME%" %ARGS%
exit /b 0

:err
echo.
echo ERROR while setting up autostart.
pause
exit /b 1
