#!/usr/bin/env bash
# ═══════ DartsZentrale — Einfach-Start (ein Binary, kein Node, kein Build) ═══════
# PocketBase liefert das fertige Frontend aus pb_public/ AUS und ist zugleich die API —
# alles über EINEN Port. Beim allerersten Start wird der Admin angelegt (ohne Node, via REST);
# danach startet dasselbe Skript nur noch den Server. Für den Vereinsbetrieb im eigenen Netz.
#
#   ./start-einfach.sh                 # bindet aufs LAN (andere Bretter/Tablets erreichen es)
#   HOST=127.0.0.1 ./start-einfach.sh  # nur dieser Rechner
#   PORT=8090 ./start-einfach.sh
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

# ── 2) Erststart (noch keine DB) → Admin anlegen, ohne Node (CLI + REST) ─────
if [ ! -d "$DATA" ]; then
  echo "── Ersteinrichtung (nur beim ersten Start) ──"
  ADMIN_EMAIL=""; while [ -z "$ADMIN_EMAIL" ]; do read -rp "  Admin-E-Mail:              " ADMIN_EMAIL; done
  ADMIN_PW=""
  while [ -z "$ADMIN_PW" ]; do
    read -rsp "  Admin-Passwort (min. 8):   " P1; echo
    read -rsp "  Passwort wiederholen:      " P2; echo
    if [ "${#P1}" -lt 8 ]; then echo "  ✗ mindestens 8 Zeichen."; continue; fi
    if [ "$P1" != "$P2" ]; then echo "  ✗ stimmt nicht überein."; continue; fi
    ADMIN_PW="$P1"
  done
  # Interner Superuser (PocketBase-Konsole /_/, nur Recovery) — Zufallspasswort, lokal gespeichert.
  SU_EMAIL="superuser@dartszentrale.local"
  SU_PW="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20)"
  "$PB" superuser upsert "$SU_EMAIL" "$SU_PW" --dir "$DATA" >/dev/null
  umask 077; printf 'PocketBase-Konsole (%s/_/):\n  E-Mail:   %s\n  Passwort: %s\n' "$LOCAL" "$SU_EMAIL" "$SU_PW" > "$ROOT/.superuser"
  echo "  • interner Superuser gespeichert in .superuser (sicher aufbewahren)"
  # PB kurz starten, App-Admin per REST anlegen (Migrationen bauen dabei das Schema).
  "$PB" "${serve_args[@]}" >/dev/null 2>&1 & BOOT=$!
  for _ in $(seq 1 40); do curl -fsS "$LOCAL/api/health" >/dev/null 2>&1 && break; sleep 0.5; done
  TOKEN="$(curl -fsS -X POST "$LOCAL/api/collections/_superusers/auth-with-password" -H 'Content-Type: application/json' \
            -d "{\"identity\":\"$SU_EMAIL\",\"password\":\"$SU_PW\"}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
  if curl -fsS -X POST "$LOCAL/api/collections/users/records" -H "Authorization: $TOKEN" -H 'Content-Type: application/json' \
       -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PW\",\"passwordConfirm\":\"$ADMIN_PW\",\"emailVisibility\":true,\"verified\":true,\"name\":\"Administrator\",\"first\":\"Administrator\",\"last\":\"\",\"role\":\"admin\",\"active\":true}" >/dev/null 2>&1; then
    echo "  ✓ Admin angelegt: $ADMIN_EMAIL"
  else
    echo "  ⚠ Admin-Anlage fehlgeschlagen — später in der PocketBase-Konsole ($LOCAL/_/) nachholen."
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
