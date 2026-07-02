#!/usr/bin/env bash
# Baut unter copy2share/ drei Verteil-Bundles (Ordner + ZIP) mit NUR den nötigen Dateien:
#   01-lokal-ein-board       → Lokaler Betrieb, ein Board (nur Frontend)
#   02-lan-vereinsmodus      → Vereinsmodus im eigenen Netz (geführt: einrichten-lan.*)
#   03-cloud-vereinsmodus    → Vereinsmodus in der Cloud (schlank: ohne Coolify/Docker)
# Jeder Verein bekommt die passende ZIP. Aufruf:  bash build.sh [ZIEL]   (Standard: <repo>/copy2share)
# Bewusst NICHT kopiert: node_modules, dist, .env.local, pb_data, das PocketBase-Binary,
# die demo-*.mjs (Testdaten) und seed-remote.sh (Secrets).
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SKILL_DIR/../../.." && pwd)"
TARGET="${1:-$REPO/copy2share}"
[ -d "$REPO/app" ] && [ -d "$REPO/pocketbase" ] || { echo "✗ $REPO sieht nicht nach dem Projektordner aus (app/ + pocketbase/ fehlen)."; exit 1; }
# Version relativ lesen (cd), damit node auch unter Git-Bash/Windows nicht über MSYS-Pfade (/d/…) stolpert.
VERSION="$(cd "$REPO/app" && node -p "require('./package.json').version" 2>/dev/null || echo 0.0.0)"

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
copy_verein(){ for f in start-lan.sh start-lan.bat autostart-lan.sh autostart-lan-entfernen.sh autostart-lan.bat einrichten-lan.sh einrichten-lan.ps1 einrichten-lan.bat update-server.sh update-server.ps1 update-server.bat; do cpf "$REPO/$f" "$1/"; done; }
copy_docs(){ local d="$1/docs"; mkdir -p "$d"; shift; for f in "$@"; do cpf "$REPO/docs/$f" "$d/"; done; }

# Schlanke Cloud-Variante (ohne Coolify/Docker): Installer + Caddy-Referenzkonfig — direkt ins Bundle-Root
copy_cloud(){ for f in einrichten-cloud.sh Caddyfile.example; do cpf "$REPO/$f" "$1/"; done; }

# Update-Paket: fertiges dist/ (inkl. version.json) als .tar.gz. Der Admin legt es in updates/ ab und
# installiert es in der App (Einstellungen → App & Updates → Installieren). Für alle Modi identisch (nur Frontend).
make_update_pkg(){
  echo "▶ Baue Frontend (dist/) für das Update-Paket …"
  ( cd "$REPO/app" && npm run build >/dev/null 2>&1 ) || { echo "  ⚠ 'npm run build' fehlgeschlagen (sind node_modules in app/ installiert?) — Update-Paket übersprungen."; return 0; }
  local out="$TARGET/dartszentrale-update-${VERSION}.tar.gz"
  ( cd "$REPO/app/dist" && tar -czf "$out" * )   # Members auf Wurzelebene (kein ./-Prefix) → passt zum serve-dist-Endpunkt
  echo "  → $(basename "$out")"
}


echo "▶ Ziel: $TARGET"
rm -rf "$TARGET"; mkdir -p "$TARGET"

# ── 01 — Lokaler Betrieb, ein Board ─────────────────────────────────────────
A="$TARGET/01-lokal-ein-board"; mkdir -p "$A"
copy_app "$A" 0
copy_common "$A"
copy_lokal "$A"
copy_docs "$A" anleitung-lokal-windows.md anleitung-lokal-linux.md handbuch.md
cat > "$A/LIESMICH.txt" <<'TXT'
DartsZentrale — Lokaler Betrieb, ein Board (kein Server, keine Anmeldung)
-------------------------------------------------------------------
Starten:  Windows -> Doppelklick start-lokal.bat   |   Linux/Pi -> ./start-lokal.sh
Beim ersten Start "Lokal" wählen.
Autostart (Kiosk):  Windows -> autostart-lokal.bat   |   Linux/Pi -> ./autostart-lokal.sh
Update (einfach): dartszentrale-update-*.tar.gz in den Ordner 'updates' legen, dann in der App
          Einstellungen -> "App & Updates" -> Installieren (kein Neustart noetig).
Update (Skript):  Windows -> update-lokal.bat   |   Linux/Pi -> ./update-lokal.sh <stick>
Anleitung: docs/anleitung-lokal-windows.md bzw. -linux.md  (Bedienung: docs/handbuch.md, Abschnitte 10+11)
Hinweis: Nur Node.js noetig (nodejs.org). PocketBase wird NICHT gebraucht (kein Server).
TXT

