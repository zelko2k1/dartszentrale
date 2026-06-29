# DartsHub lokal starten — Befehls-Spickzettel

Zwei Wege: **A) Lokaler Modus** (nur Browser, kein Server – am einfachsten) und
**B) Vereinsmodus** (mit PocketBase + Test-Daten + echten Logins).

Alle Pfade relativ zum Projekt `/mnt/Data/claudebase/dartshub`.

---

## Auf einen anderen Rechner mitnehmen

**Empfohlen:** das Repo per `git clone` holen → bringt allen Code + Skripte
(`provision.mjs`, `demo-seed.mjs`, `season-*.mjs`, `pb_hooks/` …) automatisch mit.

**Zusätzlich manuell** mitnehmen (diese sind **gitignored**, kommen nicht per git):
- `docs/lokaler-betrieb.md` — dieses Runbook (⚠️ unbedingt)
- `pocketbase/demo-seed-dsv-fuerth.mjs` — Vereins-Import-Skript (falls gewünscht)
- *(optional)* `pocketbase/pb_data/` — die echte DB; nur wenn du den exakten Datenstand
  übernehmen willst statt neu zu seeden (portables SQLite, OS-unabhängig)

**NICHT mitnehmen — auf dem Ziel neu erzeugen:**
- PocketBase-Binary (`pocketbase` / `pocketbase.exe`) → plattformspezifisch, neu herunterladen
- `app/.env.local` → *optional* neu anlegen (`VITE_PB_URL=http://127.0.0.1:8090`); die
  Server-Adresse lässt sich auch direkt in der App eintragen (hat sogar Vorrang)
- `app/node_modules/` → `npm install`

### Variante ohne git (per USB-Stick)

**Auf den Stick kopieren:**
- `app/` — komplett, **aber ohne** `app/node_modules/`
- `pocketbase/` mit:
  - **allen `.mjs`-Skripten** (`provision.mjs`, `demo-seed.mjs`, `demo-seed-dsv-fuerth.mjs`,
    `reset-password.mjs`, `add-*.mjs`, `season-*.mjs`) ← werden für Schema + Daten gebraucht!
  - **`pb_hooks/`** (beide `.pb.js` — Passwort-Reset & Board-Schutz)
  - **nicht** die Binärdatei (pro OS neu laden), **nicht** `pb_data/` (entsteht neu)
- *(optional)* `docs/lokaler-betrieb.md` / die PDF

**Wichtig:** `app/` und `pocketbase/` müssen **Geschwister-Ordner** bleiben (gleiche Ebene) —
die Skripte greifen per `../app/node_modules` auf die PocketBase-Bibliothek zu.

