#!/usr/bin/env bash
# ═══════ [ PRODUKTIV / OPS ] — Lokaler Autostart (nur Frontend) ═══════
# Richtet NUR das Frontend als systemd-USER-Dienst ein (Autostart beim Boot,
# Auto-Restart). KEIN PocketBase. Ideal fürs Kiosk-Board, das nach dem
# Hochfahren von selbst die App zeigen soll.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_PORT="${WEB_PORT:-4173}"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

command -v systemctl >/dev/null || { echo "✗ systemd (systemctl) nicht gefunden."; exit 1; }
command -v node >/dev/null      || { echo "✗ Node.js fehlt (https://nodejs.org)"; exit 1; }
systemctl --user show-environment >/dev/null 2>&1 || { echo "✗ Keine systemd-User-Session aktiv. Bei SSH-only: 'loginctl enable-linger $USER' + neu anmelden."; exit 1; }
NODE_BIN="$(command -v node)"; NODE_DIR="$(dirname "$NODE_BIN")"

[ -d "$ROOT/app/node_modules" ] || { echo "• npm install …"; ( cd "$ROOT/app" && npm install ); }
echo "• Baue Frontend …"; ( cd "$ROOT/app" && npm run build )

mkdir -p "$UNIT_DIR"
cat > "$UNIT_DIR/dartshub-web.service" <<EOF
[Unit]
Description=DartsHub Frontend (lokaler Modus)
After=network-online.target

[Service]
Type=simple
WorkingDirectory=${ROOT}/app
Environment=PATH=${NODE_DIR}:/usr/local/bin:/usr/bin:/bin
Environment=HOST=127.0.0.1
Environment=PORT=${WEB_PORT}
ExecStart=${NODE_BIN} ${ROOT}/app/serve-dist.mjs
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now dartshub-web.service
loginctl enable-linger "$USER" >/dev/null 2>&1 && echo "• Autostart beim Boot aktiv (linger)" \
  || echo "⚠ 'loginctl enable-linger $USER' nicht möglich — Dienst startet erst nach Login."

echo
echo "✅ Frontend läuft als Dienst → http://127.0.0.1:${WEB_PORT}"
echo "   Status   : systemctl --user status dartshub-web"
echo "   Entfernen: systemctl --user disable --now dartshub-web && rm -f \"$UNIT_DIR/dartshub-web.service\" && systemctl --user daemon-reload"
