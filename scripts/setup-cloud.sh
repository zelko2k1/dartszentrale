#!/usr/bin/env bash
# ═══════ [ PRODUCTION / OPS ] — Cloud deploy WITHOUT Docker (systemd + Caddy) ═══════
# Lean variant: two native systemd system services + Caddy as HTTPS reverse proxy.
#
#   • darts-pocketbase.service  → PocketBase binary, listens ONLY on 127.0.0.1:8090
#   • darts-web.service         → node serve-dist.mjs, listens ONLY on 127.0.0.1:4173
#   • Caddy                        → 80/443 public, auto-HTTPS (Let's Encrypt),
#                                    routes  app.<domain> → :4173  and  db.<domain> → :8090
#
# No Docker, no nginx. Runs on a 1–2 GB nano instance (Ubuntu/Debian).
#
# USAGE (as root / with sudo — installs packages + services). The script PROMPTS for
# everything it needs interactively; inputs can also be pre-set as env variables:
#   sudo ./setup-cloud.sh                              # fully guided (recommended)
#   sudo APP_DOMAIN=app.x.com DB_DOMAIN=db.x.com ./setup-cloud.sh   # partially pre-set
#
# Optional env variables:
#   RUN_USER, PB_VERSION, PB_PORT, WEB_PORT, ACME_EMAIL
#   PB_SU_EMAIL/PB_SU_PASS (superuser), APP_ADMIN_EMAIL/APP_ADMIN_PASS (first app admin)
#
# Idempotent: running it again refreshes the build, units and Caddyfile.
set -euo pipefail

# ── Parameters ──────────────────────────────────────────────────────────────
APP_DOMAIN="${APP_DOMAIN:-}"
DB_DOMAIN="${DB_DOMAIN:-}"
PB_VERSION="${PB_VERSION:-0.39.5}"
PB_PORT="${PB_PORT:-8090}"
WEB_PORT="${WEB_PORT:-4173}"
ACME_EMAIL="${ACME_EMAIL:-}"
SU_EMAIL="${PB_SU_EMAIL:-}"; SU_PASS="${PB_SU_PASS:-}"
ADMIN_EMAIL="${APP_ADMIN_EMAIL:-}"; ADMIN_PASS="${APP_ADMIN_PASS:-}"

[ "$(id -u)" -eq 0 ] || { echo "✗ Please run with sudo/as root (installs packages + services)."; exit 1; }

IS_TTY=0; [ -t 0 ] && IS_TTY=1

# ── Input helpers ───────────────────────────────────────────────────────────
ask() { # <prompt> <varname> [default]
  local p="$1" __v="$2" def="${3:-}" ans=""
  [ "$IS_TTY" = "1" ] && read -rp "$p" ans || true
  printf -v "$__v" '%s' "${ans:-$def}"
}
ask_secret() { # <prompt> <varname>  (hidden, with confirmation)
  local p="$1" __v="$2" a b
  while :; do
    read -rsp "$p" a; echo
    read -rsp "  repeat:               " b; echo
    [ -n "$a" ] || { echo "  ✗ must not be empty."; continue; }
    [ "$a" = "$b" ] || { echo "  ✗ does not match."; continue; }
    break
  done
  printf -v "$__v" '%s' "$a"
}

# Project/bundle root = the folder containing app/ AND pocketbase/ (walking up from the script location).
# This way the script works whether it sits in the repo root or directly in the distribution bundle.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
while [ "$ROOT" != "/" ] && ! { [ -d "$ROOT/app" ] && [ -d "$ROOT/pocketbase" ]; }; do ROOT="$(dirname "$ROOT")"; done
[ -d "$ROOT/app" ] && [ -d "$ROOT/pocketbase" ] || { echo "✗ app/ + pocketbase/ not found — place the script in the project/bundle folder."; exit 1; }
RUN_USER="${RUN_USER:-${SUDO_USER:-$(stat -c %U "$ROOT")}}"
id "$RUN_USER" >/dev/null 2>&1 || { echo "✗ RUN_USER '$RUN_USER' does not exist."; exit 1; }
RUN_GROUP="$(id -gn "$RUN_USER")"

