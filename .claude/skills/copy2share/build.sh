#!/usr/bin/env bash
# Baut unter copy2share/ drei Verteil-Bundles (Ordner + ZIP) mit NUR den nötigen Dateien:
#   01-lokal-ein-board       → Lokaler Betrieb, ein Board (nur Frontend)
#   02-lan-vereinsmodus      → Vereinsmodus im eigenen Netz (geführt: einrichten-lan.*)
#   03-cloud-vereinsmodus    → Vereinsmodus in der Cloud (Docker/Coolify ODER schlank)
# Jeder Verein bekommt die passende ZIP. Aufruf:  bash build.sh [ZIEL]   (Standard: <repo>/copy2share)
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

# Gemeinsam (01 + 02): lokaler Start — KEIN PocketBase
copy_common(){ for f in start-lokal.sh start-lokal.bat; do cpf "$REPO/$f" "$1/"; done; }
# Nur 01 (lokal, ein Board): Autostart + Update fürs Kiosk-Board, NUR Frontend, kein PocketBase
copy_lokal(){ for f in autostart-lokal.sh autostart-lokal.bat update-lokal.sh update-lokal.bat; do cpf "$REPO/$f" "$1/"; done; }
# Nur 02 (Vereinsmodus): manueller Start + Autostart + geführte Einrichtung + Update (mit PocketBase)
copy_verein(){ for f in start-dartshub.sh start-dartshub.bat autostart-einrichten.sh autostart-entfernen.sh autostart-einrichten.bat einrichten-lan.sh einrichten-lan.ps1 einrichten-lan.bat update.sh update.ps1 update-dartshub.bat; do cpf "$REPO/$f" "$1/"; done; }
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
copy_common "$A"
copy_lokal "$A"
copy_docs "$A" admin-anleitung.md admin-anleitung-windows.md admin-anleitung-linux.md handbuch.md
cat > "$A/LIESMICH.txt" <<'TXT'
DartsHub — Lokaler Betrieb, ein Board (kein Server, keine Anmeldung)
-------------------------------------------------------------------
Starten:  Windows -> Doppelklick start-lokal.bat   |   Linux/Pi -> ./start-lokal.sh
Beim ersten Start "Lokal" wählen.
Autostart (Kiosk):  Windows -> autostart-lokal.bat   |   Linux/Pi -> ./autostart-lokal.sh
Update:   Windows -> update-lokal.bat   |   Linux/Pi -> ./update-lokal.sh <stick>
Anleitung: docs/admin-anleitung-windows.md bzw. docs/admin-anleitung-linux.md (Abschnitt 1)
Hinweis: Nur Node.js noetig (nodejs.org). PocketBase wird NICHT gebraucht (kein Server).
TXT

# ── 02 — Vereinsmodus im eigenen Netz (LAN) ─────────────────────────────────
B="$TARGET/02-lan-vereinsmodus"; mkdir -p "$B"
copy_app "$B" 0
copy_pb "$B" 0
copy_common "$B"
copy_verein "$B"
copy_docs "$B" admin-anleitung.md admin-anleitung-windows.md admin-anleitung-linux.md handbuch.md security-audit.md
cat > "$B/LIESMICH.txt" <<'TXT'
DartsHub — Vereinsmodus im eigenen Netz (LAN)
---------------------------------------------
Es laufen ZWEI Programme: PocketBase (Backend) + Frontend.

EINFACHSTER WEG — geführte Einrichtung (fragt alles ab, bis alles läuft inkl. erstem Admin):
  Windows  -> Doppelklick  einrichten-lan.bat
  Linux/Pi -> ./einrichten-lan.sh
Das lädt PocketBase automatisch, baut die App, richtet Autostart ein und legt den Admin an.
Voraussetzung: nur Node.js (nodejs.org). Die PocketBase-Binary holt das Skript selbst.

UPDATE später (neue ZIP entpacken/überspielen, dann):
  Windows  -> update-dartshub.bat        Linux/Pi -> ./update.sh <quelle>
