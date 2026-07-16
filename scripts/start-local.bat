@echo off
chcp 65001 >nul
title DartsZentrale (local)
REM ====== [ PRODUCTION / OPS ] - Local mode, one board (frontend only) ======
REM No PocketBase, no server: serves the built app at http://127.0.0.1:4173.
cd /d "%~dp0app"

where node >nul 2>nul
if errorlevel 1 (
  echo [DartsZentrale] Node.js was not found. Please install it first: https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [DartsZentrale] Installing dependencies ^(one-time^)...
  call npm install || goto :error
)
if not exist "dist\index.html" (
  echo [DartsZentrale] Building app ^(one-time^)...
  call npm run build || goto :error
)

echo [DartsZentrale] Starting locally at http://127.0.0.1:4173 ...
start "DartsZentrale" /D "%~dp0app" cmd /k "set HOST=127.0.0.1&& set PORT=4173&& node serve-dist.mjs"
timeout /t 5 >nul
start "" "http://127.0.0.1:4173"
echo.
echo [DartsZentrale] Running. On first start choose "Local" in the app.
echo            Keep the "DartsZentrale" window open; close it to stop.
timeout /t 6 >nul
exit /b 0

:error
echo.
echo [DartsZentrale] ERROR while starting. See the messages above.
pause
exit /b 1
