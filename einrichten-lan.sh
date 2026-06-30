#!/usr/bin/env bash
# ═══════ [ PRODUKTIV / OPS ] — Geführte Vereinsmodus-Einrichtung im LAN (Linux/Pi) ═══════
# Richtet DartsHub auf DIESEM Rechner komplett ein — ein Befehl, mit Abfragen,
# bis alles läuft inkl. erstem App-Admin:
#   • lädt das PocketBase-Binary (falls nicht vorhanden)
#   • baut das Frontend (mit der richtigen Server-Adresse)
#   • legt PocketBase als systemd-User-Dienst an (Autostart, Auto-Restart)
#   • legt Frontend als systemd-User-Dienst an
#   • legt Superuser + Schema + ersten App-Admin an
#
# AUFRUF (im Projektordner, NICHT als root):  ./einrichten-lan.sh
# Voraussetzung: Node.js ist installiert (node -v). PocketBase wird automatisch geladen.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PB_PORT="${PB_PORT:-8090}"
WEB_PORT="${WEB_PORT:-4173}"
PB_VERSION="${PB_VERSION:-0.39.5}"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
PB_BIN="$ROOT/pocketbase/pocketbase"

# Vorbelegbar per Env:
SU_EMAIL="${PB_SU_EMAIL:-}"; SU_PASS="${PB_SU_PASS:-}"
ADMIN_EMAIL="${APP_ADMIN_EMAIL:-}"; ADMIN_PASS="${APP_ADMIN_PASS:-}"

[ "$(id -u)" -ne 0 ] || { echo "✗ Bitte NICHT als root starten — als normaler Benutzer ausführen (systemd-User-Dienste)."; exit 1; }

# ── Eingabe-Helfer ──────────────────────────────────────────────────────────
ask() { local p="$1" __v="$2" def="${3:-}" ans=""; read -rp "$p" ans || true; printf -v "$__v" '%s' "${ans:-$def}"; }
ask_secret() { local p="$1" __v="$2" a b
  while :; do
    read -rsp "$p" a; echo; read -rsp "  wiederholen:          " b; echo
    [ -n "$a" ] || { echo "  ✗ darf nicht leer sein."; continue; }
    [ "$a" = "$b" ] || { echo "  ✗ stimmt nicht überein."; continue; }
    break
  done
  printf -v "$__v" '%s' "$a"
}

# ── Voraussetzungen ─────────────────────────────────────────────────────────
command -v node >/dev/null      || { echo "✗ Node.js fehlt — bitte installieren (siehe docs/admin-anleitung-linux.md, 0b)."; exit 1; }
command -v systemctl >/dev/null  || { echo "✗ systemd (systemctl) nicht gefunden."; exit 1; }
systemctl --user show-environment >/dev/null 2>&1 || { echo "✗ Keine systemd-User-Session aktiv. Bei SSH-only: 'loginctl enable-linger $USER' + neu anmelden."; exit 1; }
NODE_BIN="$(command -v node)"; NODE_DIR="$(dirname "$NODE_BIN")"

# ── 0) Abfragen (vorab sammeln) ─────────────────────────────────────────────
echo "── Sollen ANDERE Geräte im Netz (Bretter/Tablets) auf diesen Server zugreifen? ──"
ask "  [J] = Vereinsmodus im LAN (empfohlen)   [n] = nur dieser Rechner : " LANMODE "J"
case "$LANMODE" in
  [nN]*) BIND="127.0.0.1"; SRV_HOST="127.0.0.1" ;;
  *)     BIND="0.0.0.0"
         GUESS="$(hostname -I 2>/dev/null | awk '{print $1}')"
         ask "  Server-IP im Netz (Enter = ${GUESS:-?}): " SRV_HOST "$GUESS"
         [ -n "$SRV_HOST" ] || { echo "✗ Keine Server-IP — bitte erneut starten und IP angeben."; exit 1; }
         ;;
esac
PB_URL_LOCAL="http://127.0.0.1:${PB_PORT}"     # für Skript-Zugriff/Health
VITE_PB_URL="http://${SRV_HOST}:${PB_PORT}"    # was die Bretter ansprechen

echo "── PocketBase-Superuser (verwaltet die Datenbank unter /_/) ──"
[ -n "$SU_EMAIL" ]    || ask        "  Superuser-E-Mail:     " SU_EMAIL "admin@dartshub.local"
[ -n "$SU_PASS" ]     || ask_secret "  Superuser-Passwort:   " SU_PASS
echo "── Erster App-Admin (dein Login IN der App) ──"
[ -n "$ADMIN_EMAIL" ] || ask        "  App-Admin-E-Mail:     " ADMIN_EMAIL
[ -n "$ADMIN_PASS" ]  || ask_secret "  App-Admin-Passwort:   " ADMIN_PASS

echo
echo "▶ Einrichtung startet — Server-Bindung: ${BIND}, Bretter erreichen: ${VITE_PB_URL}"
echo

