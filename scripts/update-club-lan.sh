#!/usr/bin/env bash
# ═══════ DartsZentrale — Update (club mode LAN, single binary) ═══════
# Replaces the frontend in pb_public/ from the update package (dartszentrale-update-*.tar.gz).
# No Node, no restart — PocketBase serves the new files immediately; reloading in the browser
# is enough. pb_data/ (your DB) is left untouched. The old frontend is backed up to backup/.
#
#   ./update-club-lan.sh                       # takes the newest package in updates/
#   ./update-club-lan.sh /path/package.tar.gz  # a specific package
#   ./update-club-lan.sh /media/usb            # folder containing the package
#
# Note: The package contains ONLY the frontend. If migrations/hooks (backend) change,
# replace the whole bundle folder instead (keep pb_data/).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="${1:-$ROOT/updates}"
PUB="$ROOT/pb_public"

[ -d "$PUB" ] || { echo "✗ pb_public/ missing — is this the DartsZentrale folder? Run ./start-club-lan.sh first."; exit 1; }

# Determine the package (folder → newest package inside; otherwise the file directly)
if [ -d "$SRC" ]; then
  PKG="$(ls -1t "$SRC"/dartszentrale-update-*.tar.gz 2>/dev/null | head -n1 || true)"
else
  PKG="$SRC"
fi
[ -n "${PKG:-}" ] && [ -f "$PKG" ] || { echo "✗ No update package (dartszentrale-update-*.tar.gz) found in/under: $SRC"; exit 1; }
echo "• Update package: $(basename "$PKG")"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/new"
tar -xzf "$PKG" -C "$TMP/new"
[ -f "$TMP/new/index.html" ] || { echo "✗ Package contains no index.html at the root — wrong package?"; exit 1; }

# Back up the old frontend, swap in the new one atomically
BK="$ROOT/backup"; mkdir -p "$BK"
STAMP="$(date +%Y%m%d-%H%M%S 2>/dev/null || echo old)"
mv "$PUB" "$BK/pb_public-$STAMP"
mv "$TMP/new" "$PUB"
echo "  ✓ pb_public/ updated (old frontend backed up: backup/pb_public-$STAMP)"
echo "  Reloading in the browser is enough — no restart needed."
