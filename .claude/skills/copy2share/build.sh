#!/usr/bin/env bash
# Baut unter copy2share/ drei Verteil-Bundles mit NUR den jeweils nötigen Dateien:
#   01-lokal-ein-board       → Lokaler Betrieb, ein Board (nur Frontend)
#   02-lan-vereinsmodus      → Vereinsmodus im eigenen Netz (Frontend + PocketBase-Ops)
#   03-cloud-vereinsmodus    → Vereinsmodus in der Cloud (Docker/Coolify-Bundle)
# Aufruf:  bash build.sh [ZIEL]   (Standard-Ziel: <repo>/copy2share)
# Bewusst NICHT kopiert: node_modules, dist, .env.local, pb_data, das PocketBase-Binary,
# die demo-*.mjs (Testdaten) und seed-remote.sh (Secrets).
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SKILL_DIR/../../.." && pwd)"
TARGET="${1:-$REPO/copy2share}"
[ -d "$REPO/app" ] && [ -d "$REPO/pocketbase" ] || { echo "✗ $REPO sieht nicht nach dem Projektordner aus (app/ + pocketbase/ fehlen)."; exit 1; }

cpf(){ [ -e "$1" ] && cp -f "$1" "$2"; }   # kopiere Datei, falls vorhanden

# Frontend-Quellen (ohne node_modules/dist/.env.local); $2=withDocker (1=ja)
copy_app(){ local d="$1/app"; mkdir -p "$d"
  cp -r "$REPO/app/src" "$REPO/app/public" "$d/"
  for f in package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json eslint.config.js serve-dist.mjs; do cpf "$REPO/app/$f" "$d/"; done
  if [ "${2:-0}" = "1" ]; then for f in Dockerfile nginx.conf .dockerignore; do cpf "$REPO/app/$f" "$d/"; done; fi
}

# PocketBase: Schema/Hooks + Produktiv-Skripte (KEINE demo-*, kein Binary, kein pb_data, kein seed-remote.sh)
copy_pb(){ local d="$1/pocketbase"; mkdir -p "$d"
  cp -r "$REPO/pocketbase/pb_migrations" "$REPO/pocketbase/pb_hooks" "$d/"
  for f in provision.mjs add-board-account.mjs reset-password.mjs season-export.mjs season-import.mjs season-offload.mjs _security-guard.mjs; do cpf "$REPO/pocketbase/$f" "$d/"; done
  if [ "${2:-0}" = "1" ]; then for f in Dockerfile docker-compose.yaml; do cpf "$REPO/pocketbase/$f" "$d/"; done; fi
}

copy_scripts(){ for f in start-dartshub.sh start-dartshub.bat autostart-einrichten.sh autostart-entfernen.sh autostart-einrichten.bat update.sh update.ps1 update-dartshub.bat; do cpf "$REPO/$f" "$1/"; done; }
copy_docs(){ local d="$1/docs"; mkdir -p "$d"; shift; for f in "$@"; do cpf "$REPO/docs/$f" "$d/"; done; }

# Schlanke Cloud-Variante (ohne Coolify/Docker): Installer + Caddy-Referenzkonfig
copy_deploy_schlank(){ local d="$1/deploy/cloud-schlank"; mkdir -p "$d"
  for f in setup.sh Caddyfile.example; do cpf "$REPO/deploy/cloud-schlank/$f" "$d/"; done
}

echo "▶ Ziel: $TARGET"
rm -rf "$TARGET"; mkdir -p "$TARGET"

# ── 01 — Lokaler Betrieb, ein Board ─────────────────────────────────────────
A="$TARGET/01-lokal-ein-board"; mkdir -p "$A"
copy_app "$A" 0
copy_scripts "$A"
copy_docs "$A" admin-anleitung.md admin-anleitung-windows.md admin-anleitung-linux.md handbuch.md
cat > "$A/LIESMICH.txt" <<'TXT'
DartsHub — Lokaler Betrieb, ein Board (kein Server, keine Anmeldung)
-------------------------------------------------------------------
Starten:  Windows -> Doppelklick start-dartshub.bat   |   Linux/Pi -> ./start-dartshub.sh
Beim ersten Start "Lokal" wählen.
Update:   Windows -> update-dartshub.bat   |   Linux/Pi -> ./update.sh <stick>
Anleitung: docs/admin-anleitung-windows.md bzw. docs/admin-anleitung-linux.md
Hinweis: Node.js muss installiert sein (nodejs.org). PocketBase wird NICHT gebraucht.
TXT

# ── 02 — Vereinsmodus im eigenen Netz (LAN) ─────────────────────────────────
B="$TARGET/02-lan-vereinsmodus"; mkdir -p "$B"
copy_app "$B" 0
copy_pb "$B" 0
copy_scripts "$B"
copy_docs "$B" admin-anleitung.md admin-anleitung-windows.md admin-anleitung-linux.md handbuch.md security-audit.md
cat > "$B/LIESMICH.txt" <<'TXT'
DartsHub — Vereinsmodus im eigenen Netz (LAN)
---------------------------------------------
Es laufen ZWEI Programme: PocketBase (Backend) + Frontend.
Einrichtung + Start: docs/admin-anleitung-windows.md bzw. -linux.md, Abschnitt 2.
Start beider Dienste:  start-dartshub.bat / ./start-dartshub.sh
Autostart beim Boot:   autostart-einrichten.bat / ./autostart-einrichten.sh
Du musst zusätzlich besorgen: Node.js (nodejs.org) UND die PocketBase-Binary (v0.39.x,
pocketbase.org/docs) in den Ordner pocketbase/ legen. pb_data (deine DB) entsteht beim Start.
TXT

# ── 03 — Vereinsmodus in der Cloud (Docker/Coolify ODER schlank) ────────────
C="$TARGET/03-cloud-vereinsmodus"; mkdir -p "$C"
copy_app "$C" 1
copy_pb "$C" 1
copy_deploy_schlank "$C"
copy_docs "$C" COOLIFY-SETUP.md cloud-anleitung.md cloud-schlank-anleitung.md security-audit.md handbuch.md
cat > "$C/LIESMICH.txt" <<'TXT'
DartsHub — Vereinsmodus in der Cloud (zwei Wege)
------------------------------------------------
WEG 1 — Docker / Coolify (Komfort-UI): Deployment über Coolify (zieht aus Git) oder direkt per
  Docker. Enthält Dockerfiles + docker-compose.yaml. Start-/Update-Skripte hier NICHT nötig.
  Anleitung: docs/cloud-anleitung.md + docs/COOLIFY-SETUP.md (Klick-für-Klick).

WEG 2 — Schlank, ohne Coolify & Docker (günstiger, etwas mehr Kommandozeile):
  native systemd-Dienste + Caddy (Auto-HTTPS). Ein Befehl:
    sudo APP_DOMAIN=app.deinedomain.de DB_DOMAIN=db.deinedomain.de deploy/cloud-schlank/setup.sh
  Anleitung: docs/cloud-schlank-anleitung.md (Caddyfile.example liegt in deploy/cloud-schlank/).

WICHTIG: Sicherheits-Checkliste in docs/security-audit.md vor dem Online-Gang abarbeiten.
TXT

echo
echo "✅ Fertig. Drei Bundles unter: $TARGET"
du -sh "$TARGET"/* 2>/dev/null || true
echo
echo "Jetzt z. B. den passenden Unterordner auf USB-Stick / Netzwerkshare / in die Cloud kopieren."
