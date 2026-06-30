#!/usr/bin/env bash
# ═══════ [ PRODUKTIV / OPS ] — Update lokaler Modus (nur Frontend) ═══════
# Übernimmt eine neue App-Version (app/) von einem Stick/Ordner und baut neu.
# KEIN PocketBase, KEIN Server — im lokalen Modus liegen die Daten im Browser,
# es gibt also nichts serverseitig zu sichern.
#   ./update-lokal.sh [QUELLE]      (QUELLE = Ordner mit frischem app/, Default /media/usb)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="${1:-/media/usb}"; SRC="${SRC%/}"

[ -d "$SRC/app" ] || { echo "✗ '$SRC/app' nicht gefunden — Stick gemountet? Stimmt die QUELLE?"; exit 1; }
[ -d "$ROOT/app" ] || { echo "✗ '$ROOT/app' fehlt — bitte im Projektordner ausführen."; exit 1; }
command -v node >/dev/null || { echo "✗ Node.js fehlt (https://nodejs.org)"; exit 1; }

echo "── Frontend übernehmen (app/) ──"
rm -rf "$ROOT/app/src" "$ROOT/app/public"
cp -r "$SRC/app/src"    "$ROOT/app/src"
cp -r "$SRC/app/public" "$ROOT/app/public"
for f in package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json eslint.config.js serve-dist.mjs; do
  [ -f "$SRC/app/$f" ] && cp -f "$SRC/app/$f" "$ROOT/app/$f" && echo "  ✓ $f"
done

echo "── npm install + build ──"
( cd "$ROOT/app" && npm install && npm run build )

# Läuft das Frontend als lokaler Autostart-Dienst? Dann neu starten.
if [ -f "${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/dartshub-web.service" ]; then
  systemctl --user restart dartshub-web && echo "✅ Update aktiv — Dienst neu gestartet."
else
  echo "✅ Update übernommen. App neu starten:  ./start-lokal.sh"
fi
echo "   → An den Boards die Seite neu laden (ggf. zweimal, wegen PWA-Cache)."
