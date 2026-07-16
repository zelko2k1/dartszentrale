@echo off
chcp 65001 >nul
title Update DartsZentrale (local)
REM ====== [ PRODUCTION / OPS ] - Update local mode (frontend only) ======
REM Takes app\ from a stick/folder and rebuilds. NO PocketBase, no server -
REM in local mode the data lives in the browser, there is nothing server-side to back up.
REM   Usage:  update-local.bat [SOURCE]   (default: E:\)
setlocal
set "ROOT=%~dp0"
set "SRC=%~1"
if "%SRC%"=="" set "SRC=E:\"
if "%SRC:~-1%"=="\" set "SRC=%SRC:~0,-1%"

echo [DartsZentrale] Source:     %SRC%
echo [DartsZentrale] Project:    %ROOT%

where node >nul 2>nul
if errorlevel 1 ( echo [DartsZentrale] Node.js missing: https://nodejs.org & pause & exit /b 1 )
if not exist "%SRC%\app" (
  echo [DartsZentrale] ERROR: "%SRC%\app" not found - stick connected? Is the SOURCE correct?
  echo            With a different drive e.g.:  update-local.bat F:\
  pause
  exit /b 1
)

echo [DartsZentrale] -- Taking over frontend (app\) --
robocopy "%SRC%\app\src"    "%ROOT%app\src"    /MIR /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :error
robocopy "%SRC%\app\public" "%ROOT%app\public" /MIR /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :error
for %%f in (package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json eslint.config.js serve-dist.mjs) do (
  if exist "%SRC%\app\%%f" copy /Y "%SRC%\app\%%f" "%ROOT%app\%%f" >nul
)

cd /d "%ROOT%app"
echo [DartsZentrale] -- npm install + npm run build --
call npm install || goto :error
call npm run build || goto :error

echo.
echo [DartsZentrale] Done. Restart the app:  start-local.bat
echo            Reload the page on the boards (possibly twice, because of the PWA cache).
pause
exit /b 0

:error
echo.
echo [DartsZentrale] ERROR while updating. See the messages above.
pause
exit /b 1
