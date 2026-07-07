#!/usr/bin/env bash
# Baut unter copy2share/ drei Verteil-Bundles (Ordner + ZIP) mit NUR den nötigen Dateien:
#   01-lokal-ein-board  → Ein Board lokal: starten & loslegen, kein Server, kein Login (mit Auto-Backup)
#   02-verein-lan       → Vereinsmodus im eigenen Netz: EIN Binary (PocketBase liefert App+API), kein Node/Build
#   03-verein-cloud     → Vereinsmodus in der Cloud (schlank per Caddy: einrichten-cloud.sh)
# Jeder Verein bekommt die passende ZIP. Aufruf:  bash build.sh [ZIEL]   (Standard: <repo>/copy2share)
# Bewusst NICHT kopiert: node_modules, dist, .env.local, pb_data, das PocketBase-Binary,
# die demo-*.mjs (Testdaten) und seed-remote.sh (Secrets).
# Der Coolify-/Docker-Weg ist bewusst SEPARAT (für Fortgeschrittene) und nicht Teil dieser Bundles
# — siehe docs/coolify-homelab-anleitung.md.
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

# Nur 01 (lokal, ein Board): lokaler Start + Autostart + Update fürs Kiosk-Board — NUR Frontend, kein PocketBase
copy_lokal(){ for f in start-lokal.sh start-lokal.bat autostart-lokal.sh autostart-lokal.bat update-lokal.sh update-lokal.bat; do cpf "$REPO/$f" "$1/"; done; }

# Nur 02 (Vereinsmodus LAN, Single-Binary): Start + Update + Autostart für den Einfach-Betrieb
copy_verein_lan(){ for f in start-verein-lan.sh start-verein-lan.ps1 start-verein-lan.bat \
  update-verein-lan.sh update-verein-lan.ps1 update-verein-lan.bat \
  autostart-verein-lan.sh autostart-verein-lan.bat; do cpf "$REPO/$f" "$1/"; done; }

copy_docs(){ local d="$1/docs"; mkdir -p "$d"; shift; for f in "$@"; do cpf "$REPO/docs/$f" "$d/"; done; }

# Schlanke Cloud-Variante (ohne Coolify/Docker): Installer + Caddy-Referenzkonfig — direkt ins Bundle-Root
copy_cloud(){ for f in einrichten-cloud.sh Caddyfile.example; do cpf "$REPO/$f" "$1/"; done; }

# Update-Paket: fertiges dist/ (inkl. version.json) als .tar.gz. Für alle Modi identisch (nur Frontend):
#   01/03: in updates/ ablegen, in der App „Installieren" (serve-dist).  02: ./update-verein-lan.(sh|bat).
make_update_pkg(){
  echo "▶ Baue Frontend (dist/) für das Update-Paket …"
  ( cd "$REPO/app" && npm run build >/dev/null 2>&1 ) || { echo "  ⚠ 'npm run build' fehlgeschlagen (sind node_modules in app/ installiert?) — Update-Paket übersprungen."; return 0; }
  local out="$TARGET/dartszentrale-update-${VERSION}.tar.gz"
  ( cd "$REPO/app/dist" && tar -czf "$out" * )   # Members auf Wurzelebene (kein ./-Prefix) → passt zu serve-dist + update-verein-lan
  echo "  → $(basename "$out")"
}

# Baut das Frontend OHNE VITE_PB_URL (Same-Origin) und legt es als pb_public/ ab — für den
# Single-Binary-Betrieb (PocketBase liefert die App selbst aus, kein separater Web-Dienst,
# keine eingebackene IP). Sichert app/.env.local und stellt es danach wieder her.
build_pubdir(){ local d="$1"; echo "▶ Baue Frontend (Same-Origin) für pb_public/ …"
  local bak=""; [ -f "$REPO/app/.env.local" ] && { bak="$(mktemp)"; cp "$REPO/app/.env.local" "$bak"; }
  printf 'VITE_PB_URL=\n' > "$REPO/app/.env.local"
  ( cd "$REPO/app" && npm run build >/dev/null 2>&1 ); local rc=$?
  if [ -n "$bak" ]; then cp "$bak" "$REPO/app/.env.local"; rm -f "$bak"; else rm -f "$REPO/app/.env.local"; fi
  [ "$rc" -eq 0 ] || { echo "  ⚠ Build fehlgeschlagen (node_modules in app/ installiert?) — Einfach-Bundle übersprungen."; return 1; }
  mkdir -p "$d/pb_public"; cp -r "$REPO/app/dist/." "$d/pb_public/"
  echo "  → pb_public/ ($(du -sh "$d/pb_public" 2>/dev/null | cut -f1))"
}


