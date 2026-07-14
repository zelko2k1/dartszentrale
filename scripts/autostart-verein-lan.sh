#!/usr/bin/env bash
# ═══════ DartsZentrale — Autostart (Vereinsmodus LAN, Single-Binary) ═══════
# Richtet EINEN systemd-USER-Dienst ein, der PocketBase (App + API aus pb_public/) beim Boot
# startet und bei Absturz neu startet. Kein Node. Voraussetzung: einmal ./start-verein-lan.sh
# ausführen (lädt das Binary + legt die Konten an), dann dieses Skript.
#
# Verwaltung danach:
#   systemctl --user status dartszentrale
#   journalctl --user -u dartszentrale -f          # Logs live
#   systemctl --user disable --now dartszentrale    # Autostart wieder entfernen (Daten bleiben)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-8090}"
HOST="${HOST:-0.0.0.0}"          # 0.0.0.0 = im LAN erreichbar
PB="$ROOT/pocketbase"
DATA="$ROOT/pb_data"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

command -v systemctl >/dev/null || { echo "✗ systemd (systemctl) nicht gefunden — dieses Skript braucht systemd."; exit 1; }
[ -x "$PB" ]   || { echo "✗ PocketBase-Binary fehlt ($PB) — bitte zuerst ./start-verein-lan.sh ausführen."; exit 1; }
[ -d "$DATA" ] || { echo "✗ Noch nicht eingerichtet (pb_data/ fehlt) — bitte zuerst ./start-verein-lan.sh ausführen."; exit 1; }
systemctl --user show-environment >/dev/null 2>&1 || { echo "✗ Keine systemd-User-Session aktiv. Bei SSH-only: 'loginctl enable-linger $USER' + neu anmelden."; exit 1; }

mkdir -p "$UNIT_DIR"
cat > "$UNIT_DIR/dartszentrale.service" <<EOF
[Unit]
Description=DartsZentrale (Vereinsmodus LAN, Single-Binary)
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
echo "• Unit-Datei geschrieben → $UNIT_DIR/dartszentrale.service"

systemctl --user daemon-reload
systemctl --user enable --now dartszentrale.service
loginctl enable-linger "$USER" >/dev/null 2>&1 && echo "• Autostart beim Boot aktiv (linger)" \
  || echo "⚠ 'loginctl enable-linger $USER' nicht möglich — Dienst startet erst nach dem Login."

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "✅ DartsZentrale läuft als Dienst:"
[ -n "$LAN_IP" ] && echo "   im Netz  : http://${LAN_IP}:${PORT}"
echo "   Status   : systemctl --user status dartszentrale"
echo "   Logs     : journalctl --user -u dartszentrale -f"
echo "   Entfernen: systemctl --user disable --now dartszentrale && rm -f \"$UNIT_DIR/dartszentrale.service\" && systemctl --user daemon-reload"
