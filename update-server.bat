@echo off
chcp 65001 >nul
title DartsZentrale aktualisieren
REM ====== [ PRODUKTIV / OPS ] - Windows-Update: neue Version vom Stick uebernehmen + neu bauen ======
REM Uebernimmt app\ (Quelltext + Konfig) und pocketbase\ (Schema/Hooks/Skripte) von einem
REM Stick/Ordner in DIESEN Projektordner und baut die App neu.
REM   Aufruf:  update-server.bat [QUELLE]
REM            QUELLE = Laufwerk/Ordner mit frischem app\ und pocketbase\  (Default: E:\)
REM   Per Doppelklick wird die Default-Quelle E:\ genommen.
REM Bleibt unangetastet:  pocketbase\pb_data\ (Daten) - app\node_modules\ - app\.env.local -
REM                       pocketbase\pocketbase.exe (Binaerdatei).
setlocal
set "ROOT=%~dp0"

REM --- Quelle bestimmen (Argument oder Default E:\), evtl. Backslash am Ende entfernen ---
set "SRC=%~1"
if "%SRC%"=="" set "SRC=E:\"
if "%SRC:~-1%"=="\" set "SRC=%SRC:~0,-1%"

echo [DartsZentrale] Quelle:      %SRC%
echo [DartsZentrale] Projektort:  %ROOT%

where node >nul 2>nul
if errorlevel 1 (
  echo [DartsZentrale] Node.js wurde nicht gefunden: https://nodejs.org
  pause
  exit /b 1
)

if not exist "%SRC%\app" (
  echo [DartsZentrale] FEHLER: "%SRC%\app" nicht gefunden - Stick verbunden? Stimmt die QUELLE?
  echo            Mit anderem Laufwerk z.B.:  update-server.bat F:\
  pause
  exit /b 1
)
if not exist "%ROOT%app" (
  echo [DartsZentrale] FEHLER: "%ROOT%app" fehlt - liegt diese .bat im Projektordner?
  pause
  exit /b 1
)

REM --- 1) Frontend (app\) uebernehmen. robocopy /MIR ersetzt Code-Ordner sauber. ---
echo [DartsZentrale] -- Frontend uebernehmen (app\) --
robocopy "%SRC%\app\src"    "%ROOT%app\src"    /MIR /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :error
robocopy "%SRC%\app\public" "%ROOT%app\public" /MIR /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :error
for %%f in (package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json eslint.config.js serve-dist.mjs Dockerfile nginx.conf .dockerignore) do (
  if exist "%SRC%\app\%%f" copy /Y "%SRC%\app\%%f" "%ROOT%app\%%f" >nul
)

REM --- 2) PocketBase (Schema/Hooks/Skripte - NICHT pb_data, NICHT die .exe) ---
if exist "%SRC%\pocketbase" if exist "%ROOT%pocketbase" (
  echo [DartsZentrale] -- PocketBase uebernehmen (Schema/Hooks/Skripte) --
  robocopy "%SRC%\pocketbase\pb_migrations" "%ROOT%pocketbase\pb_migrations" /MIR /NFL /NDL /NJH /NJS /NP >nul
  if errorlevel 8 goto :error
  robocopy "%SRC%\pocketbase\pb_hooks"      "%ROOT%pocketbase\pb_hooks"      /MIR /NFL /NDL /NJH /NJS /NP >nul
  if errorlevel 8 goto :error
  copy /Y "%SRC%\pocketbase\*.mjs" "%ROOT%pocketbase\" >nul 2>nul
)

REM --- 3) Abhaengigkeiten + Build ---
cd /d "%ROOT%app"
echo [DartsZentrale] -- npm install + npm run build --
call npm install || goto :error
call npm run build || goto :error

REM --- 4) Server-Installation? -> Dienste gezielt neu starten ---
if exist "%ROOT%start-lan-server.bat" (
  echo [DartsZentrale] Server-Installation erkannt - Dienste neu starten ...
  taskkill /FI "WINDOWTITLE eq DartsZentrale PocketBase" /T /F >nul 2>nul
  taskkill /FI "WINDOWTITLE eq DartsZentrale Frontend"   /T /F >nul 2>nul
  start "" "%ROOT%start-lan-server.bat"
  echo [DartsZentrale] Update aktiv, Dienste neu gestartet. An den Boards die Seite neu laden.
  pause
  exit /b 0
)

echo.
echo [DartsZentrale] Fertig. Beim naechsten Start ist die neue Version aktiv.
echo            pb_data, app\.env.local und pocketbase.exe blieben unangetastet.
pause
exit /b 0

:error
echo.
echo [DartsZentrale] FEHLER beim Aktualisieren. Siehe Meldungen oben.
pause
exit /b 1