**Auf dem Zielrechner — Reihenfolge mit Befehlen.**
(Beispielpfade: Linux `~/dartshub`, Windows `C:\dartshub`; USB Linux `/media/usb`, Windows `E:\`.)

**1) Projektordner anlegen + Dateien vom Stick kopieren** (`app/` und `pocketbase/` nebeneinander)
```bash
# Linux / Git Bash
mkdir -p ~/dartshub && cd ~/dartshub
cp -r /media/usb/app ./app
cp -r /media/usb/pocketbase ./pocketbase
```
```powershell
# Windows / PowerShell
mkdir C:\dartshub; cd C:\dartshub
Copy-Item -Recurse E:\app .\app
Copy-Item -Recurse E:\pocketbase .\pocketbase
```

**2) PocketBase-Binary fürs OS holen** → in `pocketbase/` legen
```bash
# Linux (bei ARM: linux_arm64)
cd ~/dartshub/pocketbase
wget https://github.com/pocketbase/pocketbase/releases/download/v0.39.4/pocketbase_0.39.4_linux_amd64.zip
unzip -o pocketbase_0.39.4_linux_amd64.zip pocketbase && chmod +x pocketbase
```
```powershell
# Windows
cd C:\dartshub\pocketbase
Invoke-WebRequest https://github.com/pocketbase/pocketbase/releases/download/v0.39.4/pocketbase_0.39.4_windows_amd64.zip -OutFile pb.zip
Expand-Archive pb.zip -DestinationPath . -Force
```

**3) Abhängigkeiten installieren** (braucht Internet)
```bash
# Linux
cd ~/dartshub/app && npm install
```
```powershell
# Windows
cd C:\dartshub\app; npm install
```

**4) *(optional)* Server-Default setzen** — sonst Adresse später in der App eintragen
```bash
# Linux
printf 'VITE_PB_URL=http://127.0.0.1:8090\n' > ~/dartshub/app/.env.local
```
```powershell
# Windows
'VITE_PB_URL=http://127.0.0.1:8090' | Out-File -Encoding ascii C:\dartshub\app\.env.local
```

**5) PocketBase: Superuser anlegen + starten** (eigenes Terminal, offen lassen)
```bash
# Linux
cd ~/dartshub/pocketbase
./pocketbase superuser upsert admin@dartshub.local "dartshub-admin-2026" --dir ./pb_data
./pocketbase serve --http=127.0.0.1:8090 --dir ./pb_data
```
```powershell
# Windows
cd C:\dartshub\pocketbase
.\pocketbase.exe superuser upsert admin@dartshub.local "dartshub-admin-2026" --dir .\pb_data
.\pocketbase.exe serve --http=127.0.0.1:8090 --dir .\pb_data
```
> `pb_data/` und `pb_migrations/` legt PocketBase dabei selbst an.

**6) Schema + Daten** (zweites Terminal, im `pocketbase/`-Ordner — Befehle gleich auf beiden OS)
```bash
node provision.mjs          # Schema + App-Admin (fragt beim 1. Mal E-Mail/Passwort ab)
node demo-seed-dsv-fuerth.mjs    # Beispieldaten DSV Fürth 86
```

**7) App starten** (eigenes Terminal, aus dem Projektordner — gleich auf beiden OS)
```bash
npm --prefix app run dev -- --port 5173 --strictPort   # Desktop  → http://localhost:5173
npm --prefix app run dev -- --port 5174 --strictPort   # Kiosk    → http://localhost:5174 (drittes Terminal)
```

> Zum **Testen** reicht `npm install` + `npm run dev` — ein `npm run build` ist nur für die
> Produktion (statisches `dist/`) nötig.

### Updates einspielen (ohne git)

Liegt eine neue Version vor (neuer Stick/Ordner mit frischem `app/` + `pocketbase/`), übernimmt das
mitgelieferte **Update-Skript** alles in einem Rutsch: Code übernehmen → `npm install` → (optional)
bauen. **`pb_data/` (deine Daten), `node_modules/`, `app/.env.local` und die PocketBase-Binärdatei
bleiben unangetastet.**

**Linux / Raspberry Pi / Git Bash** (im Projektordner ausführen, Stick als Quelle):
```bash
cd ~/dartshub
./update.sh /media/usb            # Quelle = Stick (ohne Argument: /media/usb)
./update.sh /media/usb --build    # zusätzlich app/dist bauen (nur wenn ihr dist/ ausliefert)
```

**Windows / PowerShell:**
```powershell
cd C:\dartshub
.\update.ps1 -Source E:\          # Quelle = Stick
.\update.ps1 -Source E:\ -Build   # zusätzlich app\dist bauen
```

Danach:
1. **App-Terminal(s) neu starten** (`npm --prefix app run dev …`) — der Dev-Server übernimmt die
   neuen Dateien sauber erst nach Neustart.
2. Hat sich das **Schema** geändert, **PocketBase neu starten** (Migrations laufen beim Start
   automatisch; bei Bedarf `node provision.mjs`).
3. An den **Boards die Seite neu laden** (ggf. zweimal — der PWA-Cache hält die alte Version evtl.
   noch einen Ladevorgang lang).

> **Wichtig:** das **lokale** `update.sh`/`update.ps1` im Projektordner starten (nicht die Kopie auf
> dem Stick) — es nimmt seinen eigenen Ort als Ziel. Wer nicht zwischen geänderten Dateien
> unterscheiden will: einfach den ganzen `app/`-Ordner vom Stick (ohne `node_modules/`) mitnehmen —
> das Skript ersetzt `src/`+`public/` ohnehin komplett.

### Linux: Vereinsmodus als Dienst (Autostart)

Auf Linux müssen im **Vereinsmodus** zwei Dinge laufen — **PocketBase** (Backend, `:8090`) und das
**Frontend** (`:4173`). Zwei Skripte im Projekt-Root übernehmen das:

- **Manuell starten** (zum Testen; Strg+C beendet beide):
  ```bash
  ./start-dartshub.sh
  ```
- **Als Daemon einrichten** (systemd-User-Dienste: Autostart beim Boot, Auto-Restart, journald-Logs):
  ```bash
  ./autostart-einrichten.sh        # baut + installiert + startet beide Dienste
  ```
  Verwaltung danach:
  ```bash
  systemctl --user status dartshub-web dartshub-pocketbase
  journalctl --user -u dartshub-pocketbase -f     # Logs live
  systemctl --user restart dartshub-web           # nach einem Rebuild (z. B. update.sh --build)
  ./autostart-entfernen.sh                         # Autostart wieder entfernen (Daten bleiben)
  ```

**Voraussetzung:** PocketBase einmalig einrichten (Superuser + Schema):
```bash
cd pocketbase && ./pocketbase superuser upsert <mail> '<pw>' --dir ./pb_data && node provision.mjs
```
Mehrere Boards im LAN? `VITE_PB_URL` auf die LAN-IP setzen, neu bauen, und in den Units
`127.0.0.1 → 0.0.0.0` ändern. (Windows-Pendant: `start-dartshub.bat` / `autostart-einrichten.bat`.)

### Wichtigste Git-Befehle

Repo ist **privat** → auf neuem Rechner zuerst anmelden, sonst geht kein clone/push.

```bash
# einmalig auf neuem Rechner
gh auth login && gh auth setup-git          # GitHub-Anmeldung (oder Token beim push)
git config --global user.name  "Heiko Frenzel"
git config --global user.email "hfrenzel2k1@gmail.com"
git clone https://github.com/zelko2k1/dartshub.git

# täglich
git status                  # was ist geändert?
git pull                    # neuesten Stand holen
git add -A                  # alle Änderungen vormerken
git commit -m "Beschreibung"
git push                    # hochladen
git log --oneline -10       # Historie

# ansehen / rückgängig
git diff                    # Änderungen (ungestaged) ansehen
git restore <datei>         # Änderung an Datei verwerfen
git restore --staged <datei># aus „add" zurücknehmen

# Branches (optional)
git checkout -b feature/xyz # Zweig anlegen + wechseln
git checkout main           # zurück auf main
git merge feature/xyz       # in main übernehmen
git branch -d feature/xyz   # erledigten Zweig löschen
```

---

## 0. Benötigte Programme

| Programm | Wofür | Linux | Windows |
|---|---|---|---|
| **Node.js 20+ (LTS)** (mit `npm`) | App bauen/starten + `.mjs`-Skripte | Paketmanager / nodejs.org / nvm | Installer von nodejs.org |
| **Browser** (Edge/Chrome empf.) | App nutzen (PWA-Installation) | vorhanden | vorhanden |
| **PocketBase 0.39.x** (eine Binärdatei) | Backend – **nur Vereinsmodus** | `pocketbase` + `chmod +x` | `pocketbase.exe` |
| **Git** | Code holen/aktualisieren | `apt install git` | git-scm.com (bringt **Git Bash** mit) |
| **Terminal** | Befehle eingeben | bash | PowerShell **oder** Git Bash |

- **Nur lokaler Modus** (siehe A) genügt **Node.js + Browser** — PocketBase erst für den Vereinsmodus.
- **Windows:** Am einfachsten **Git Bash** nutzen → alle Befehle unten gelten 1:1. In PowerShell stattdessen
  `.\pocketbase.exe …` und Variablen via `$env:VAR="wert"; node skript.mjs`.

## 0b. Programme installieren

### Ubuntu
```bash
# Node.js 20+ (LTS) via NodeSource (Ubuntus apt-Node ist oft zu alt)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git unzip

# PocketBase 0.39.4 in den pocketbase-Ordner (bei ARM: linux_arm64)
cd pocketbase
wget https://github.com/pocketbase/pocketbase/releases/download/v0.39.4/pocketbase_0.39.4_linux_amd64.zip
unzip -o pocketbase_0.39.4_linux_amd64.zip pocketbase && chmod +x pocketbase
./pocketbase --version
```

### Windows
```powershell
# in PowerShell (Windows 10/11)
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```
Alternativ Node-LTS von nodejs.org und Git von git-scm.com installieren (Git bringt **Git Bash**
mit → alle Befehle hier gelten 1:1). PocketBase: `pocketbase_0.39.4_windows_amd64.zip` aus den
GitHub-Releases entpacken, `pocketbase.exe` in den `pocketbase\`-Ordner legen.
Start: `.\pocketbase.exe serve --http=127.0.0.1:8090 --dir .\pb_data`.

Prüfen: `node -v` (≥ 20), `npm -v`, `git --version`.

## 0c. Einmalig: Abhängigkeiten installieren

```bash
cd /mnt/Data/claudebase/dartshub/app
npm install
```

---

## A) Lokaler Modus — nur Browser, kein Server

Schnellster Weg für die eigene Nutzung auf einem Gerät. Daten liegen im Browser
(localStorage), Beispieldaten werden beim ersten Start automatisch angelegt.

```bash
cd /mnt/Data/claudebase/dartshub/app
# sicherstellen, dass NICHT auf einen Server gezeigt wird:
#   app/.env.local löschen ODER VITE_PB_URL leer lassen
npm run dev
```

Dann **http://localhost:5173** öffnen. Falls die App im Login-Screen landet:
Einstellungen → Nutzungsart → **Lokal** wählen.

> Kein Login, keine Ligen/Mannschaften/Benutzer-Verwaltung — bewusst reduziert.
> Zum Zurücksetzen: im Browser den localStorage der Seite leeren.

---

## B) Vereinsmodus — PocketBase + Test-Daten

Voller Funktionsumfang (Login, Rollen, Ligen, Mannschaften, Saisons …).

### 1. PocketBase starten
Im **eigenen Terminal** (läuft im Vordergrund — offen lassen), aus dem `pocketbase/`-Ordner:

```bash
# Linux / Git Bash
cd /mnt/Data/claudebase/dartshub/pocketbase
./pocketbase serve --http=127.0.0.1:8090 --dir ./pb_data
```
```powershell
# Windows / PowerShell
cd C:\Pfad\zu\dartshub\pocketbase
.\pocketbase.exe serve --http=127.0.0.1:8090 --dir .\pb_data
```
Läuft auf http://127.0.0.1:8090 · Verwaltungs-Konsole: **http://127.0.0.1:8090/_/**

**Erster Start — Superuser (DB-Admin) anlegen** (nur einmal nötig). Entweder per CLI *vor* dem `serve`:
```bash
./pocketbase superuser upsert admin@dartshub.local "dartshub-admin-2026" --dir ./pb_data
```
…oder im Browser unter `/_/` das angezeigte Formular ausfüllen.
> Die Skripte melden sich mit `admin@dartshub.local` / `dartshub-admin-2026` an — nimm dieselben
> Zugangsdaten, sonst `PB_SU_EMAIL`/`PB_SU_PASS` voranstellen.

**Stoppen:** Strg+C im PocketBase-Terminal. Daten bleiben im Ordner `pb_data/`.

### 2. Schema + App-Admin anlegen (idempotent)
In einem zweiten Terminal:
```bash
cd /mnt/Data/claudebase/dartshub/pocketbase
node provision.mjs
```
Legt alle Collections (inkl. `seasons`/`season_snapshots`) an und fragt — falls noch
**kein** Admin existiert — interaktiv nach E-Mail + Passwort des ersten App-Admins
(nicht-interaktiv per `APP_ADMIN_EMAIL=… APP_ADMIN_PASS=… node provision.mjs`).
**Nach jedem `git pull` erneut ausführen**, falls sich das Schema geändert hat
(ein vorhandener Admin bleibt unberührt).

> **Dev-Konvention:** Wer die Demo-Skripte/Test-Logins unten 1:1 nutzen will, tippt beim
> Prompt `chef@dartshub.local` / `dartshub123` — dann passen `demo-seed*.mjs` und die
> Test-Login-Tabelle zusammen. (Das ist nur eine lokale Empfehlung, kein fest verdrahtetes Konto.)

### 3. Test-Daten einspielen
```bash
node demo-seed.mjs                 # Beispiel-Verein: 10 Spieler, 2 Teams, Liga + Spielplan,
                              # Termine, 6 Konten, 3 Matches, aktive Saison 2025/26
# optional:
node demo-add-players.mjs          # +70 zusätzliche Spieler (Kader/Last-Test)
node add-board-account.mjs    # rechtearmes Board-Konto für Kiosk-Tests
```
> `demo-seed.mjs` **leert** die Inhalts-Collections vorher und legt frisch an
> (App-Admin bleibt). Ideal zum Zurücksetzen auf einen sauberen Stand.

### 4. App auf den Server zeigen lassen — zwei Wege

**Vorrang hat immer die Eingabe in der App.** `VITE_PB_URL` ist nur ein Build-Default
(greift, wenn in der App nichts eingetragen ist). Reihenfolge im Code:
`App-Einstellung → sonst VITE_PB_URL → sonst lokaler Modus`.

- **a) In der App** (kein `.env.local` nötig): App starten → Einstellungen →
  Nutzungsart **Verein** → **Server-/PocketBase-Adresse** `http://127.0.0.1:8090` eintragen.
  Wird gerätelokal gespeichert.
- **b) Als Default per Datei** `app/.env.local` (existiert bereits) — bequem, wenn jede
  frisch gebaute Instanz sofort auf den Server zeigen soll (z. B. Deployment **oder** das
  Zwei-Instanzen-Setup :5173/:5174, damit man die Adresse nicht in beiden Browsern tippt):
  ```
  VITE_PB_URL=http://127.0.0.1:8090
  ```