# ── 1) PocketBase-Binary holen (falls nicht vorhanden) ──────────────────────
if [ ! -x "$PB_BIN" ]; then
  case "$(uname -m)" in
    x86_64|amd64)  PB_ARCH=linux_amd64 ;;
    aarch64|arm64) PB_ARCH=linux_arm64 ;;
    armv7l|armhf)  PB_ARCH=linux_armv7 ;;
    *) echo "✗ Unbekannte CPU $(uname -m) — PocketBase manuell nach pocketbase/ legen."; exit 1 ;;
  esac
  command -v unzip >/dev/null || { echo "✗ 'unzip' fehlt (sudo apt install unzip)."; exit 1; }
  echo "• PocketBase $PB_VERSION ($PB_ARCH) herunterladen …"
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/pb.zip" \
    "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${PB_ARCH}.zip"
  unzip -o "$tmp/pb.zip" pocketbase -d "$ROOT/pocketbase" >/dev/null
  chmod +x "$PB_BIN"; rm -rf "$tmp"
fi
echo "• PocketBase: $("$PB_BIN" --version 2>/dev/null || echo vorhanden)"

# ── 2) Frontend bauen (VITE_PB_URL = Build-Zeit!) ───────────────────────────
echo "• Frontend bauen (VITE_PB_URL=${VITE_PB_URL}) …"
echo "VITE_PB_URL=${VITE_PB_URL}" > "$ROOT/app/.env.local"
( cd "$ROOT/app" && { [ -d node_modules ] || npm install; } && npm run build )

# ── 3) Superuser anlegen (offline, BEVOR der Dienst die DB öffnet) ──────────
echo "• PocketBase-Superuser anlegen/aktualisieren …"
"$PB_BIN" superuser upsert "$SU_EMAIL" "$SU_PASS" --dir "$ROOT/pocketbase/pb_data" >/dev/null

# ── 4) systemd-User-Units schreiben ─────────────────────────────────────────
echo "• systemd-User-Dienste einrichten …"
mkdir -p "$UNIT_DIR"
cat > "$UNIT_DIR/dartshub-pocketbase.service" <<EOF
[Unit]
Description=DartsHub PocketBase (Vereinsmodus)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${ROOT}/pocketbase
ExecStart=${PB_BIN} serve --automigrate=0 --http=${BIND}:${PB_PORT} --dir=${ROOT}/pocketbase/pb_data --migrationsDir=${ROOT}/pocketbase/pb_migrations --hooksDir=${ROOT}/pocketbase/pb_hooks
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
Environment=HOST=${BIND}
Environment=PORT=${WEB_PORT}
ExecStart=${NODE_BIN} ${ROOT}/app/serve-dist.mjs
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now dartshub-pocketbase.service dartshub-web.service
loginctl enable-linger "$USER" >/dev/null 2>&1 && echo "• Autostart beim Boot aktiv (linger)" \
  || echo "⚠ 'loginctl enable-linger $USER' nicht möglich — Dienste starten erst nach Login."

# ── 5) Warten + Schema/Admin (provision.mjs) ────────────────────────────────
echo "• Warte auf PocketBase …"
ok=""
for _ in $(seq 1 30); do
  curl -fsS "${PB_URL_LOCAL}/api/health" >/dev/null 2>&1 && { ok=1; break; }
  sleep 1
done
[ "$ok" = "1" ] || { echo "✗ PocketBase nicht erreichbar — Logs: journalctl --user -u dartshub-pocketbase -e"; exit 1; }

echo "• Schema + erster App-Admin (provision.mjs) …"
( cd "$ROOT/pocketbase" && \
  PB_URL="$PB_URL_LOCAL" PB_SU_EMAIL="$SU_EMAIL" PB_SU_PASS="$SU_PASS" \
  APP_ADMIN_EMAIL="$ADMIN_EMAIL" APP_ADMIN_PASS="$ADMIN_PASS" node provision.mjs )

echo
echo "✅ DartsHub-Vereinsmodus läuft:"
echo "   App im Browser :  http://${SRV_HOST}:${WEB_PORT}    (an den Brettern diese Adresse öffnen)"
echo "   PocketBase-UI  :  http://${SRV_HOST}:${PB_PORT}/_/"
echo "   Status         :  systemctl --user status dartshub-web dartshub-pocketbase"
echo "   Logs           :  journalctl --user -u dartshub-pocketbase -f"
echo
echo "ℹ Beim ersten App-Aufruf 'Vereinsmodus' wählen und mit dem App-Admin anmelden."
echo "ℹ Update später:  ./update-server.sh <stick>   (erkennt die Dienste, baut neu, startet neu)."
[ "$BIND" = "0.0.0.0" ] && echo "ℹ LAN: ggf. Firewall für Ports ${PB_PORT} und ${WEB_PORT} öffnen (z. B. 'sudo ufw allow ${PB_PORT},${WEB_PORT}/tcp')."