echo "▶ Ziel: $TARGET"
rm -rf "$TARGET"; mkdir -p "$TARGET"

# ── 01 — Ein Board lokal (kein Server, kein Login; Daten im Browser, mit Auto-Backup) ───────
A="$TARGET/01-lokal-ein-board"; mkdir -p "$A"
copy_app "$A" 0
copy_lokal "$A"
copy_docs "$A" anleitung-lokal-windows.md anleitung-lokal-linux.md handbuch.md
cat > "$A/LIESMICH.txt" <<'TXT'
DartsZentrale — Ein Board lokal (kein Server, keine Anmeldung)
-------------------------------------------------------------
Starten:  Windows -> Doppelklick start-lokal.bat   |   Linux/Pi -> ./start-lokal.sh
Beim ersten Start "Lokal" waehlen. Loslegen — kein Login, keine Einrichtung.

Auto-Backup: In den Einstellungen aktivierbar. Sichert deine Daten taeglich als Datei nach 'backup/'
neben der App (falls der Browser mal zurueckgesetzt wird). Laeuft nur ueber start-lokal (serve-dist).

Autostart (Kiosk):  Windows -> autostart-lokal.bat   |   Linux/Pi -> ./autostart-lokal.sh
Update (einfach): dartszentrale-update-*.tar.gz in den Ordner 'updates' legen, dann in der App
          Einstellungen -> "App & Updates" -> Installieren (kein Neustart noetig).
Update (Skript):  Windows -> update-lokal.bat   |   Linux/Pi -> ./update-lokal.sh <stick>
Update (Notnagel): einfach den kompletten Ordner durch die neue Version ersetzen.
Anleitung: docs/anleitung-lokal-windows.md bzw. -linux.md  (Bedienung: docs/handbuch.md, Abschnitte 10+11)
Hinweis: Nur Node.js noetig (nodejs.org). PocketBase wird NICHT gebraucht (kein Server).
TXT

# ── 02 — Vereinsmodus im eigenen Netz (LAN), EINFACH: ein Binary (PocketBase = App + API) ────
# Kein Node, kein Build beim Verein: das fertige Frontend liegt in pb_public/, PocketBase liefert es
# selbst aus. start-verein-lan laedt beim ersten Mal nur das PB-Binary + legt die Admin-Konten an.
B="$TARGET/02-verein-lan"; mkdir -p "$B"
if build_pubdir "$B"; then
  cp -r "$REPO/pocketbase/pb_migrations" "$REPO/pocketbase/pb_hooks" "$B/"
  copy_verein_lan "$B"
  copy_docs "$B" admin-anleitung-lan-linux.md admin-anleitung-lan-windows.md handbuch.md security-audit.md
  cat > "$B/LIESMICH.txt" <<'TXT'
DartsZentrale — Vereinsmodus im eigenen Netz (LAN, ein Programm, kein Node, kein Build)
--------------------------------------------------------------------------------------
EIN Programm (PocketBase) liefert die App UND die Daten — ueber einen Port.

STARTEN:
  Linux/Pi -> ./start-verein-lan.sh        Windows -> Doppelklick start-verein-lan.bat
Beim ERSTEN Start werden zwei Admin-Konten angelegt (PocketBase-Konsole + App-Admin, je E-Mail +
Passwort). Die Passwoerter werden NICHT gespeichert — sicher notieren (Passwortmanager)!
Voraussetzung: einmal Internet beim ersten Start (laedt das ~15 MB PocketBase-Binary). Node NICHT noetig.

