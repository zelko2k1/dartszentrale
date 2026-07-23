#!/usr/bin/env bash
# ============ DartsZentrale - board kiosk autostart (Chrome/Chromium, Linux) ============
# Turns THIS machine into a board display: opens Chrome/Chromium fullscreen (kiosk) on the
# app URL and launches it automatically at every login (via ~/.config/autostart).
#
# Do this ONCE per board PC. On first open, sign in with the BOARD account - it stays
# signed in across restarts (other accounts must sign in again each time).
# Uses the normal browser profile on purpose (NOT incognito) so the login is kept.
#
#   Usage:  ./board-kiosk-chrome.sh [APP_URL]     e.g. ./board-kiosk-chrome.sh http://192.168.1.50:8090
#   Remove: rm ~/.config/autostart/dartszentrale-board.desktop
set -euo pipefail

URL="${1:-${URL:-}}"
if [ -z "$URL" ]; then read -rp "App address (e.g. http://192.168.1.50:8090): " URL; fi
[ -n "$URL" ] || { echo "✗ No address given."; exit 1; }

# Pick whatever chromium-family browser is installed.
BROWSER=""
for b in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$b" >/dev/null 2>&1; then BROWSER="$b"; break; fi
done
[ -n "$BROWSER" ] || { echo "✗ Chrome/Chromium not found. Install it, or use ./board-kiosk-firefox.sh"; exit 1; }

FLAGS="--kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --overscroll-history-navigation=0"

AUTO="${XDG_CONFIG_HOME:-$HOME/.config}/autostart"
mkdir -p "$AUTO"
cat > "$AUTO/dartszentrale-board.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=DartsZentrale Board
Comment=DartsZentrale board display (kiosk)
Exec=$BROWSER $FLAGS $URL
X-GNOME-Autostart-enabled=true
NoDisplay=true
EOF
echo "• Autostart set up → $AUTO/dartszentrale-board.desktop"
echo "  Uses browser: $BROWSER"
echo "  Remove: rm \"$AUTO/dartszentrale-board.desktop\""
echo "  Exit kiosk anytime with Ctrl+W or Alt+F4."
echo "• Starting now…"
"$BROWSER" $FLAGS "$URL" >/dev/null 2>&1 &
disown 2>/dev/null || true