# ── 0) Collect ALL inputs UP FRONT (everything runs unattended afterwards) ──
if [ -z "$APP_DOMAIN" ] || [ -z "$DB_DOMAIN" ]; then
  [ "$IS_TTY" = "1" ] || { echo "✗ APP_DOMAIN/DB_DOMAIN not set and no interactive input possible."; exit 1; }
  echo "── Domains (the A records must already point to this server's IP) ──"
  [ -n "$APP_DOMAIN" ] || ask "  App domain (e.g. app.yourdomain.com): " APP_DOMAIN
  [ -n "$DB_DOMAIN" ]  || ask "  DB domain  (e.g. db.yourdomain.com):  " DB_DOMAIN
  [ -n "$ACME_EMAIL" ] || ask "  Email for Let's Encrypt (optional, Enter to skip): " ACME_EMAIL
fi
[ -n "$APP_DOMAIN" ] && [ -n "$DB_DOMAIN" ] || { echo "✗ App and DB domain are required."; exit 1; }
PB_URL_PUBLIC="https://${DB_DOMAIN}"
PB_URL_LOCAL="http://127.0.0.1:${PB_PORT}"

# Accounts: create them if credentials come via env OR the user confirms interactively.
DO_ACCOUNTS=0
if [ -n "$SU_EMAIL$SU_PASS$ADMIN_EMAIL$ADMIN_PASS" ]; then
  DO_ACCOUNTS=1
elif [ "$IS_TTY" = "1" ]; then
  ask "── Create superuser + first app admin now? [Y/n]: " _acc "Y"
  case "$_acc" in [nN]*) DO_ACCOUNTS=0 ;; *) DO_ACCOUNTS=1 ;; esac
fi
if [ "$DO_ACCOUNTS" = "1" ]; then
  echo "── PocketBase superuser (manages the database at /_/) ──"
  [ -n "$SU_EMAIL" ]   || ask        "  Superuser email:      " SU_EMAIL "admin@${DB_DOMAIN}"
  [ -n "$SU_PASS" ]    || ask_secret "  Superuser password:   " SU_PASS
  echo "── First app admin (your login INSIDE the app) ──"
  [ -n "$ADMIN_EMAIL" ]|| ask        "  App admin email:      " ADMIN_EMAIL
  [ -n "$ADMIN_PASS" ] || ask_secret "  App admin password:   " ADMIN_PASS
fi

echo
echo "▶ DartsZentrale lean cloud setup (without Docker)"
echo "  Repo         : $ROOT"
echo "  Service user : $RUN_USER:$RUN_GROUP"
echo "  App domain   : $APP_DOMAIN  →  127.0.0.1:${WEB_PORT}"
echo "  DB domain    : $DB_DOMAIN  →  127.0.0.1:${PB_PORT}"
echo "  Accounts     : $([ "$DO_ACCOUNTS" = 1 ] && echo "will be created" || echo "manually later")"
echo

# ── 1) Packages: Node.js, Caddy, unzip ──────────────────────────────────────
echo "• Checking/installing packages …"
export DEBIAN_FRONTEND=noninteractive
command -v curl >/dev/null || apt-get install -y curl >/dev/null
command -v unzip >/dev/null || apt-get install -y unzip >/dev/null

if ! command -v node >/dev/null; then
  echo "  – Node.js missing → setting up NodeSource (24.x) …"
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash - >/dev/null
  apt-get install -y nodejs >/dev/null
fi
NODE_BIN="$(command -v node)"; NODE_DIR="$(dirname "$NODE_BIN")"
echo "  – Node $($NODE_BIN -v)"

if ! command -v caddy >/dev/null; then
  echo "  – Caddy missing → setting up the official apt repo …"
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl >/dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y >/dev/null
  apt-get install -y caddy >/dev/null
fi
echo "  – $(caddy version | head -n1)"

# ── 2) Fetch the PocketBase binary (if not present) ─────────────────────────
PB_BIN="$ROOT/pocketbase/pocketbase"
if [ ! -x "$PB_BIN" ]; then
  case "$(uname -m)" in
    x86_64|amd64) PB_ARCH=linux_amd64 ;;
    aarch64|arm64) PB_ARCH=linux_arm64 ;;
    *) echo "✗ Unknown CPU architecture $(uname -m) — place the PocketBase binary manually."; exit 1 ;;
  esac
  echo "• Downloading PocketBase $PB_VERSION ($PB_ARCH) …"
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/pb.zip" \
    "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${PB_ARCH}.zip"
  unzip -o "$tmp/pb.zip" pocketbase -d "$ROOT/pocketbase" >/dev/null
  chmod +x "$PB_BIN"; chown "$RUN_USER:$RUN_GROUP" "$PB_BIN"
  rm -rf "$tmp"
