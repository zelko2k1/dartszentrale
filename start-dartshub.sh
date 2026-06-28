#!/usr/bin/env bash
# ═══════ [ PRODUKTIV / OPS ] — Linux-Starthilfe (Vereinsmodus, manuell) ═══════
# Startet im Vereinsmodus BEIDE Dienste auf diesem Rechner:
#   • PocketBase (Backend)  → http://127.0.0.1:8090
#   • Frontend (vite preview, gebautes dist/) → http://127.0.0.1:4173
# Zum Beenden: Strg+C (stoppt beide). Für Autostart beim Boot: ./autostart-einrichten.sh
#
# Voraussetzung Vereinsmodus: PocketBase ist einmalig eingerichtet (Superuser + Schema),
# siehe docs/lokaler-betrieb.md (Superuser anlegen + `node provision.mjs`).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PB_PORT="${PB_PORT:-8090}"
WEB_PORT="${WEB_PORT:-4173}"
PB_URL="http://127.0.0.1:${PB_PORT}"

command -v node >/dev/null || { echo "✗ Node.js fehlt — bitte installieren (https://nodejs.org)"; exit 1; }
[ -x "$ROOT/pocketbase/pocketbase" ] || { echo "✗ PocketBase-Binary fehlt: $ROOT/pocketbase/pocketbase (siehe docs/lokaler-betrieb.md)"; exit 1; }

# Frontend gegen die lokale PB bauen (VITE_PB_URL wird zur BUILD-Zeit ins Bundle gebacken).
if ! grep -q "VITE_PB_URL=" "$ROOT/app/.env.local" 2>/dev/null; then
  echo "VITE_PB_URL=${PB_URL}" > "$ROOT/app/.env.local"
  echo "• app/.env.local angelegt (VITE_PB_URL=${PB_URL})"
fi
[ -d "$ROOT/app/node_modules" ] || { echo "• npm install …"; ( cd "$ROOT/app" && npm install ); }
if [ ! -f "$ROOT/app/dist/index.html" ]; then
  echo "• Baue Frontend (einmalig) …"; ( cd "$ROOT/app" && npm run build )
fi

# PocketBase starten
echo "▶ PocketBase  → ${PB_URL}"
( cd "$ROOT/pocketbase" && ./pocketbase serve \
    --http="127.0.0.1:${PB_PORT}" \
    --dir="$ROOT/pocketbase/pb_data" \
    --migrationsDir="$ROOT/pocketbase/pb_migrations" \
    --hooksDir="$ROOT/pocketbase/pb_hooks" ) &
PB_PID=$!

# Frontend (vite preview) starten
echo "▶ Frontend    → http://127.0.0.1:${WEB_PORT}"
( cd "$ROOT/app" && npm run preview -- --host 127.0.0.1 --port "${WEB_PORT}" --strictPort ) &
WEB_PID=$!

# Beide beim Beenden (Strg+C) sauber stoppen
trap 'echo; echo "⏹  stoppe …"; kill "$PB_PID" "$WEB_PID" 2>/dev/null; wait 2>/dev/null; exit 0' INT TERM

# Browser öffnen (falls Desktop vorhanden), dann auf die Prozesse warten
( command -v xdg-open >/dev/null && sleep 3 && xdg-open "http://127.0.0.1:${WEB_PORT}" >/dev/null 2>&1 || true ) &

echo
echo "DartsHub läuft. Fenster offen lassen; zum Beenden Strg+C."
wait
