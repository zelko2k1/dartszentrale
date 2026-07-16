#!/usr/bin/env bash
# ═══════ DartsZentrale — Autostart (club mode LAN, single binary) ═══════
# Sets up ONE systemd USER service that starts PocketBase (app + API from pb_public/) at boot
# and restarts it on crash. No Node. Prerequisite: run ./start-club-lan.sh once
# (downloads the binary + creates the accounts), then run this script.
#
# Management afterwards:
#   systemctl --user status dartszentrale
#   journalctl --user -u dartszentrale -f          # live logs
#   systemctl --user disable --now dartszentrale    # remove autostart again (data stays)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-8090}"
HOST="${HOST:-0.0.0.0}"          # 0.0.0.0 = reachable on the LAN
PB="$ROOT/pocketbase"
DATA="$ROOT/pb_data"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

command -v systemctl >/dev/null || { echo "✗ systemd (systemctl) not found — this script requires systemd."; exit 1; }
[ -x "$PB" ]   || { echo "✗ PocketBase binary missing ($PB) — please run ./start-club-lan.sh first."; exit 1; }
[ -d "$DATA" ] || { echo "✗ Not set up yet (pb_data/ missing) — please run ./start-club-lan.sh first."; exit 1; }
systemctl --user show-environment >/dev/null 2>&1 || { echo "✗ No systemd user session active. If SSH-only: 'loginctl enable-linger $USER' + sign in again."; exit 1; }

mkdir -p "$UNIT_DIR"
cat > "$UNIT_DIR/dartszentrale.service" <<EOF
[Unit]
Description=DartsZentrale (club mode LAN, single binary)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${ROOT}
ExecStart=${PB} serve --automigrate=0 --http=${HOST}:${PORT} --dir=${DATA} --migrationsDir=${ROOT}/pb_migrations --hooksDir=${ROOT}/pb_hooks --publicDir=${ROOT}/pb_public
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
EOF
echo "• Unit file written → $UNIT_DIR/dartszentrale.service"

systemctl --user daemon-reload
systemctl --user enable --now dartszentrale.service
loginctl enable-linger "$USER" >/dev/null 2>&1 && echo "• Autostart at boot active (linger)" \
  || echo "⚠ 'loginctl enable-linger $USER' not possible — the service only starts after login."

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "✅ DartsZentrale is running as a service:"
[ -n "$LAN_IP" ] && echo "   on the network : http://${LAN_IP}:${PORT}"
echo "   Status   : systemctl --user status dartszentrale"
echo "   Logs     : journalctl --user -u dartszentrale -f"
echo "   Remove   : systemctl --user disable --now dartszentrale && rm -f \"$UNIT_DIR/dartszentrale.service\" && systemctl --user daemon-reload"