fi
echo "• PocketBase: $("$PB_BIN" --version 2>/dev/null || echo present)"

# ── 3) Build the frontend (VITE_PB_URL = public DB domain, build time!) ─────
echo "• Building frontend (VITE_PB_URL=${PB_URL_PUBLIC}) …"
echo "VITE_PB_URL=${PB_URL_PUBLIC}" > "$ROOT/app/.env.local"
chown "$RUN_USER:$RUN_GROUP" "$ROOT/app/.env.local"
# Build as the service user (otherwise node_modules/dist would belong to root).
sudo -u "$RUN_USER" bash -lc "cd '$ROOT/app' && { [ -d node_modules ] || npm ci; } && npm run build"

# ── 4) Write systemd system units ───────────────────────────────────────────
echo "• Writing systemd units …"
cat > /etc/systemd/system/darts-pocketbase.service <<EOF
[Unit]
Description=DartsZentrale PocketBase (club mode, behind Caddy)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${RUN_USER}
Group=${RUN_GROUP}
WorkingDirectory=${ROOT}/pocketbase
# Listen ONLY locally — Caddy terminates TLS and proxies through. Port 8090 is NOT public.
# --origins restricts CORS to the app domain (the default would be '*' = any website).
ExecStart=${ROOT}/pocketbase/pocketbase serve --automigrate=0 --http=127.0.0.1:${PB_PORT} --origins=https://${APP_DOMAIN} --dir=${ROOT}/pocketbase/pb_data --migrationsDir=${ROOT}/pocketbase/pb_migrations --hooksDir=${ROOT}/pocketbase/pb_hooks
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/darts-web.service <<EOF
[Unit]
Description=DartsZentrale frontend (static dist server, behind Caddy)
After=darts-pocketbase.service
Wants=darts-pocketbase.service

[Service]
Type=simple
User=${RUN_USER}
Group=${RUN_GROUP}
WorkingDirectory=${ROOT}/app
Environment=PATH=${NODE_DIR}:/usr/local/bin:/usr/bin:/bin
# Listen ONLY locally — only Caddy talks to this port.
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

# ── 5) Write Caddyfile (auto-HTTPS) ─────────────────────────────────────────
echo "• Writing Caddyfile …"
{
  [ -n "$ACME_EMAIL" ] && printf '{\n\temail %s\n}\n\n' "$ACME_EMAIL"
  cat <<EOF
# DartsZentrale — generated by setup-cloud.sh. Caddy obtains/renews the
# Let's Encrypt certificates automatically (ports 80+443 must be open).

# Basic security headers (finding #9/#13) — Caddy sets them in cloud mode.
# (app/nginx.conf is only the Arcane/Docker homelab/dev counterpart.) HSTS is on
# because Caddy serves exclusively over HTTPS.
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

	# #9 Content-Security-Policy — only uncomment AFTER testing (connect-src is
	# already set to https://${DB_DOMAIN}). Otherwise it may break API/PWA.
	# header Content-Security-Policy "default-src 'self'; connect-src 'self' https://${DB_DOMAIN}; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"

	reverse_proxy 127.0.0.1:${WEB_PORT}
}

${DB_DOMAIN} {
	encode zstd gzip
	import security_headers
	header X-Frame-Options "SAMEORIGIN"

	# Default: proxy everything through.
	reverse_proxy 127.0.0.1:${PB_PORT}

	# ── (recommended, security audit #5) Shield the admin console /_/ ─────────
	# To enable: comment out the reverse_proxy line above and uncomment the block
	# below. Find your IP via 'curl ifconfig.me' (/32 = exactly this IP);
	# with a dynamic IP use 'basic_auth' instead of the IP allowlist (hash: caddy hash-password).
	# (CORS is already set: the PocketBase unit runs with --origins=https://<app-domain>,
	#  see above — since 0.23 there is no PB dashboard setting for this anymore.)
	#   @admin path /_/*
	#   handle @admin {
	#     @blocked not remote_ip 203.0.113.45/32
	#     respond @blocked "Forbidden" 403
	#     reverse_proxy 127.0.0.1:${PB_PORT}
	#   }
	#   handle {
	#     reverse_proxy 127.0.0.1:${PB_PORT}
	#   }
}
EOF
} > /etc/caddy/Caddyfile