### 5. App starten
```bash
cd /mnt/Data/claudebase/dartshub/app
npm run dev
```
**http://localhost:5173** öffnen und anmelden.

### Test-Logins (Demo-Konten aus `demo-seed*.mjs`, alle Passwort `dartshub123`)
| Rolle | E-Mail |
|------|--------|
| Admin | der beim `provision.mjs`-Prompt gewählte Admin (Dev-Konvention: `chef@dartshub.local`) |
| Kapitän | `sandra.koester@sv-adler.de` |
| Spieler | `daniel.weber@sv-adler.de` |
| Betrachter (nur lesen) | `schriftfuehrung@sv-adler.de` |
| Inaktiv (Login gesperrt) | `t.reiter@web.de` |
| PocketBase-Konsole | `admin@dartshub.local` / `dartshub-admin-2026` |

---

## Zwei Instanzen (Desktop + Kiosk testen)

Kiosk-Modus braucht einen anderen localStorage-Origin → zweiter Port:
```bash
npm --prefix app run dev -- --port 5173 --strictPort   # Desktop
npm --prefix app run dev -- --port 5174 --strictPort   # Kiosk (zweites Terminal)
```
Auf :5174 mit dem **Board-Konto** (aus `add-board-account.mjs`) anmelden → Kiosk.

