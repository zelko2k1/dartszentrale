@echo off
chcp 65001 >nul
title DartsHub
REM ====== [ PRODUKTIV / OPS ] - Windows-Starthilfe (Vereinsmodus: PocketBase + Frontend) ======
REM Startet im Vereinsmodus BEIDE Dienste auf diesem Rechner:
REM   - PocketBase (Backend)  -> http://127.0.0.1:8090   (nur wenn pocketbase.exe vorhanden)
REM   - Frontend (vite preview) -> http://localhost:4173
REM Jeder Dienst laeuft in einem eigenen Fenster; zum Beenden die Fenster schliessen.
cd /d "%~dp0app"

where node >nul 2>nul
if errorlevel 1 (
  echo [DartsHub] Node.js wurde nicht gefunden.
  echo Bitte zuerst installieren: https://nodejs.org
  echo.
  pause
  exit /b 1
)

REM Frontend gegen die lokale PocketBase bauen (VITE_PB_URL wird zur BUILD-Zeit ins Bundle gebacken).
if not exist ".env.local" (
  >".env.local" echo VITE_PB_URL=http://127.0.0.1:8090
  echo [DartsHub] app\.env.local angelegt ^(VITE_PB_URL=http://127.0.0.1:8090^)
) else (
  findstr /b /c:"VITE_PB_URL=" ".env.local" >nul 2>nul || >>".env.local" echo VITE_PB_URL=http://127.0.0.1:8090
)

if not exist "node_modules" (
  echo [DartsHub] Installiere Abhaengigkeiten ^(einmalig, kann etwas dauern^)...
  call npm install || goto :error
)

if not exist "dist\index.html" (
  echo [DartsHub] Baue App ^(einmalig^)...
  call npm run build || goto :error
)

REM --- PocketBase (Backend) ---
if exist "%~dp0pocketbase\pocketbase.exe" (
  echo [DartsHub] Starte PocketBase auf http://127.0.0.1:8090 ...
  start "DartsHub PocketBase" /D "%~dp0pocketbase" cmd /k "pocketbase.exe serve --http=127.0.0.1:8090 --dir=pb_data --migrationsDir=pb_migrations --hooksDir=pb_hooks"
) else (
  echo [DartsHub] Hinweis: pocketbase.exe nicht gefunden - fuer den Vereinsmodus wird es gebraucht.
  echo            ^(Das Frontend startet trotzdem; im Lokalmodus ist kein Server noetig.^)
)

REM --- Frontend ---
echo [DartsHub] Starte Frontend auf http://localhost:4173 ...
start "DartsHub Frontend" /D "%~dp0app" cmd /k "npm run preview -- --port 4173 --strictPort"

REM Kurz warten, bis die Dienste oben sind, dann Browser oeffnen
timeout /t 5 >nul
start "" "http://localhost:4173"

echo.
echo [DartsHub] Laeuft. Die Fenster "DartsHub PocketBase" und "DartsHub Frontend" offen lassen,
echo solange du die App nutzt. Zum Beenden einfach diese Fenster schliessen.
echo.
echo Hinweis Vereinsmodus: PocketBase muss einmalig eingerichtet sein (Superuser + Schema).
echo Details in docs\lokaler-betrieb.md (superuser upsert + node provision.mjs).
timeout /t 6 >nul
exit /b 0

:error
echo.
echo [DartsHub] FEHLER beim Einrichten. Siehe Meldungen oben.
pause
exit /b 1