# ── 6) Create the superuser (offline, BEFORE the service opens the DB) ──────
if [ "$DO_ACCOUNTS" = "1" ]; then
  echo "• Creating/updating PocketBase superuser …"
  sudo -u "$RUN_USER" "$PB_BIN" superuser upsert "$SU_EMAIL" "$SU_PASS" --dir "$ROOT/pocketbase/pb_data" >/dev/null
fi

# ── 7) Enable + start services ──────────────────────────────────────────────
echo "• Enabling + starting services …"
systemctl daemon-reload
systemctl enable --now darts-pocketbase.service darts-web.service
caddy validate --config /etc/caddy/Caddyfile >/dev/null
systemctl reload caddy 2>/dev/null || systemctl restart caddy
systemctl enable caddy >/dev/null 2>&1 || true

# ── 8) Schema + first app admin (provision.mjs against the running PB) ──────
if [ "$DO_ACCOUNTS" = "1" ]; then
  echo "• Waiting for PocketBase …"
  ok=""
  for _ in $(seq 1 30); do
    curl -fsS "${PB_URL_LOCAL}/api/health" >/dev/null 2>&1 && { ok=1; break; }
    sleep 1
  done
  [ "$ok" = "1" ] || { echo "✗ PocketBase not reachable — logs: journalctl -u darts-pocketbase -e"; exit 1; }
  echo "• Schema + first app admin (provision.mjs) …"
  sudo -u "$RUN_USER" env \
    PB_URL="$PB_URL_LOCAL" PB_SU_EMAIL="$SU_EMAIL" PB_SU_PASS="$SU_PASS" \
    APP_ADMIN_EMAIL="$ADMIN_EMAIL" APP_ADMIN_PASS="$ADMIN_PASS" \
    bash -lc "cd '$ROOT/pocketbase' && node provision.mjs"
fi

# ── Update authorization: token for in-app updates triggered from a board (https) ──
if [ ! -f "$ROOT/.update-token" ]; then
  "$NODE_BIN" -e "require('fs').writeFileSync(process.argv[1], require('crypto').randomBytes(16).toString('hex'))" "$ROOT/.update-token"
  chown "$RUN_USER" "$ROOT/.update-token" 2>/dev/null || true
  chmod 600 "$ROOT/.update-token" 2>/dev/null || true
fi
UPD_TOKEN="$(cat "$ROOT/.update-token" 2>/dev/null)"

echo
echo "✅ Services are running:"
echo "   PocketBase : ${PB_URL_LOCAL}   (public via https://${DB_DOMAIN})"
echo "   Frontend   : http://127.0.0.1:${WEB_PORT}   (public via https://${APP_DOMAIN})"
echo "   Status     : systemctl status darts-web darts-pocketbase caddy"
echo "   Logs       : journalctl -u darts-pocketbase -f"
echo
echo "➡ NEXT STEPS:"
echo "   • Check DNS (A records app.* / db.* → this server's IP) and firewall: 80+443 open,"
echo "     do NOT open 8090/4173."
echo "   • In PocketBase ( https://${DB_DOMAIN}/_/ ) → Settings → Application URL = https://${DB_DOMAIN}."
if [ "$DO_ACCOUNTS" != "1" ]; then
  echo "   • Create accounts (still pending):"
  echo "       cd '$ROOT/pocketbase'"
  echo "       ./pocketbase superuser upsert <admin-email> '<strong-password>' --dir ./pb_data"
  echo "       sudo -u $RUN_USER node provision.mjs"
fi
echo "   • Optional hardening: restrict /_/ in Caddy to your IP + uncomment the CSP"
echo "       → docs/admin-guide-cloud.md, section Security."
echo
echo "ℹ Updating later (2 ways):"
echo "   • In-app: place 'dartszentrale-update-*.tar.gz' into '$ROOT/updates/' → Settings → 'App & Updates' → Install."
echo "     From a board with this token:  ${UPD_TOKEN}"
echo "   • Script:  ./update-server.sh   (detects the cloud services, rebuilds, restarts)."
