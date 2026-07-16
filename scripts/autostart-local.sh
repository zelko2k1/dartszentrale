#!/usr/bin/env bash
# ═══════ [ PRODUCTION / OPS ] — Local autostart (frontend only) ═══════
# Sets up ONLY the frontend as a systemd USER service (autostart at boot,
# auto-restart). NO PocketBase. Ideal for the kiosk board that should show
# the app by itself after powering on.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_PORT="${WEB_PORT:-4173}"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

command -v systemctl >/dev/null || { echo "✗ systemd (systemctl) not found."; exit 1; }
command -v node >/dev/null      || { echo "✗ Node.js missing (https://nodejs.org)"; exit 1; }
systemctl --user show-environment >/dev/null 2>&1 || { echo "✗ No systemd user session active. If SSH-only: 'loginctl enable-linger $USER' + sign in again."; exit 1; }
NODE_BIN="$(command -v node)"; NODE_DIR="$(dirname "$NODE_BIN")"

[ -d "$ROOT/app/node_modules" ] || { echo "• npm install …"; ( cd "$ROOT/app" && npm install ); }
echo "• Building frontend …"; ( cd "$ROOT/app" && npm run build )

mkdir -p "$UNIT_DIR"
cat > "$UNIT_DIR/darts-web.service" <<EOF
[Unit]
Description=DartsZentrale frontend (local mode)
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
systemctl --user enable --now darts-web.service
loginctl enable-linger "$USER" >/dev/null 2>&1 && echo "• Autostart at boot active (linger)" \
  || echo "⚠ 'loginctl enable-linger $USER' not possible — the service only starts after login."

echo
echo "✅ Frontend is running as a service → http://127.0.0.1:${WEB_PORT}"
echo "   Status : systemctl --user status darts-web"
echo "   Remove : systemctl --user disable --now darts-web && rm -f \"$UNIT_DIR/darts-web.service\" && systemctl --user daemon-reload"