> ⚠️ **Nicht zwei Dev-Server laufen lassen, während Code geändert wird** — sie teilen
> sich den Vite-Cache und liefern dann teils veralteten Code aus. Beim Entwickeln nur
> einen Server; den zweiten nur zum Testen. Reparatur: Server stoppen,
> `rm -rf app/node_modules/.vite`, neu starten.

---

## Skripte-Referenz (pocketbase/) — was macht was

Alle Skripte sind Node-Skripte, melden sich als **PocketBase-Superuser** an und sind
idempotent (mehrfach ausführbar). Standard-Ziel ist die lokale Instanz `:8090`; für die
Cloud `PB_URL`, `PB_SU_EMAIL`, `PB_SU_PASS` als Umgebungsvariablen voranstellen.

### Wie führe ich die .mjs-Skripte aus?

`.mjs` = JavaScript-Datei, die mit **Node.js** läuft. Voraussetzungen:

1. **Node.js v20+** installiert (`node -v` zum Prüfen).
2. **`npm install` in `app/` ausgeführt** — die Skripte nutzen die PocketBase-Bibliothek
   aus `app/node_modules` (per relativem Import). Ohne `node_modules` schlagen sie fehl.
3. **PocketBase läuft** (`./pocketbase serve …` in einem anderen Terminal) — die Skripte
   sprechen die laufende Instanz an.
