#!/usr/bin/env bash
# ═══════ DartsZentrale — Club mode LAN (one binary, no Node, no build) ═══════
# PocketBase SERVES the built frontend from pb_public/ and is also the API —
# everything over ONE port. On the very first start the operator creates two admin accounts
# (console + app, via REST without Node) — passwords are never stored. For club operation on your own network.
#
#   ./start-club-lan.sh                 # binds to the LAN (other boards/tablets can reach it)
#   HOST=127.0.0.1 ./start-club-lan.sh  # this computer only (special case)
#   PORT=8090 ./start-club-lan.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PB_VERSION="${PB_VERSION:-0.39.5}"
PORT="${PORT:-8090}"
HOST="${HOST:-0.0.0.0}"          # 0.0.0.0 = reachable on the LAN; 127.0.0.1 = local only
PB="$ROOT/pocketbase"
DATA="$ROOT/pb_data"
LOCAL="http://127.0.0.1:${PORT}" # health/REST always via loopback

# ── 1) Ensure the PocketBase binary is present (otherwise download for this CPU) ─────
if [ ! -x "$PB" ]; then
  case "$(uname -m)" in
    x86_64|amd64)  A=linux_amd64 ;;
    aarch64|arm64) A=linux_arm64 ;;
    armv7l|armhf)  A=linux_armv7 ;;
    *) echo "✗ Unknown CPU $(uname -m) — place the PocketBase binary manually into $ROOT/."; exit 1 ;;
  esac
  command -v unzip >/dev/null || { echo "✗ 'unzip' missing (sudo apt install unzip)."; exit 1; }
  echo "• Downloading PocketBase $PB_VERSION ($A) …"
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/pb.zip" "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${A}.zip"
  unzip -o "$tmp/pb.zip" pocketbase -d "$ROOT" >/dev/null
  chmod +x "$PB"; rm -rf "$tmp"
fi

serve_args=( serve --automigrate=0 --http="${HOST}:${PORT}"
  --dir="$DATA" --migrationsDir="$ROOT/pb_migrations" --hooksDir="$ROOT/pb_hooks" --publicDir="$ROOT/pb_public" )

# ── Input helpers (first run only) ──────────────────────────────────────────
json_escape() { local s=$1; s=${s//\\/\\\\}; s=${s//\"/\\\"}; printf '%s' "$s"; }
read_nonempty() {  # $1=prompt  $2=default(optional) → value on stdout
  local v
  while :; do
    read -rp "$1" v
    [ -z "$v" ] && [ -n "${2:-}" ] && { printf '%s' "$2"; return; }
    [ -n "$v" ] && { printf '%s' "$v"; return; }
  done
}
read_pw() {  # $1=prompt → password on stdout (prompts/errors on stderr)
  local p1 p2
  while :; do
    read -rsp "$1 (min. 8): " p1; echo >&2
    read -rsp "     repeat: " p2; echo >&2
    [ "${#p1}" -lt 8 ] && { echo "     ✗ at least 8 characters." >&2; continue; }
    [ "$p1" != "$p2" ] && { echo "     ✗ does not match." >&2; continue; }
    printf '%s' "$p1"; return
  done
}

# ── 2) First run (no DB yet) → create two admin accounts, without Node (CLI + REST) ─────
if [ ! -d "$DATA" ]; then
  echo "── Initial setup (first run only) ──"
  echo "   Two administrator accounts will be created. The passwords are"
  echo "   NOT stored – please note them down safely (password manager)."
  echo
  echo "  1) PocketBase console (maintenance/recovery at $LOCAL/_/):"
  SU_EMAIL="$(read_nonempty "     Email [superuser@dartszentrale.local]: " "superuser@dartszentrale.local")"
  SU_PW="$(read_pw "     Password")"
  echo
  echo "  2) App administrator (login in DartsZentrale):"
  ADMIN_EMAIL="$(read_nonempty "     Email: ")"
  ADMIN_PW="$(read_pw "     Password")"
  # Create the superuser (password only as a CLI argument — never stored anywhere).
  "$PB" superuser upsert "$SU_EMAIL" "$SU_PW" --dir "$DATA" >/dev/null
  echo; echo "  • Creating accounts …"
  # Start PB briefly, create the app admin via REST (migrations build the schema meanwhile).
  "$PB" "${serve_args[@]}" >/dev/null 2>&1 & BOOT=$!
  for _ in $(seq 1 40); do curl -fsS "$LOCAL/api/health" >/dev/null 2>&1 && break; sleep 0.5; done
  TOKEN="$(curl -fsS -X POST "$LOCAL/api/collections/_superusers/auth-with-password" -H 'Content-Type: application/json' \
            -d "{\"identity\":\"$(json_escape "$SU_EMAIL")\",\"password\":\"$(json_escape "$SU_PW")\"}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
  if curl -fsS -X POST "$LOCAL/api/collections/users/records" -H "Authorization: $TOKEN" -H 'Content-Type: application/json' \
       -d "{\"email\":\"$(json_escape "$ADMIN_EMAIL")\",\"password\":\"$(json_escape "$ADMIN_PW")\",\"passwordConfirm\":\"$(json_escape "$ADMIN_PW")\",\"emailVisibility\":true,\"verified\":true,\"name\":\"Administrator\",\"first\":\"Administrator\",\"last\":\"\",\"role\":\"admin\",\"active\":true}" >/dev/null 2>&1; then
    echo "  ✓ App administrator created: $ADMIN_EMAIL"
  else
    echo "  ⚠ Creating the app admin failed – do it later in the PocketBase console ($LOCAL/_/)."
  fi
  kill "$BOOT" 2>/dev/null; wait "$BOOT" 2>/dev/null || true
  echo "── Setup complete ──"; echo
fi

# ── 3) Start (app + API from one binary) ────────────────────────────────────
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo "▶ DartsZentrale is running:"
echo "    this computer  : $LOCAL"
[ -n "$LAN_IP" ] && [ "$HOST" != "127.0.0.1" ] && echo "    other devices  : http://${LAN_IP}:${PORT}   (board PCs as a bookmark, tablets via QR in the app)"
echo "  (Ctrl+C to stop)"
# Open the browser on this computer (best effort).
( sleep 1.5; command -v xdg-open >/dev/null 2>&1 && xdg-open "$LOCAL" >/dev/null 2>&1 || true ) &
exec "$PB" "${serve_args[@]}"
