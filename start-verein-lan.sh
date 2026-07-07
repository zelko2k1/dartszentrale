#!/usr/bin/env bash
# ═══════ DartsZentrale — Vereinsmodus LAN (ein Binary, kein Node, kein Build) ═══════
# PocketBase liefert das fertige Frontend aus pb_public/ AUS und ist zugleich die API —
# alles über EINEN Port. Beim allerersten Start legt der Betreiber zwei Admin-Konten an (Konsole +
# App, ohne Node via REST) — Passwörter werden nicht gespeichert. Für den Vereinsbetrieb im eigenen Netz.
#
#   ./start-verein-lan.sh                 # bindet aufs LAN (andere Bretter/Tablets erreichen es)
#   HOST=127.0.0.1 ./start-verein-lan.sh  # nur dieser Rechner (Sonderfall)
#   PORT=8090 ./start-verein-lan.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PB_VERSION="${PB_VERSION:-0.39.5}"
PORT="${PORT:-8090}"
HOST="${HOST:-0.0.0.0}"          # 0.0.0.0 = im LAN erreichbar; 127.0.0.1 = nur lokal
PB="$ROOT/pocketbase"
DATA="$ROOT/pb_data"
LOCAL="http://127.0.0.1:${PORT}" # für Health/REST immer über Loopback

# ── 1) PocketBase-Binary sicherstellen (sonst passend zur CPU laden) ─────────
if [ ! -x "$PB" ]; then
  case "$(uname -m)" in
    x86_64|amd64)  A=linux_amd64 ;;
    aarch64|arm64) A=linux_arm64 ;;
    armv7l|armhf)  A=linux_armv7 ;;
    *) echo "✗ Unbekannte CPU $(uname -m) — PocketBase-Binary manuell nach $ROOT/ legen."; exit 1 ;;
  esac
  command -v unzip >/dev/null || { echo "✗ 'unzip' fehlt (sudo apt install unzip)."; exit 1; }
  echo "• Lade PocketBase $PB_VERSION ($A) …"
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/pb.zip" "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${A}.zip"
  unzip -o "$tmp/pb.zip" pocketbase -d "$ROOT" >/dev/null
  chmod +x "$PB"; rm -rf "$tmp"
fi

serve_args=( serve --automigrate=0 --http="${HOST}:${PORT}"
  --dir="$DATA" --migrationsDir="$ROOT/pb_migrations" --hooksDir="$ROOT/pb_hooks" --publicDir="$ROOT/pb_public" )

# ── Eingabe-Helfer (nur Erststart) ──────────────────────────────────────────
json_escape() { local s=$1; s=${s//\\/\\\\}; s=${s//\"/\\\"}; printf '%s' "$s"; }
read_nonempty() {  # $1=Prompt  $2=Default(optional) → Wert auf stdout
  local v
  while :; do
    read -rp "$1" v
    [ -z "$v" ] && [ -n "${2:-}" ] && { printf '%s' "$2"; return; }
    [ -n "$v" ] && { printf '%s' "$v"; return; }
  done
}
read_pw() {  # $1=Prompt → Passwort auf stdout (Prompts/Fehler auf stderr)
  local p1 p2
  while :; do
    read -rsp "$1 (min. 8): " p1; echo >&2
    read -rsp "     wiederholen: " p2; echo >&2
    [ "${#p1}" -lt 8 ] && { echo "     ✗ mindestens 8 Zeichen." >&2; continue; }
    [ "$p1" != "$p2" ] && { echo "     ✗ stimmt nicht überein." >&2; continue; }
    printf '%s' "$p1"; return
  done
}

# ── 2) Erststart (noch keine DB) → zwei Admin-Konten anlegen, ohne Node (CLI + REST) ─────
if [ ! -d "$DATA" ]; then
  echo "── Ersteinrichtung (nur beim ersten Start) ──"
  echo "   Es werden zwei Administrator-Konten festgelegt. Die Passwörter werden"
  echo "   NICHT gespeichert – bitte sicher notieren (Passwortmanager)."
  echo
  echo "  1) PocketBase-Konsole (Wartung/Recovery unter $LOCAL/_/):"
  SU_EMAIL="$(read_nonempty "     E-Mail [superuser@dartszentrale.local]: " "superuser@dartszentrale.local")"
  SU_PW="$(read_pw "     Passwort")"
  echo
  echo "  2) App-Administrator (Anmeldung in DartsZentrale):"
  ADMIN_EMAIL="$(read_nonempty "     E-Mail: ")"
  ADMIN_PW="$(read_pw "     Passwort")"
  # Superuser anlegen (Passwort nur als CLI-Argument — wird nirgends gespeichert).
  "$PB" superuser upsert "$SU_EMAIL" "$SU_PW" --dir "$DATA" >/dev/null
  echo; echo "  • Konten werden angelegt …"
  # PB kurz starten, App-Admin per REST anlegen (Migrationen bauen dabei das Schema).
  "$PB" "${serve_args[@]}" >/dev/null 2>&1 & BOOT=$!
  for _ in $(seq 1 40); do curl -fsS "$LOCAL/api/health" >/dev/null 2>&1 && break; sleep 0.5; done
  TOKEN="$(curl -fsS -X POST "$LOCAL/api/collections/_superusers/auth-with-password" -H 'Content-Type: application/json' \
            -d "{\"identity\":\"$(json_escape "$SU_EMAIL")\",\"password\":\"$(json_escape "$SU_PW")\"}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
  if curl -fsS -X POST "$LOCAL/api/collections/users/records" -H "Authorization: $TOKEN" -H 'Content-Type: application/json' \
       -d "{\"email\":\"$(json_escape "$ADMIN_EMAIL")\",\"password\":\"$(json_escape "$ADMIN_PW")\",\"passwordConfirm\":\"$(json_escape "$ADMIN_PW")\",\"emailVisibility\":true,\"verified\":true,\"name\":\"Administrator\",\"first\":\"Administrator\",\"last\":\"\",\"role\":\"admin\",\"active\":true}" >/dev/null 2>&1; then
    echo "  ✓ App-Administrator angelegt: $ADMIN_EMAIL"
  else
    echo "  ⚠ App-Admin-Anlage fehlgeschlagen – später in der PocketBase-Konsole ($LOCAL/_/) nachholen."
  fi
  kill "$BOOT" 2>/dev/null; wait "$BOOT" 2>/dev/null || true
  echo "── Einrichtung fertig ──"; echo
fi

# ── 3) Starten (App + API aus einem Binary) ─────────────────────────────────
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo "▶ DartsZentrale läuft:"
echo "    dieser Rechner : $LOCAL"
[ -n "$LAN_IP" ] && [ "$HOST" != "127.0.0.1" ] && echo "    andere Geräte  : http://${LAN_IP}:${PORT}   (Board-PCs als Lesezeichen, Tablets per QR in der App)"
echo "  (Strg+C zum Beenden)"
# Browser auf diesem Rechner öffnen (best effort).
( sleep 1.5; command -v xdg-open >/dev/null 2>&1 && xdg-open "$LOCAL" >/dev/null 2>&1 || true ) &
exec "$PB" "${serve_args[@]}"
