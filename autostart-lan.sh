#!/usr/bin/env bash
# ═══════ [ PRODUKTIV / OPS ] — Linux-Autostart (Vereinsmodus als Daemon) ═══════
# Richtet DartsHub im Vereinsmodus als systemd-USER-Dienste ein:
#   • dartshub-pocketbase.service  → Backend  http://127.0.0.1:8090
#   • dartshub-web.service         → Frontend http://127.0.0.1:4173 (statischer dist-Server)
# Beide starten automatisch beim Boot (via linger), starten bei Absturz neu,
# und loggen nach journald. Idempotent — erneutes Ausführen aktualisiert die Dienste.
#
# Voraussetzung: PocketBase ist einmalig eingerichtet (Superuser + Schema), siehe
# docs/lokaler-betrieb.md → Superuser anlegen + `node provision.mjs`.
#
# Verwaltung danach:
#   systemctl --user status  dartshub-web dartshub-pocketbase
#   journalctl --user -u dartshub-pocketbase -f      # Logs live
#   systemctl --user restart dartshub-web            # nach einem Rebuild (update-server.sh --build)
#   ./autostart-lan-entfernen.sh   (oder: systemctl --user disable --now dartshub-web dartshub-pocketbase)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PB_PORT="${PB_PORT:-8090}"
WEB_PORT="${WEB_PORT:-4173}"
PB_URL="http://127.0.0.1:${PB_PORT}"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

# --- Voraussetzungen ---
command -v systemctl >/dev/null || { echo "✗ systemd (systemctl) nicht gefunden — dieses Skript braucht systemd."; exit 1; }
command -v node >/dev/null      || { echo "✗ Node.js fehlt (https://nodejs.org)"; exit 1; }
NPM_BIN="$(command -v npm)"      || { echo "✗ npm fehlt"; exit 1; }
NODE_DIR="$(dirname "$(command -v node)")"
NODE_BIN="$(command -v node)"
[ -x "$ROOT/pocketbase/pocketbase" ] || { echo "✗ PocketBase-Binary fehlt: $ROOT/pocketbase/pocketbase"; exit 1; }
systemctl --user show-environment >/dev/null 2>&1 || { echo "✗ Keine systemd-User-Session aktiv (systemctl --user). Bei SSH-only ggf. 'loginctl enable-linger' + neu anmelden."; exit 1; }

# --- Frontend gegen die lokale PB bauen (VITE_PB_URL = BUILD-Zeit) ---
if ! grep -q "VITE_PB_URL=" "$ROOT/app/.env.local" 2>/dev/null; then
  echo "VITE_PB_URL=${PB_URL}" > "$ROOT/app/.env.local"
  echo "• app/.env.local angelegt (VITE_PB_URL=${PB_URL})"
fi
[ -d "$ROOT/app/node_modules" ] || { echo "• npm install …"; ( cd "$ROOT/app" && npm install ); }
echo "• Baue Frontend …"; ( cd "$ROOT/app" && npm run build )

# --- Unit-Dateien schreiben ---
mkdir -p "$UNIT_DIR"

cat > "$UNIT_DIR/dartshub-pocketbase.service" <<EOF
[Unit]
Description=DartsHub PocketBase (Vereinsmodus)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${ROOT}/pocketbase
ExecStart=${ROOT}/pocketbase/pocketbase serve --automigrate=0 --http=127.0.0.1:${PB_PORT} --dir=${ROOT}/pocketbase/pb_data --migrationsDir=${ROOT}/pocketbase/pb_migrations --hooksDir=${ROOT}/pocketbase/pb_hooks
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
EOF

cat > "$UNIT_DIR/dartshub-web.service" <<EOF
[Unit]
Description=DartsHub Frontend (statischer dist-Server)
After=dartshub-pocketbase.service
Wants=dartshub-pocketbase.service

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
echo "• Unit-Dateien geschrieben → $UNIT_DIR"

# --- Begleitskript zum Entfernen ---
# Liegt fest im Projekt als ./autostart-lan-entfernen.sh (portabel, ermittelt UNIT_DIR selbst) —
# wird hier nicht mehr generiert, nur ausführbar gemacht, falls das Exec-Bit fehlt.
[ -f "$ROOT/autostart-lan-entfernen.sh" ] && chmod +x "$ROOT/autostart-lan-entfernen.sh" 2>/dev/null || true

# --- Aktivieren + beim Boot starten (ohne Login) ---
systemctl --user daemon-reload
systemctl --user enable --now dartshub-pocketbase.service dartshub-web.service
loginctl enable-linger "$USER" 2>/dev/null && echo "• Autostart beim Boot aktiviert (linger)" \
  || echo "⚠ 'loginctl enable-linger $USER' nicht möglich — Dienste starten dann erst nach dem Login."

echo
echo "✅ DartsHub-Vereinsmodus läuft als Dienst:"
echo "   Backend  : ${PB_URL}"
echo "   Frontend : http://127.0.0.1:${WEB_PORT}"
echo "   Status   : systemctl --user status dartshub-web dartshub-pocketbase"
echo "   Logs     : journalctl --user -u dartshub-pocketbase -f"
echo "   Entfernen: ./autostart-lan-entfernen.sh"
echo
echo "ℹ Falls noch nicht geschehen: PocketBase einmalig einrichten (Superuser + Schema):"
echo "   cd pocketbase && ./pocketbase superuser upsert <mail> '<pw>' --dir ./pb_data && node provision.mjs"
echo "ℹ Mehrere Geräte/Boards im LAN? Dann VITE_PB_URL auf die LAN-IP setzen, neu bauen,"
echo "   in der PB-Unit --http=127.0.0.1 → 0.0.0.0 und in der Web-Unit 'Environment=HOST=0.0.0.0' setzen."
