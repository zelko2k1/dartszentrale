#!/usr/bin/env bash
# ============================================================================
# DartsZentrale – Update without git (Linux / Raspberry Pi / Git Bash)
# [ PRODUCTION / OPS ] — intended for production operation
# ----------------------------------------------------------------------------
# Takes a new app version from a stick/folder into the project folder,
# installs dependencies and (optionally) builds the production bundle.
#
#   ./update-server.sh [SOURCE] [--build]
#     SOURCE  = folder with a fresh  app/  and  pocketbase/  (default: /media/usb)
#     --build = additionally build  app/dist  (only needed if you serve dist/)
#
# IMPORTANT: Run this script in the PROJECT FOLDER (where app/ + pocketbase/
# live), do NOT start the copy on the stick.
#
# Is NEVER touched (kept as is):  pb_data/ (data) · node_modules/ ·
# app/.env.local (server address) · the PocketBase binary.
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Arguments ---------------------------------------------------------------
SRC=""; DO_BUILD=0
for a in "$@"; do
  case "$a" in
    --build) DO_BUILD=1 ;;
    -*)      echo "✗ Unknown option: $a"; exit 1 ;;
    *)       [ -z "$SRC" ] && SRC="$a" ;;
  esac
done
SRC="${SRC:-/media/usb}"

# Detect service mode: if the system serves the app via a service, a build is
# REQUIRED (the built dist/ is what gets served) and the service must restart.
# system = lean cloud variant · user = LAN autostart · none = dev/manual.
SVC_MODE="none"
if [ -f /etc/systemd/system/darts-web.service ]; then
  SVC_MODE="system"
elif [ -f "${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/darts-web.service" ]; then
  SVC_MODE="user"
fi
[ "$SVC_MODE" != "none" ] && DO_BUILD=1

echo "▶ Source:      $SRC"
echo "▶ Project:     $ROOT"
[ -d "$SRC/app" ] || { echo "✗ '$SRC/app' not found – stick mounted? Is the SOURCE correct?"; exit 1; }
[ -d "$ROOT/app" ] || { echo "✗ '$ROOT/app' missing – is the script running in the project folder?"; exit 1; }

# --- Helpers -----------------------------------------------------------------
# Replace a folder cleanly (stale leftover files disappear), only for code folders.
replace_dir() {  # <source> <target>
  [ -d "$1" ] || return 0
  rm -rf "$2"
  cp -r "$1" "$2"
  echo "  ✓ $(basename "$2")/"
}
# Overwrite a single file if present in the source.
copy_file() {    # <source> <target>
  [ -f "$1" ] && { cp -f "$1" "$2"; echo "  ✓ $(basename "$1")"; } || true
}

# --- 1) Frontend (app/) ------------------------------------------------------
echo "── Updating frontend (app/) ──"
replace_dir "$SRC/app/src"    "$ROOT/app/src"
replace_dir "$SRC/app/public" "$ROOT/app/public"
for f in package.json package-lock.json index.html vite.config.ts \
         tsconfig.json tsconfig.app.json tsconfig.node.json \
         eslint.config.js serve-dist.mjs Dockerfile nginx.conf .dockerignore; do
  copy_file "$SRC/app/$f" "$ROOT/app/$f"
done

# --- 2) PocketBase (scripts/schema/hooks – NOT pb_data, NOT the binary) ------
if [ -d "$SRC/pocketbase" ] && [ -d "$ROOT/pocketbase" ]; then
  echo "── Updating PocketBase (schema/hooks/scripts) ──"
  replace_dir "$SRC/pocketbase/pb_migrations" "$ROOT/pocketbase/pb_migrations"
  replace_dir "$SRC/pocketbase/pb_hooks"      "$ROOT/pocketbase/pb_hooks"
  for mjs in "$SRC"/pocketbase/*.mjs; do [ -f "$mjs" ] && copy_file "$mjs" "$ROOT/pocketbase/$(basename "$mjs")"; done
  PB_TOUCHED=1
else
  PB_TOUCHED=0
fi

# --- 3) Dependencies + optional build ----------------------------------------
echo "── npm install (app/) ──"
( cd "$ROOT/app" && npm install )

if [ "$DO_BUILD" = "1" ]; then
  echo "── npm run build (app/dist) ──"
  ( cd "$ROOT/app" && npm run build )
fi

# --- Finish: restart services (or print a hint) -------------------------------
echo
case "$SVC_MODE" in
  system)
    echo "── Restarting cloud services (systemd, needs sudo) ──"
    sudo systemctl restart darts-web
    [ "$PB_TOUCHED" = "1" ] && sudo systemctl restart darts-pocketbase
    echo "✅ Update active — services restarted."
    ;;
  user)
    echo "── Restarting services (systemd --user) ──"
    systemctl --user restart darts-web
    [ "$PB_TOUCHED" = "1" ] && systemctl --user restart darts-pocketbase
    echo "✅ Update active — services restarted."
    ;;
  none)
    echo "✅ Update applied."
    echo "   → RESTART the frontend (the way it was started): systemd service 'darts-web' or 'node app/serve-dist.mjs'."
    [ "$PB_TOUCHED" = "1" ] && echo "   → Schema may have changed: RESTART PocketBase (migrations run at startup) – if needed:  node provision.mjs"
    ;;
esac
echo "   → Reload the page on the boards (possibly twice, because of the PWA cache)."
