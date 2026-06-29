#!/usr/bin/env bash
# ═══════ [ PRODUKTIV / OPS ] — Cloud-Deploy OHNE Coolify & OHNE Docker ═══════
# Schlanke Variante: zwei native systemd-System-Dienste + Caddy als HTTPS-Reverse-Proxy.
#
#   • dartshub-pocketbase.service  → PocketBase-Binary, lauscht NUR auf 127.0.0.1:8090
#   • dartshub-web.service         → node serve-dist.mjs, lauscht NUR auf 127.0.0.1:4173
#   • Caddy                        → 80/443 öffentlich, Auto-HTTPS (Let's Encrypt),
#                                    routet  app.<domain> → :4173  und  db.<domain> → :8090
#
# Kein Docker, kein Coolify, kein nginx. Läuft auf einem 1–2-GB-Nano (Ubuntu/Debian).
#
# AUFRUF (als root / mit sudo, weil Pakete + /etc/systemd + /etc/caddy geschrieben werden):
#   sudo APP_DOMAIN=app.deinedomain.de DB_DOMAIN=db.deinedomain.de \
#        deploy/cloud-schlank/setup.sh
#
# Optional vorab als Env-Variablen:
#   RUN_USER=<user>     Besitzer der Dienste (Default: Repo-Eigentümer / SUDO_USER)
#   PB_VERSION=0.39.4   PocketBase-Version (Default unten)
#   PB_PORT=8090  WEB_PORT=4173   interne Ports (selten nötig)
#   ACME_EMAIL=you@x.de  E-Mail für Let's-Encrypt-Benachrichtigungen (optional)
#
# Idempotent: erneutes Ausführen aktualisiert Build, Units und Caddyfile.
set -euo pipefail

# ── Parameter ───────────────────────────────────────────────────────────────
APP_DOMAIN="${APP_DOMAIN:-}"
DB_DOMAIN="${DB_DOMAIN:-}"
PB_VERSION="${PB_VERSION:-0.39.4}"
PB_PORT="${PB_PORT:-8090}"
WEB_PORT="${WEB_PORT:-4173}"
ACME_EMAIL="${ACME_EMAIL:-}"

[ "$(id -u)" -eq 0 ] || { echo "✗ Bitte mit sudo/als root ausführen (installiert Pakete + Dienste)."; exit 1; }
[ -n "$APP_DOMAIN" ] && [ -n "$DB_DOMAIN" ] || {
  echo "✗ APP_DOMAIN und DB_DOMAIN müssen gesetzt sein."
  echo "  Beispiel: sudo APP_DOMAIN=app.deinedomain.de DB_DOMAIN=db.deinedomain.de $0"
  exit 1
}

# Repo-Wurzel = zwei Ebenen über diesem Skript (deploy/cloud-schlank/ → ROOT).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN_USER="${RUN_USER:-${SUDO_USER:-$(stat -c %U "$ROOT")}}"
id "$RUN_USER" >/dev/null 2>&1 || { echo "✗ RUN_USER '$RUN_USER' existiert nicht."; exit 1; }
RUN_GROUP="$(id -gn "$RUN_USER")"
PB_URL_PUBLIC="https://${DB_DOMAIN}"

echo "▶ DartsHub schlankes Cloud-Setup (ohne Coolify/Docker)"
echo "  Repo        : $ROOT"
echo "  Dienst-User : $RUN_USER:$RUN_GROUP"
echo "  App-Domain  : $APP_DOMAIN  →  127.0.0.1:${WEB_PORT}"
echo "  DB-Domain   : $DB_DOMAIN  →  127.0.0.1:${PB_PORT}"
echo

# ── 1) Pakete: Node.js, Caddy, unzip ────────────────────────────────────────
echo "• Pakete prüfen/installieren …"
export DEBIAN_FRONTEND=noninteractive
command -v unzip >/dev/null || apt-get install -y unzip >/dev/null

