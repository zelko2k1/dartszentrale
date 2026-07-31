#!/usr/bin/env bash
# ═══════ DartsZentrale — Club mode LAN (one binary, no Node, no build) ═══════
# PocketBase SERVES the built frontend from pb_public/ and is also the API —
# everything over ONE port. On the very first start the operator creates two admin accounts
# (console + app, via REST without Node) — passwords are never stored. For club operation on your own network.
#
#   ./start-club-lan.sh                 # binds to the LAN (other boards/tablets can reach it)
#   HOST=127.0.0.1 ./start-club-lan.sh  # this computer only (special case)
#   PORT=8090 ./start-club-lan.sh
#
# Unattended first run: set PB_SU_EMAIL/PB_SU_PASS (console) and APP_ADMIN_EMAIL/APP_ADMIN_PASS
# (app) — the same names setup-cloud.sh uses. Whatever is preset is not asked for. Meant for
# automated setups and the CI smoke test; at the club just start it and answer the questions.
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
# A preset value wins over the prompt — that is what makes an unattended first run possible
# (see the header). Presets are validated up front, not in here: these helpers run inside a
# command substitution, where an `exit` would only end the subshell and leave the value empty.
json_escape() { local s=$1; s=${s//\\/\\\\}; s=${s//\"/\\\"}; printf '%s' "$s"; }
read_nonempty() {  # $1=prompt  $2=preset(optional) → value on stdout
  local v
  [ -n "${2:-}" ] && { printf '%s' "$2"; return; }
  while :; do
    read -rp "$1" v
    [ -n "$v" ] && { printf '%s' "$v"; return; }
  done
}
read_pw() {  # $1=prompt  $2=preset(optional) → password on stdout (prompts/errors on stderr)
  local p1 p2
  [ -n "${2:-}" ] && { printf '%s' "$2"; return; }
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
  # The port has to be free BEFORE anything is created. The setup starts PocketBase briefly;
  # if that fails, pb_data exists all the same — and because this whole block only runs when
  # pb_data is MISSING, nobody would ever be asked for the accounts again.
  if (exec 3<>"/dev/tcp/127.0.0.1/${PORT}") 2>/dev/null; then
    echo "✗ Port ${PORT} is already taken — is DartsZentrale (or PocketBase) already running?"
    echo "  Stop the other program, or pick a different port:  PORT=8091 ./start-club-lan.sh"
    exit 1
  fi

  # Everything created from here on is provisional: on any abort the half-finished pb_data is
  # removed again and the briefly started PocketBase is stopped — so a retry starts clean and
  # asks for the accounts once more, instead of silently leaving a login-less installation.
  SETUP_OK=0; BOOT=""
  cleanup_setup() {
    if [ -n "$BOOT" ]; then kill "$BOOT" 2>/dev/null || true; wait "$BOOT" 2>/dev/null || true; fi
    if [ "$SETUP_OK" != "1" ] && [ -d "$DATA" ]; then
      rm -rf "$DATA"
      echo "  → Nothing was kept — the next start asks for the accounts again." >&2
    fi
  }
  trap cleanup_setup EXIT

  # Presets from the environment are checked HERE, in the main shell, where an abort really aborts.
  for var in PB_SU_PASS APP_ADMIN_PASS; do
    val="${!var:-}"
    [ -z "$val" ] || [ "${#val}" -ge 8 ] || {
      echo "✗ $var is shorter than 8 characters — PocketBase would reject it."; exit 1; }
  done

  echo "── Initial setup (first run only) ──"
  echo "   Two administrator accounts will be created. The passwords are"
  echo "   NOT stored – please note them down safely (password manager)."
  echo
  echo "  1) PocketBase console (maintenance/recovery at $LOCAL/_/):"
  # No preset address on purpose: this repo is public, and a built-in admin address
  # both reveals the account name and invites leaving it unchanged.
  SU_EMAIL="$(read_nonempty "     Email: " "${PB_SU_EMAIL:-}")"
  SU_PW="$(read_pw "     Password" "${PB_SU_PASS:-}")"
  echo
  echo "  2) App administrator (login in DartsZentrale):"
  ADMIN_EMAIL="$(read_nonempty "     Email: " "${APP_ADMIN_EMAIL:-}")"
  ADMIN_PW="$(read_pw "     Password" "${APP_ADMIN_PASS:-}")"
  echo; echo "  • Creating accounts …"
  # Create the superuser (password only as a CLI argument — never stored anywhere).
  # CAREFUL: the PocketBase CLI reports errors on STDOUT and still exits with 0 — the exit code
  # says nothing, so the output has to be inspected.
  SU_OUT="$("$PB" superuser upsert "$SU_EMAIL" "$SU_PW" --dir "$DATA" 2>&1 || true)"
  case "$SU_OUT" in *Error*)
    echo "  ✗ The console account could not be created:"
    echo "    ${SU_OUT}"
    exit 1 ;;
  esac
  # Start PB briefly, create the app admin via REST (migrations build the schema meanwhile).
  "$PB" "${serve_args[@]}" >/dev/null 2>&1 & BOOT=$!
  HEALTHY=0
  for _ in $(seq 1 60); do curl -fsS "$LOCAL/api/health" >/dev/null 2>&1 && { HEALTHY=1; break; }; sleep 0.5; done
  if [ "$HEALTHY" != "1" ]; then
    echo "  ✗ PocketBase did not start within 30 seconds — setup aborted."
    exit 1
  fi
  # No 'set -e' abort here: without '|| true' a failing login would end the script silently,
  # leaving a half-finished pb_data behind (see the trap above).
  TOKEN="$(curl -fsS -X POST "$LOCAL/api/collections/_superusers/auth-with-password" -H 'Content-Type: application/json' \
            -d "{\"identity\":\"$(json_escape "$SU_EMAIL")\",\"password\":\"$(json_escape "$SU_PW")\"}" 2>/dev/null \
            | sed -n 's/.*"token":"\([^"]*\)".*/\1/p' || true)"
  if [ -z "$TOKEN" ]; then
    echo "  ✗ Login with the console account failed — setup aborted."
    exit 1
  fi
  # Bewusst OHNE '-f': bei einem Fehler soll die Antwort des Servers lesbar bleiben. Ein blankes
  # "failed" laesst den Betreiber im Verein ratlos zurueck; der Grund steht in der Antwort.
  ADMIN_OUT="$(curl -sS -o /dev/stdout -w '\n%{http_code}' -X POST "$LOCAL/api/collections/users/records" \
       -H "Authorization: $TOKEN" -H 'Content-Type: application/json' \
       -d "{\"email\":\"$(json_escape "$ADMIN_EMAIL")\",\"password\":\"$(json_escape "$ADMIN_PW")\",\"passwordConfirm\":\"$(json_escape "$ADMIN_PW")\",\"emailVisibility\":true,\"verified\":true,\"name\":\"Administrator\",\"first\":\"Administrator\",\"last\":\"\",\"role\":\"admin\",\"active\":true}" 2>&1 || true)"
  if [ "$(printf '%s' "$ADMIN_OUT" | tail -n1)" = "200" ]; then
    echo "  ✓ App administrator created: $ADMIN_EMAIL"
  else
    echo "  ⚠ Creating the app admin failed: $(printf '%s' "$ADMIN_OUT" | head -n-1)"
    echo "    Create it later in the PocketBase console ($LOCAL/_/)."
  fi
  # From here the database is usable (console account exists) → keep it, disarm the cleanup.
  SETUP_OK=1
  kill "$BOOT" 2>/dev/null || true; wait "$BOOT" 2>/dev/null || true
  trap - EXIT
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