4. Aus dem **`pocketbase/`-Verzeichnis** aufrufen (die relativen Pfade gehen davon aus).

```bash
cd /mnt/Data/claudebase/dartshub/pocketbase

node provision.mjs                                   # einfacher Aufruf
USER_EMAIL=chef@dartshub.local NEW_PW="abc12345" node reset-password.mjs   # mit Variablen
node season-import.mjs dartshub-saison-2024-25.json  # mit Datei-Argument

# gegen eine Cloud-Instanz statt lokal:
PB_URL=https://db.deinverein.de PB_SU_EMAIL=admin@… PB_SU_PASS=… node demo-seed.mjs
```

`VAR=wert node skript.mjs` setzt eine Umgebungsvariable nur für diesen einen Aufruf.
Mehrere einfach hintereinander (durch Leerzeichen getrennt) voranstellen.

| Skript | Zweck | Aufruf |
|--------|-------|--------|
| **provision.mjs** | **Schema-Setup.** Legt alle Collections an/aktualisiert sie (players, teams, leagues, events, matches, users, seasons, season_snapshots …), setzt die API-Rechte und den ersten App-Admin. Macht außerdem den Saison-Backfill (aktive Saison + `seasonId`/`playerId` nachziehen). **Pflicht nach jedem Schema-Update / `git pull`.** | `node provision.mjs` |
| **demo-seed.mjs** | **Test-Daten (generischer Beispielverein).** Leert die Inhalts-Collections und legt neu an: 10 Spieler, 2 Mannschaften, Liga mit Spielplan, Termine, 6 Konten, 3 gespielte Matches, aktive Saison 2025/26. App-Admin bleibt. Ideal zum Zurücksetzen. | `node demo-seed.mjs` |
| **demo-seed-dsv-fuerth.mjs** | **Import „DSV Fürth 86".** Frische DB: Saison 2026/27 (Sept–Juli), 20 Mitglieder (als Spieler + Konten), 2 Mannschaften (je 8 + Kapitän), 2 Ligen à 10 Teams mit vollständigem Hin-/Rückrunden-Spielplan (ohne Ergebnisse, Termine über die Saison verteilt). | `node demo-seed-dsv-fuerth.mjs` |
| **demo-add-players.mjs** | Legt **70 zusätzliche Spieler** an (additiv, löscht nichts). Zum Befüllen großer Kader / Last-Test der Listen. | `COUNT=70 node demo-add-players.mjs` |
| **add-board-account.mjs** | Legt ein **rechtearmes Board-Konto** (Rolle „board") für Kiosk-Rechner an (darf nur spielen, nichts verwalten). | `BOARD_EMAIL=board@… BOARD_PW=… node add-board-account.mjs` |
| **reset-password.mjs** | **Passwort eines App-Kontos zurücksetzen** + Konto reaktivieren. Notfall, wenn man sich aus der App ausgesperrt hat (Superuser ist der Rettungsanker). | `USER_EMAIL=… NEW_PW=… node reset-password.mjs` |
| **season-export.mjs** | **Saison als JSON-Bundle sichern** (Ligen, Teams, Termine, Spiele, Snapshot). Wegsicherung / Re-Import-Grundlage / Grafana-Feed. | `SEASON_NAME="2024/25" node season-export.mjs` |
| **season-offload.mjs** | **Saison auslagern**: löscht die (schweren) Spiele einer *archivierten* Saison aus der DB und setzt `offloaded=true` → gibt Platz frei. Tabellen/Kader/Termine bleiben. Vorher exportieren! | `SEASON_NAME="2024/25" node season-offload.mjs` |
| **season-import.mjs** | **Bundle zurückspielen**: legt fehlende Datensätze wieder an und setzt `offloaded=false`. Macht ein Auslagern rückgängig. | `node season-import.mjs <bundle.json>` |

> Export / Abschließen / Auslagern / Re-Import gibt es auch **in der App** unter
> Einstellungen → **Saison** (Admin).

### App-Skripte (app/, via npm)
| Befehl | Zweck |
|--------|-------|
| `npm run dev` | Entwicklungs-Server mit Hot-Reload (http://localhost:5173) |
| `npm run build` | Production-Build: TypeScript prüfen + Bundle nach `dist/` |
| `npm run preview` | das gebaute `dist/` zum **Testen** ausliefern (via Vite, braucht Dev-Abhängigkeiten) |
| `npm run serve` | das gebaute `dist/` im **Betrieb** ausliefern (`node serve-dist.mjs`, abhängigkeitsfrei, SPA-Fallback; `HOST`/`PORT` per Env) |
| `npm run lint` | ESLint über den Code |

---

## Production-Build prüfen
```bash
cd /mnt/Data/claudebase/dartshub/app
npm run build      # tsc + vite build → dist/
npm run preview    # statisches dist/ lokal testen
```

### Nur den `app/`-Ordner bauen (z. B. vom USB-Stick)

Der `app/`-Ordner ist **selbstständig** — er braucht zum Bauen weder `pocketbase/` noch
sonst etwas. Voraussetzung bleibt **Node.js + npm** auf dem Zielrechner.

- **`app/` ohne `node_modules` kopieren** (empfohlen, klein): drüben `npm install`
  (braucht Internet) → `npm run build`.
- **`app/` mit `node_modules` kopieren**: baut offline **ohne** `npm install` — aber **nur
  auf demselben Betriebssystem**. ⚠️ Linux ↔ Windows schlägt fehl (plattformspezifische
  Binärdateien wie esbuild/Rollup). Dann `node_modules` löschen und `npm install` neu.
- **Nur ausführen, nicht bauen:** der fertige **`dist/`-Ordner** ist statisch und läuft
  ohne `node_modules` — z. B. mit `node app/serve-dist.mjs` (nur Node-Standardbibliothek,
  via `npm run serve`) oder einem beliebigen Webserver. (`npm run preview` braucht dagegen
  die Dev-Abhängigkeiten.)

> Nie `node_modules` zwischen verschiedenen Betriebssystemen kopieren.

## Stoppen
- Dev-Server / PocketBase: im jeweiligen Terminal **Strg+C**.
- Hängende Ports freimachen: `fuser -k 5173/tcp 5174/tcp 8090/tcp`