if ! command -v node >/dev/null; then
  echo "  – Node.js fehlt → NodeSource (22.x) einrichten …"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y nodejs >/dev/null
fi
NODE_BIN="$(command -v node)"; NODE_DIR="$(dirname "$NODE_BIN")"
echo "  – Node $($NODE_BIN -v)"

if ! command -v caddy >/dev/null; then
  echo "  – Caddy fehlt → offizielles apt-Repo einrichten …"
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl >/dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y >/dev/null
  apt-get install -y caddy >/dev/null
fi
echo "  – $(caddy version | head -n1)"

# ── 2) PocketBase-Binary holen (falls nicht vorhanden) ──────────────────────
PB_BIN="$ROOT/pocketbase/pocketbase"
if [ ! -x "$PB_BIN" ]; then
  case "$(uname -m)" in
    x86_64|amd64) PB_ARCH=linux_amd64 ;;
    aarch64|arm64) PB_ARCH=linux_arm64 ;;
    *) echo "✗ Unbekannte CPU-Architektur $(uname -m) — PocketBase manuell ablegen."; exit 1 ;;
  esac
  echo "• PocketBase $PB_VERSION ($PB_ARCH) herunterladen …"
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/pb.zip" \
    "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${PB_ARCH}.zip"
  unzip -o "$tmp/pb.zip" pocketbase -d "$ROOT/pocketbase" >/dev/null
  chmod +x "$PB_BIN"; chown "$RUN_USER:$RUN_GROUP" "$PB_BIN"
  rm -rf "$tmp"
fi
echo "• PocketBase: $("$PB_BIN" --version 2>/dev/null || echo vorhanden)"

# ── 3) Frontend bauen (VITE_PB_URL = öffentliche DB-Domain, Build-Zeit!) ────
echo "• Frontend bauen (VITE_PB_URL=${PB_URL_PUBLIC}) …"
echo "VITE_PB_URL=${PB_URL_PUBLIC}" > "$ROOT/app/.env.local"
chown "$RUN_USER:$RUN_GROUP" "$ROOT/app/.env.local"
# Build als der Dienst-User (sonst gehört node_modules/dist root).
sudo -u "$RUN_USER" bash -lc "cd '$ROOT/app' && { [ -d node_modules ] || npm ci; } && npm run build"

# ── 4) systemd-System-Units schreiben ───────────────────────────────────────
echo "• systemd-Units schreiben …"
cat > /etc/systemd/system/dartshub-pocketbase.service <<EOF
[Unit]
Description=DartsHub PocketBase (Vereinsmodus, hinter Caddy)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${RUN_USER}
Group=${RUN_GROUP}
WorkingDirectory=${ROOT}/pocketbase
# NUR lokal lauschen — Caddy terminiert TLS und reicht durch. Port 8090 ist NICHT öffentlich.
# --origins schränkt CORS auf die App-Domain ein (Default wäre '*' = jede Website).
ExecStart=${ROOT}/pocketbase/pocketbase serve --http=127.0.0.1:${PB_PORT} --origins=https://${APP_DOMAIN} --dir=${ROOT}/pocketbase/pb_data --migrationsDir=${ROOT}/pocketbase/pb_migrations --hooksDir=${ROOT}/pocketbase/pb_hooks
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/dartshub-web.service <<EOF
[Unit]
Description=DartsHub Frontend (statischer dist-Server, hinter Caddy)
After=dartshub-pocketbase.service
Wants=dartshub-pocketbase.service

[Service]
Type=simple
User=${RUN_USER}
Group=${RUN_GROUP}
WorkingDirectory=${ROOT}/app
Environment=PATH=${NODE_DIR}:/usr/local/bin:/usr/bin:/bin
# NUR lokal lauschen — nur Caddy spricht diesen Port an.
Environment=HOST=127.0.0.1
Environment=PORT=${WEB_PORT}
ExecStart=${NODE_BIN} ${ROOT}/app/serve-dist.mjs
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
EOF

