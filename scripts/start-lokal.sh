#!/usr/bin/env bash
# ═══════ [ PRODUKTIV / OPS ] — Lokaler Modus, ein Board (nur Frontend) ═══════
# Baut (einmalig) die App und liefert sie aus → http://127.0.0.1:4173.
# KEIN PocketBase, KEIN Server, keine Anmeldung — die Daten liegen im Browser.
# Beenden: Strg+C.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_PORT="${WEB_PORT:-4173}"
WEB_HOST="${WEB_HOST:-127.0.0.1}"

command -v node >/dev/null || { echo "✗ Node.js fehlt — bitte installieren (https://nodejs.org)"; exit 1; }

# Lokaler Modus: bewusst KEINE Server-Adresse setzen (sonst böte die App den Vereinsmodus an).
[ -d "$ROOT/app/node_modules" ] || { echo "• npm install …"; ( cd "$ROOT/app" && npm install ); }
[ -f "$ROOT/app/dist/index.html" ] || { echo "• Baue App (einmalig) …"; ( cd "$ROOT/app" && npm run build ); }

echo "▶ DartsZentrale (lokal) → http://${WEB_HOST}:${WEB_PORT}"
echo "  Beim ersten Start in der App 'Lokal' wählen. Fenster offen lassen; beenden mit Strg+C."
( command -v xdg-open >/dev/null && sleep 3 && xdg-open "http://127.0.0.1:${WEB_PORT}" >/dev/null 2>&1 || true ) &
cd "$ROOT/app" && exec env HOST="${WEB_HOST}" PORT="${WEB_PORT}" node serve-dist.mjs
