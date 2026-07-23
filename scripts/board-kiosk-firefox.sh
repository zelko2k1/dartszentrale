#!/usr/bin/env bash
# ============ DartsZentrale - board kiosk autostart (Firefox, Linux) ============
# Turns THIS machine into a board display: opens Firefox fullscreen (kiosk) on the app URL
# and launches it automatically at every login (via ~/.config/autostart).
#
# Do this ONCE per board PC. On first open, sign in with the BOARD account - it stays
# signed in across restarts (other accounts must sign in again each time).
# Uses the normal Firefox profile on purpose (NOT private) so the login is kept.
# Needs Firefox 71 or newer (older versions have no --kiosk).
#
#   Usage:  ./board-kiosk-firefox.sh [APP_URL]    e.g. ./board-kiosk-firefox.sh http://192.168.1.50:8090
#   Remove: rm ~/.config/autostart/dartszentrale-board.desktop
set -euo pipefail

URL="${1:-${URL:-}}"
if [ -z "$URL" ]; then read -rp "App address (e.g. http://192.168.1.50:8090): " URL; fi
[ -n "$URL" ] || { echo "✗ No address given."; exit 1; }

command -v firefox >/dev/null 2>&1 || { echo "✗ Firefox not found. Install it, or use ./board-kiosk-chrome.sh"; exit 1; }

AUTO="${XDG_CONFIG_HOME:-$HOME/.config}/autostart"
mkdir -p "$AUTO"
cat > "$AUTO/dartszentrale-board.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=DartsZentrale Board
Comment=DartsZentrale board display (kiosk)
Exec=firefox --kiosk $URL
X-GNOME-Autostart-enabled=true
NoDisplay=true
EOF
echo "• Autostart set up → $AUTO/dartszentrale-board.desktop"
echo "  Remove: rm \"$AUTO/dartszentrale-board.desktop\""
echo "  Exit kiosk anytime with Ctrl+W or Alt+F4."
echo "• Starting now…"
firefox --kiosk "$URL" >/dev/null 2>&1 &
disown 2>/dev/null || true
