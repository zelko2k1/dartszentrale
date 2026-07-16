#!/usr/bin/env bash
# ═══════ [ PRODUCTION / OPS ] — Local mode, one board (frontend only) ═══════
# Builds the app (one-time) and serves it → http://127.0.0.1:4173.
# NO PocketBase, NO server, no login — the data lives in the browser.
# Stop with Ctrl+C.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_PORT="${WEB_PORT:-4173}"
WEB_HOST="${WEB_HOST:-127.0.0.1}"

command -v node >/dev/null || { echo "✗ Node.js missing — please install it (https://nodejs.org)"; exit 1; }

# Local mode: deliberately do NOT set a server address (otherwise the app would offer club mode).
[ -d "$ROOT/app/node_modules" ] || { echo "• npm install …"; ( cd "$ROOT/app" && npm install ); }
[ -f "$ROOT/app/dist/index.html" ] || { echo "• Building app (one-time) …"; ( cd "$ROOT/app" && npm run build ); }

echo "▶ DartsZentrale (local) → http://${WEB_HOST}:${WEB_PORT}"
echo "  On first start choose 'Local' in the app. Keep the window open; stop with Ctrl+C."
( command -v xdg-open >/dev/null && sleep 3 && xdg-open "http://127.0.0.1:${WEB_PORT}" >/dev/null 2>&1 || true ) &
cd "$ROOT/app" && exec env HOST="${WEB_HOST}" PORT="${WEB_PORT}" node serve-dist.mjs