Die Dienste werden automatisch neu gestartet. pb_data (deine DB) bleibt erhalten.

Anleitung mit Details: docs/admin-anleitung-windows.md bzw. -linux.md, Abschnitt 2.
TXT

# ── 03 — Vereinsmodus in der Cloud (Docker/Coolify ODER schlank) ────────────
C="$TARGET/03-cloud-vereinsmodus"; mkdir -p "$C"
copy_app "$C" 1
copy_pb "$C" 1
copy_deploy_schlank "$C"
cpf "$REPO/update.sh" "$C/"
copy_docs "$C" COOLIFY-SETUP.md cloud-anleitung.md cloud-schlank-anleitung.md security-audit.md handbuch.md
cat > "$C/LIESMICH.txt" <<'TXT'
DartsHub — Vereinsmodus in der Cloud (zwei Wege)
------------------------------------------------
WEG 1 — Docker / Coolify (Komfort-UI): Deployment über Coolify (zieht aus Git) oder direkt per
  Docker. Enthält Dockerfiles + docker-compose.yaml. Start-/Update-Skripte hier NICHT nötig.
  Anleitung: docs/cloud-anleitung.md + docs/COOLIFY-SETUP.md (Klick-für-Klick).

WEG 2 — Schlank, ohne Coolify & Docker (günstiger, geführt per Skript):
  native systemd-Dienste + Caddy (Auto-HTTPS). EIN Befehl, fragt alles Nötige ab
  (Domains, Superuser, erster Admin) und läuft bis alles steht:
    sudo deploy/cloud-schlank/setup.sh
  Update später: neue Dateien einspielen, dann  ./update.sh  (erkennt die Dienste,
  baut neu, startet neu). Anleitung: docs/cloud-schlank-anleitung.md.
  (Voraussetzung: DNS-A-Records app.* / db.* zeigen auf die Server-IP.)

WICHTIG: Sicherheits-Checkliste in docs/security-audit.md vor dem Online-Gang abarbeiten.
TXT

# ── Shell-Skripte auf LF normalisieren + ausführbar machen ──────────────────
# Wird build.sh unter Windows (Git Bash) ausgeführt, hätten kopierte .sh sonst CRLF
# und würden auf einem Linux-Server scheitern (#!/usr/bin/env bash\r).
find "$TARGET" -name '*.sh' -type f -exec sed -i 's/\r$//' {} + 2>/dev/null || true
find "$TARGET" -name '*.sh' -type f -exec chmod +x {} + 2>/dev/null || true

# ── ZIP je Variante (zip, sonst PowerShell Compress-Archive) ────────────────
make_zip(){ local base="$1"
  ( cd "$TARGET" && rm -f "$base.zip"
    if command -v zip >/dev/null 2>&1; then
      zip -rq "$base.zip" "$base"
    elif command -v powershell >/dev/null 2>&1; then
      powershell -NoProfile -Command "Compress-Archive -Path '$base' -DestinationPath '$base.zip' -Force" >/dev/null
    else
      echo "  ⚠ Weder zip noch PowerShell gefunden — '$base' bleibt nur als Ordner."
    fi
  )
}
echo
echo "── ZIPs erstellen ──"
for b in 01-lokal-ein-board 02-lan-vereinsmodus 03-cloud-vereinsmodus; do make_zip "$b"; done

echo
echo "✅ Fertig. Bundles + ZIPs unter: $TARGET"
du -sh "$TARGET"/*.zip 2>/dev/null || true
echo
echo "Jeder Verein bekommt die passende ZIP:"
echo "  01-lokal-ein-board   = ein Board lokal (kein Server)"
echo "  02-lan-vereinsmodus  = Verein im eigenen Netz  → einrichten-lan.(bat|sh)"
echo "  03-cloud-vereinsmodus= Verein in der Cloud      → deploy/cloud-schlank/setup.sh"
