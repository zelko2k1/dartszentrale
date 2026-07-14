#!/usr/bin/env bash
# ═══════ DartsZentrale — Update (Vereinsmodus LAN, Single-Binary) ═══════
# Tauscht das Frontend in pb_public/ aus dem Update-Paket (dartszentrale-update-*.tar.gz).
# Kein Node, kein Neustart — PocketBase liefert die neuen Dateien sofort aus; im Browser neu laden
# genügt. pb_data/ (deine DB) bleibt unangetastet. Das alte Frontend wird nach backup/ gesichert.
#
#   ./update-verein-lan.sh                       # nimmt das neueste Paket in updates/
#   ./update-verein-lan.sh /pfad/paket.tar.gz    # bestimmtes Paket
#   ./update-verein-lan.sh /media/usb            # Ordner mit dem Paket
#
# Hinweis: Das Paket enthält NUR das Frontend. Ändern sich Migrationen/Hooks (Backend), dann
# stattdessen den kompletten Bundle-Ordner tauschen (pb_data/ behalten).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="${1:-$ROOT/updates}"
PUB="$ROOT/pb_public"

[ -d "$PUB" ] || { echo "✗ pb_public/ fehlt — ist das der DartsZentrale-Ordner? Zuerst ./start-verein-lan.sh ausführen."; exit 1; }

# Paket ermitteln (Ordner → neuestes Paket darin; sonst direkt die Datei)
if [ -d "$SRC" ]; then
  PKG="$(ls -1t "$SRC"/dartszentrale-update-*.tar.gz 2>/dev/null | head -n1 || true)"
else
  PKG="$SRC"
fi
[ -n "${PKG:-}" ] && [ -f "$PKG" ] || { echo "✗ Kein Update-Paket (dartszentrale-update-*.tar.gz) gefunden in/unter: $SRC"; exit 1; }
echo "• Update-Paket: $(basename "$PKG")"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/new"
tar -xzf "$PKG" -C "$TMP/new"
[ -f "$TMP/new/index.html" ] || { echo "✗ Paket enthält kein index.html an der Wurzel — falsches Paket?"; exit 1; }

# Altes Frontend sichern, neues atomar einsetzen
BK="$ROOT/backup"; mkdir -p "$BK"
STAMP="$(date +%Y%m%d-%H%M%S 2>/dev/null || echo alt)"
mv "$PUB" "$BK/pb_public-$STAMP"
mv "$TMP/new" "$PUB"
echo "  ✓ pb_public/ aktualisiert (altes Frontend gesichert: backup/pb_public-$STAMP)"
echo "  Im Browser neu laden genügt — kein Neustart nötig."
