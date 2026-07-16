#!/usr/bin/env bash
# ═══════ [ PRODUCTION / OPS ] — Update local mode (frontend only) ═══════
# Takes a new app version (app/) from a stick/folder and rebuilds.
# NO PocketBase, NO server — in local mode the data lives in the browser,
# so there is nothing server-side to back up.
#   ./update-local.sh [SOURCE]      (SOURCE = folder with a fresh app/, default /media/usb)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="${1:-/media/usb}"; SRC="${SRC%/}"

[ -d "$SRC/app" ] || { echo "✗ '$SRC/app' not found — stick mounted? Is the SOURCE correct?"; exit 1; }
[ -d "$ROOT/app" ] || { echo "✗ '$ROOT/app' missing — please run inside the project folder."; exit 1; }
command -v node >/dev/null || { echo "✗ Node.js missing (https://nodejs.org)"; exit 1; }

echo "── Taking over frontend (app/) ──"
rm -rf "$ROOT/app/src" "$ROOT/app/public"
cp -r "$SRC/app/src"    "$ROOT/app/src"
cp -r "$SRC/app/public" "$ROOT/app/public"
for f in package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json eslint.config.js serve-dist.mjs; do
  [ -f "$SRC/app/$f" ] && cp -f "$SRC/app/$f" "$ROOT/app/$f" && echo "  ✓ $f"
done

echo "── npm install + build ──"
( cd "$ROOT/app" && npm install && npm run build )

# Is the frontend running as a local autostart service? Then restart it.
if [ -f "${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/darts-web.service" ]; then
  systemctl --user restart darts-web && echo "✅ Update active — service restarted."
else
  echo "✅ Update applied. Restart the app:  ./start-local.sh"
fi
echo "   → Reload the page on the boards (possibly twice, because of the PWA cache)."