# ── 5) Caddyfile schreiben (Auto-HTTPS) ─────────────────────────────────────
echo "• Caddyfile schreiben …"
{
  [ -n "$ACME_EMAIL" ] && printf '{\n\temail %s\n}\n\n' "$ACME_EMAIL"
  cat <<EOF
# DartsHub — von deploy/cloud-schlank/setup.sh erzeugt. Caddy holt/erneuert die
# Let's-Encrypt-Zertifikate automatisch (Ports 80+443 müssen offen sein).

# Basis-Security-Header (Pendant zu app/nginx.conf, Befund #9/#13). HSTS aktiv,
# weil Caddy ausschließlich über HTTPS ausliefert.
(security_headers) {
	header {
		Strict-Transport-Security "max-age=63072000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "camera=(), microphone=(), geolocation=()"
		-Server
	}
}

${APP_DOMAIN} {
	encode zstd gzip
	import security_headers
	header X-Frame-Options "DENY"

	# Content-Security-Policy — ERST nach Test einkommentieren (connect-src ist
	# bereits auf https://${DB_DOMAIN} gesetzt). Bricht sonst ggf. API/PWA.
	# header Content-Security-Policy "default-src 'self'; connect-src 'self' https://${DB_DOMAIN}; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"

	reverse_proxy 127.0.0.1:${WEB_PORT}
}

${DB_DOMAIN} {
	encode zstd gzip
	import security_headers
	header X-Frame-Options "SAMEORIGIN"
	reverse_proxy 127.0.0.1:${PB_PORT}
}
EOF
} > /etc/caddy/Caddyfile

# ── 6) Aktivieren + starten ─────────────────────────────────────────────────
echo "• Dienste aktivieren + starten …"
systemctl daemon-reload
systemctl enable --now dartshub-pocketbase.service dartshub-web.service
caddy validate --config /etc/caddy/Caddyfile >/dev/null
systemctl reload caddy 2>/dev/null || systemctl restart caddy
systemctl enable caddy >/dev/null 2>&1 || true

echo
echo "✅ Dienste laufen:"
echo "   PocketBase : http://127.0.0.1:${PB_PORT}   (öffentlich via https://${DB_DOMAIN})"
echo "   Frontend   : http://127.0.0.1:${WEB_PORT}   (öffentlich via https://${APP_DOMAIN})"
echo "   Status     : systemctl status dartshub-web dartshub-pocketbase caddy"
echo "   Logs       : journalctl -u dartshub-pocketbase -f"
echo
echo "➡ NÄCHSTE SCHRITTE (einmalig):"
echo "   1) DNS: app.* und db.* müssen auf diese Server-IP zeigen (A-Records)."
echo "   2) Firewall: Ports 80 + 443 offen (für Caddy/HTTPS). 8090/4173 NICHT öffnen."
echo "   3) PocketBase-Superuser + Schema anlegen:"
echo "        cd '$ROOT/pocketbase'"
echo "        ./pocketbase superuser upsert <admin-mail> '<starkes-pw>' --dir ./pb_data"
echo "        sudo -u $RUN_USER node provision.mjs    # legt Schema + ersten App-Admin an"
echo "   4) In PocketBase ( https://${DB_DOMAIN}/_/ ) → Settings:"
echo "        Application URL = https://${DB_DOMAIN}"
echo "        (CORS ist bereits via --origins=https://${APP_DOMAIN} in der Unit gesetzt.)"
echo "   5) Optional härten: /_/ in Caddy auf deine IP sperren + CSP einkommentieren"
echo "        → docs/cloud-schlank-anleitung.md, Abschnitt Sicherheit."
echo
echo "ℹ Frontend nach Code-Update neu bauen + Web-Dienst neu starten:"
echo "   sudo -u $RUN_USER bash -lc \"cd '$ROOT/app' && npm run build\" && sudo systemctl restart dartshub-web"
