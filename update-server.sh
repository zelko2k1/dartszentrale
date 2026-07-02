#!/usr/bin/env bash
# ============================================================================
# DartsZentrale – Update ohne git (Linux / Raspberry Pi / Git Bash)
# [ PRODUKTIV / OPS ] — für den Produktivbetrieb gedacht
# ----------------------------------------------------------------------------
# Übernimmt eine neue App-Version von einem Stick/Ordner in den Projektordner,
# installiert Abhängigkeiten und (optional) baut das Produktions-Bundle.
#
#   ./update-server.sh [QUELLE] [--build]
#     QUELLE  = Ordner mit frischem  app/  und  pocketbase/  (Default: /media/usb)
#     --build = zusätzlich  app/dist  bauen (nur nötig, wenn ihr dist/ ausliefert)
#
# WICHTIG: Dieses Skript im PROJEKTORDNER ausführen (dort wo app/ + pocketbase/
# liegen), NICHT die Kopie auf dem Stick starten.
#
# Wird NIE angefasst (bleibt erhalten):  pb_data/ (Daten) · node_modules/ ·
# app/.env.local (Server-Adresse) · die PocketBase-Binärdatei.
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Argumente -------------------------------------------------------------
SRC=""; DO_BUILD=0
for a in "$@"; do
  case "$a" in
    --build) DO_BUILD=1 ;;
    -*)      echo "✗ Unbekannte Option: $a"; exit 1 ;;
    *)       [ -z "$SRC" ] && SRC="$a" ;;
  esac
done
SRC="${SRC:-/media/usb}"

# Dienst-Modus erkennen: liefert das System die App ueber einen Dienst aus, ist
# ein Build PFLICHT (ausgeliefert wird das gebaute dist/) und der Dienst muss neu
# starten. system = schlanke Cloud-Variante · user = LAN-Autostart · none = Dev/Hand.
SVC_MODE="none"
if [ -f /etc/systemd/system/darts-web.service ]; then
  SVC_MODE="system"
elif [ -f "${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/darts-web.service" ]; then
  SVC_MODE="user"
fi
[ "$SVC_MODE" != "none" ] && DO_BUILD=1

echo "▶ Quelle:      $SRC"
echo "▶ Projektort:  $ROOT"
[ -d "$SRC/app" ] || { echo "✗ '$SRC/app' nicht gefunden – Stick gemountet? Stimmt die QUELLE?"; exit 1; }
[ -d "$ROOT/app" ] || { echo "✗ '$ROOT/app' fehlt – läuft das Skript im Projektordner?"; exit 1; }

# --- Helfer ----------------------------------------------------------------
# Ordner sauber ersetzen (alte Datei-Leichen verschwinden), nur für Code-Ordner.
replace_dir() {  # <quelle> <ziel>
  [ -d "$1" ] || return 0
  rm -rf "$2"
  cp -r "$1" "$2"
  echo "  ✓ $(basename "$2")/"
}
# Einzeldatei überschreiben, falls in der Quelle vorhanden.
copy_file() {    # <quelle> <ziel>
  [ -f "$1" ] && { cp -f "$1" "$2"; echo "  ✓ $(basename "$1")"; } || true
}

# --- 1) Frontend (app/) ----------------------------------------------------
echo "── Frontend aktualisieren (app/) ──"
replace_dir "$SRC/app/src"    "$ROOT/app/src"
replace_dir "$SRC/app/public" "$ROOT/app/public"
for f in package.json package-lock.json index.html vite.config.ts \
         tsconfig.json tsconfig.app.json tsconfig.node.json \
         eslint.config.js serve-dist.mjs Dockerfile nginx.conf .dockerignore; do
  copy_file "$SRC/app/$f" "$ROOT/app/$f"
done

# --- 2) PocketBase (Skripte/Schema/Hooks – NICHT pb_data, NICHT Binary) ----
if [ -d "$SRC/pocketbase" ] && [ -d "$ROOT/pocketbase" ]; then
  echo "── PocketBase aktualisieren (Schema/Hooks/Skripte) ──"
  replace_dir "$SRC/pocketbase/pb_migrations" "$ROOT/pocketbase/pb_migrations"
  replace_dir "$SRC/pocketbase/pb_hooks"      "$ROOT/pocketbase/pb_hooks"
  for mjs in "$SRC"/pocketbase/*.mjs; do [ -f "$mjs" ] && copy_file "$mjs" "$ROOT/pocketbase/$(basename "$mjs")"; done
  PB_TOUCHED=1
else
  PB_TOUCHED=0
fi

# --- 3) Abhängigkeiten + optionaler Build ----------------------------------
echo "── npm install (app/) ──"
( cd "$ROOT/app" && npm install )

if [ "$DO_BUILD" = "1" ]; then
  echo "── npm run build (app/dist) ──"
  ( cd "$ROOT/app" && npm run build )
fi

# --- Abschluss: Dienste neu starten (oder Hinweis) -------------------------
echo
case "$SVC_MODE" in
  system)
    echo "── Cloud-Dienste neu starten (systemd, braucht sudo) ──"
    sudo systemctl restart darts-web
    [ "$PB_TOUCHED" = "1" ] && sudo systemctl restart darts-pocketbase
    echo "✅ Update aktiv — Dienste neu gestartet."
    ;;
  user)
    echo "── Dienste neu starten (systemd --user) ──"
    systemctl --user restart darts-web
    [ "$PB_TOUCHED" = "1" ] && systemctl --user restart darts-pocketbase
    echo "✅ Update aktiv — Dienste neu gestartet."
    ;;
  none)
    echo "✅ Update übernommen."
    echo "   → App NEU STARTEN:  ./start-lan.sh   (oder: npm --prefix app run dev -- --port 5173 --strictPort)"
    [ "$PB_TOUCHED" = "1" ] && echo "   → Schema evtl. geändert: PocketBase NEU STARTEN (Migrations laufen beim Start) – bei Bedarf:  node provision.mjs"
    ;;
esac
echo "   → An den Boards die Seite neu laden (ggf. zweimal, wegen PWA-Cache)."
