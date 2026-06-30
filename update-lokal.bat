@echo off
chcp 65001 >nul
title DartsHub aktualisieren (lokal)
REM ====== [ PRODUKTIV / OPS ] - Update lokaler Modus (nur Frontend) ======
REM Uebernimmt app\ von einem Stick/Ordner und baut neu. KEIN PocketBase, kein Server -
REM im lokalen Modus liegen die Daten im Browser, es gibt nichts serverseitig zu sichern.
REM   Aufruf:  update-lokal.bat [QUELLE]   (Default: E:\)
setlocal
set "ROOT=%~dp0"
set "SRC=%~1"
if "%SRC%"=="" set "SRC=E:\"
if "%SRC:~-1%"=="\" set "SRC=%SRC:~0,-1%"

echo [DartsHub] Quelle:     %SRC%
echo [DartsHub] Projektort: %ROOT%

where node >nul 2>nul
if errorlevel 1 ( echo [DartsHub] Node.js fehlt: https://nodejs.org & pause & exit /b 1 )
if not exist "%SRC%\app" (
  echo [DartsHub] FEHLER: "%SRC%\app" nicht gefunden - Stick verbunden? Stimmt die QUELLE?
  echo            Mit anderem Laufwerk z.B.:  update-lokal.bat F:\
  pause
  exit /b 1
)

echo [DartsHub] -- Frontend uebernehmen (app\) --
robocopy "%SRC%\app\src"    "%ROOT%app\src"    /MIR /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :error
robocopy "%SRC%\app\public" "%ROOT%app\public" /MIR /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :error
for %%f in (package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json eslint.config.js serve-dist.mjs) do (
  if exist "%SRC%\app\%%f" copy /Y "%SRC%\app\%%f" "%ROOT%app\%%f" >nul
)

cd /d "%ROOT%app"
echo [DartsHub] -- npm install + npm run build --
call npm install || goto :error
call npm run build || goto :error

echo.
echo [DartsHub] Fertig. App neu starten:  start-lokal.bat
echo            An den Boards die Seite neu laden (ggf. zweimal, wegen PWA-Cache).
pause
exit /b 0

:error
echo.
echo [DartsHub] FEHLER beim Aktualisieren. Siehe Meldungen oben.
pause
exit /b 1
