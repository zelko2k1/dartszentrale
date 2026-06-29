#!/usr/bin/env bash
# ═══════ [ PRODUKTIV / OPS ] — DartsHub-Autostart wieder entfernen ═══════
# Deaktiviert und entfernt die systemd-USER-Dienste, die autostart-einrichten.sh angelegt hat
# (dartshub-pocketbase.service, dartshub-web.service).
# Unberührt bleiben: deine Daten (pocketbase/pb_data) und die App selbst.
set -euo pipefail

UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

command -v systemctl >/dev/null || { echo "✗ systemd (systemctl) nicht gefunden — nichts zu entfernen."; exit 1; }

systemctl --user disable --now dartshub-web.service dartshub-pocketbase.service 2>/dev/null || true
rm -f "$UNIT_DIR/dartshub-web.service" "$UNIT_DIR/dartshub-pocketbase.service"
systemctl --user daemon-reload 2>/dev/null || true

echo "✓ DartsHub-Autostart entfernt. (Daten in pocketbase/pb_data bleiben erhalten.)"
echo "  Linger wird nicht automatisch abgebaut (evtl. von anderen Diensten genutzt)."
echo "  Bei Bedarf:  loginctl disable-linger \"$USER\""
