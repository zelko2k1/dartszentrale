#!/usr/bin/env bash
# ═══════ [ PRODUKTIV / OPS ] — Linux-Starthilfe (Vereinsmodus, manuell) ═══════
# Startet im Vereinsmodus BEIDE Dienste auf diesem Rechner:
#   • PocketBase (Backend)  → http://127.0.0.1:8090
#   • Frontend (statischer Server für gebautes dist/) → http://127.0.0.1:4173
# Zum Beenden: Strg+C (stoppt beide). Für Autostart beim Boot: ./autostart-lan.sh
#
# Voraussetzung Vereinsmodus: PocketBase ist einmalig eingerichtet (Superuser + Schema),
# siehe docs/lokaler-betrieb.md (Superuser anlegen + `node provision.mjs`).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PB_PORT="${PB_PORT:-8090}"
WEB_PORT="${WEB_PORT:-4173}"
WEB_HOST="${WEB_HOST:-127.0.0.1}"   # für LAN-Zugriff: WEB_HOST=0.0.0.0 ./start-lan.sh
PB_URL="http://127.0.0.1:${PB_PORT}"

command -v node >/dev/null || { echo "✗ Node.js fehlt — bitte installieren (https://nodejs.org)"; exit 1; }
# PocketBase ist nur für den Vereinsmodus nötig. Fehlt das Binary, starten wir trotzdem das
# Frontend (Lokalmodus) — analog zu start-lan.bat (kein harter Abbruch mehr).
HAVE_PB=0
if [ -x "$ROOT/pocketbase/pocketbase" ]; then
  HAVE_PB=1
else
  echo "• Hinweis: PocketBase-Binary fehlt — starte nur das Frontend (Lokalmodus)."
  echo "  Für den Vereinsmodus siehe docs/lokaler-betrieb.md."
fi

# Frontend gegen die lokale PB bauen (VITE_PB_URL wird zur BUILD-Zeit ins Bundle gebacken).
if ! grep -q "VITE_PB_URL=" "$ROOT/app/.env.local" 2>/dev/null; then
  echo "VITE_PB_URL=${PB_URL}" > "$ROOT/app/.env.local"
  echo "• app/.env.local angelegt (VITE_PB_URL=${PB_URL})"
fi
[ -d "$ROOT/app/node_modules" ] || { echo "• npm install …"; ( cd "$ROOT/app" && npm install ); }
if [ ! -f "$ROOT/app/dist/index.html" ]; then
  echo "• Baue Frontend (einmalig) …"; ( cd "$ROOT/app" && npm run build )
fi

# PocketBase starten (nur im Vereinsmodus, wenn das Binary vorhanden ist)
PB_PID=""
if [ "$HAVE_PB" = "1" ]; then
  echo "▶ PocketBase  → ${PB_URL}"
  ( cd "$ROOT/pocketbase" && ./pocketbase serve \
      --http="127.0.0.1:${PB_PORT}" \
      --dir="$ROOT/pocketbase/pb_data" \
      --migrationsDir="$ROOT/pocketbase/pb_migrations" \
      --hooksDir="$ROOT/pocketbase/pb_hooks" ) &
  PB_PID=$!
fi

# Frontend (statischer Server für dist/) starten
echo "▶ Frontend    → http://${WEB_HOST}:${WEB_PORT}"
( cd "$ROOT/app" && HOST="${WEB_HOST}" PORT="${WEB_PORT}" node serve-dist.mjs ) &
WEB_PID=$!

# Beide beim Beenden (Strg+C) sauber stoppen
trap 'echo; echo "⏹  stoppe …"; kill ${PB_PID:-} "$WEB_PID" 2>/dev/null; wait 2>/dev/null; exit 0' INT TERM

# Browser öffnen (falls Desktop vorhanden), dann auf die Prozesse warten
( command -v xdg-open >/dev/null && sleep 3 && xdg-open "http://127.0.0.1:${WEB_PORT}" >/dev/null 2>&1 || true ) &

echo
echo "DartsHub läuft. Fenster offen lassen; zum Beenden Strg+C."
wait