AUTOSTART (Board startet beim Hochfahren von selbst):
  Linux/Pi -> ./autostart-verein-lan.sh    Windows -> Doppelklick autostart-verein-lan.bat

BEDIENUNG:
  Dieser Rechner : http://127.0.0.1:8090   (oeffnet sich automatisch im Browser)
  Andere Bretter/Tablets im gleichen Netz: die angezeigte Adresse http://<server-ip>:8090
    - Board-PC : als Lesezeichen / Kiosk-Verknuepfung anlegen
    - Tablet/Handy : in der App unter Einstellungen den Beitritts-QR scannen
  Mit dem jeweiligen Konto anmelden.

UPDATE (neue Version als dartszentrale-update-*.tar.gz):
  Paket in den Ordner 'updates' legen, dann:
  Linux/Pi -> ./update-verein-lan.sh        Windows -> Doppelklick update-verein-lan.bat
  Tauscht das Frontend aus (kein Neustart noetig); pb_data (deine DB) bleibt, die alte Version
  landet in backup/. Aendern sich Migrationen/Hooks (Backend), stattdessen den kompletten Ordner
  ersetzen — pb_data behalten.

WICHTIG (Netz/Sicherheit): Port 8090 nur im LAN lassen, NIE ins Internet weiterleiten.
Recovery (Passwort/Superuser): PocketBase-Konsole http://127.0.0.1:8090/_/ — mit dem beim ersten
  Start selbst vergebenen Superuser-Konto anmelden (Passwort sicher aufbewahren, es wird nicht gespeichert!).

Bedienung der App: docs/handbuch.md · Sicherheit: docs/security-audit.md
TXT
else
  rmdir "$B" 2>/dev/null || true
fi

# ── 03 — Vereinsmodus in der Cloud (schlank: ohne Coolify, ohne Docker) ─────
C="$TARGET/03-verein-cloud"; mkdir -p "$C"
copy_app "$C" 0
copy_pb "$C" 0
copy_cloud "$C"
cpf "$REPO/update-server.sh" "$C/"
copy_docs "$C" admin-anleitung-cloud.md go-live-checkliste-cloud.md handbuch.md
cat > "$C/LIESMICH.txt" <<'TXT'
DartsZentrale — Vereinsmodus in der Cloud (schlank: ohne Coolify, ohne Docker)
------------------------------------------------------------------------
EIN Befehl richtet alles ein — fragt Domains, Superuser und ersten App-Admin ab und
laeuft bis alles steht (PocketBase laden, App bauen, systemd-Dienste, Caddy/HTTPS):

  sudo ./einrichten-cloud.sh

Voraussetzung: ein Linux-Server (Ubuntu/Debian) und die DNS-A-Records app.* / db.*
zeigen auf die Server-IP. Details + Sicherheit: docs/admin-anleitung-cloud.md,
Go-live-Checkliste: docs/go-live-checkliste-cloud.md.

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
for b in 01-lokal-ein-board 02-verein-lan 03-verein-cloud; do [ -d "$TARGET/$b" ] && make_zip "$b"; done

echo
echo "── Update-Paket erstellen (für spätere Updates) ──"
make_update_pkg

echo
echo "✅ Fertig. Bundles + ZIPs unter: $TARGET"
du -sh "$TARGET"/*.zip "$TARGET"/dartszentrale-update-*.tar.gz 2>/dev/null || true
echo
echo "Update-Paket (später an bestehende Installationen schicken):"
echo "  dartszentrale-update-${VERSION}.tar.gz  → 01/03: in updates/ legen, in der App installieren."
echo "                                          → 02:    ./update-verein-lan.(sh|bat)"
echo
echo "Jeder Verein bekommt die passende ZIP:"
echo "  01-lokal-ein-board = ein Board lokal (kein Server, kein Login)"
echo "  02-verein-lan      = Verein im eigenen Netz  → start-verein-lan.(sh|bat)"
echo "  03-verein-cloud    = Verein in der Cloud     → sudo ./einrichten-cloud.sh"