# ── 02 — Vereinsmodus im eigenen Netz (LAN) ─────────────────────────────────
B="$TARGET/02-lan-vereinsmodus"; mkdir -p "$B"
copy_app "$B" 0
copy_pb "$B" 0
copy_common "$B"
copy_verein "$B"
copy_docs "$B" admin-anleitung-lan-windows.md admin-anleitung-lan-linux.md handbuch.md security-audit.md
cat > "$B/LIESMICH.txt" <<'TXT'
DartsZentrale — Vereinsmodus im eigenen Netz (LAN)
---------------------------------------------
Es laufen ZWEI Programme: PocketBase (Backend) + Frontend.

EINFACHSTER WEG — geführte Einrichtung (fragt alles ab, bis alles läuft inkl. erstem Admin):
  Windows  -> Doppelklick  einrichten-lan.bat
  Linux/Pi -> ./einrichten-lan.sh
Das lädt PocketBase automatisch, baut die App, richtet Autostart ein und legt den Admin an.
Voraussetzung: nur Node.js (nodejs.org). Die PocketBase-Binary holt das Skript selbst.

UPDATE später — einfachster Weg (In-App):
  dartszentrale-update-*.tar.gz in den Ordner 'updates' der Installation legen, dann in der App
  Einstellungen -> "App & Updates" -> Installieren. Am Board selbst ohne Token; von einem
  anderen Board mit dem Token, das einrichten-lan am Ende anzeigt (steht in .update-token).
UPDATE später — per Skript (auch PocketBase):
  Windows  -> update-server.bat        Linux/Pi -> ./update-server.sh <quelle>
Die Dienste werden automatisch neu gestartet. pb_data (deine DB) bleibt erhalten.

Anleitung mit Details: docs/admin-anleitung-lan-windows.md bzw. -lan-linux.md, Abschnitt 2.
TXT

# ── 03 — Vereinsmodus in der Cloud (schlank: ohne Coolify, ohne Docker) ─────
C="$TARGET/03-cloud-vereinsmodus"; mkdir -p "$C"
copy_app "$C" 0
copy_pb "$C" 0
copy_cloud "$C"
cpf "$REPO/update-server.sh" "$C/"
copy_docs "$C" admin-anleitung-cloud.md handbuch.md
cat > "$C/LIESMICH.txt" <<'TXT'
DartsZentrale — Vereinsmodus in der Cloud (schlank: ohne Coolify, ohne Docker)
------------------------------------------------------------------------
EIN Befehl richtet alles ein — fragt Domains, Superuser und ersten App-Admin ab und
laeuft bis alles steht (PocketBase laden, App bauen, systemd-Dienste, Caddy/HTTPS):

  sudo ./einrichten-cloud.sh

Voraussetzung: ein Linux-Server (Ubuntu/Debian) und die DNS-A-Records app.* / db.*
zeigen auf die Server-IP. Details + Sicherheit: docs/admin-anleitung-cloud.md.

UPDATE spaeter — einfachster Weg (In-App):
  dartszentrale-update-*.tar.gz in den Ordner 'updates' der Installation legen, dann in der App
  Einstellungen -> "App & Updates" -> Installieren. Von einem Board mit dem Token, das
  einrichten-cloud am Ende anzeigt (steht in .update-token).
UPDATE spaeter — per Skript (auch PocketBase):  ./update-server.sh
(erkennt die Dienste, baut neu, startet neu). pb_data (deine DB) bleibt erhalten.
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
echo "── Update-Paket erstellen (für spätere In-App-Updates) ──"
make_update_pkg

echo
echo "✅ Fertig. Bundles + ZIPs unter: $TARGET"
du -sh "$TARGET"/*.zip "$TARGET"/dartszentrale-update-*.tar.gz 2>/dev/null || true
echo
echo "Update-Paket (später an bestehende Installationen schicken):"
echo "  dartszentrale-update-${VERSION}.tar.gz  → in den updates/-Ordner der Installation legen,"
echo "  dann in der App: Einstellungen → 'App & Updates' → Installieren."
echo
echo "Jeder Verein bekommt die passende ZIP:"
echo "  01-lokal-ein-board   = ein Board lokal (kein Server)"
echo "  02-lan-vereinsmodus  = Verein im eigenen Netz  → einrichten-lan.(bat|sh)"
echo "  03-cloud-vereinsmodus= Verein in der Cloud      → ./einrichten-cloud.sh"
