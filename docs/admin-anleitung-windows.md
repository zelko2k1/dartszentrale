# DartsHub auf Windows – Inbetriebnahme & Updates

Schritt für Schritt für **Windows**, ohne Vorkenntnisse. (Linux/Raspberry Pi? →
[admin-anleitung-linux.md](admin-anleitung-linux.md).)

> **Welcher Weg ist meiner?**
> - **Nur ein Brett/Gerät, schnell zählen, keine Anmeldung** → **Abschnitt 1**. Am einfachsten.
> - **Mehrere Geräte, echte Logins, Ligen/Mannschaften** → **Abschnitt 2**.
> - **Server im Internet/Cloud** (von überall erreichbar) → [`cloud-schlank-anleitung.md`](cloud-schlank-anleitung.md) (Linux-Server).
>
> Tägliche Bedienung: [`handbuch.md`](handbuch.md).

---

## 0. Einmal vorweg

### 0a. Die App auf den PC holen — der „Projektordner"
Du brauchst die Programmdateien als Ordner. Du bekommst sie **per USB-Stick** (vom Einrichter).

> **Projektordner** = der Ordner, in dem **`app`** und **`pocketbase`** direkt nebeneinander liegen.
> Alle Befehle und Doppelklick-Skripte gehören in **diesen** Ordner.

### 0b. Node.js installieren (Pflicht)
1. [nodejs.org](https://nodejs.org) öffnen → **LTS**-Version laden → Installer starten → **Weiter / Weiter / Fertig**.
2. **Erfolg prüfen:** ein Terminal öffnen (0c), `node -v` tippen, **Enter** → es muss `v20…`/`v22…` erscheinen.

### 0c. Ein „Terminal" im Projektordner öffnen
Den Projektordner im **Explorer** öffnen → oben in die **Adressleiste** klicken → `cmd` tippen → **Enter**.
(Es öffnet sich ein schwarzes Fenster — da tippst du die Befehle rein.)

> Läuft ein Befehl „endlos" weiter (z. B. ein Server), ist das **gewollt** — Fenster **offen lassen**.
> Für einen weiteren Befehl ein **zweites** Terminal öffnen.

### 0d. Platzhalter in Befehlen
Steht etwas in **spitzen Klammern** wie `<starkes-pw>` oder `<server-ip>`, ersetzt du es durch deinen
Wert — **die Klammern `< >` weglassen.**
- **Server-IP finden:** im Terminal `ipconfig` → Zeile **„IPv4-Adresse"** (z. B. `192.168.1.50`).
  Auf demselben PC geht auch `127.0.0.1`.

---

## 1. Lokaler Modus (ein Gerät, kein Server)

**Einfach:** Doppelklick auf **`start-lokal.bat`** im Projektordner → der Browser öffnet die App →
beim **ersten Start** „**Lokal**" wählen. Fertig. (Kein Server, kein PocketBase — die Daten liegen im Browser.)

> Schließt sich das schwarze Fenster **sofort wieder**? Dann fehlt meist **Node.js** (0b).
> **Kiosk-Board, das beim Anmelden von selbst startet:** Doppelklick **`autostart-lokal.bat`**.

**Von Hand (Terminal):**
```bat
cd app
npm install
npm run dev
```
Dann im Browser **`http://localhost:5173`** öffnen. **Terminal-Fenster offen lassen.**

---

## 2. Vereinsmodus (mehrere Geräte, Server im eigenen Netz)

Hier laufen **zwei** Programme gleichzeitig: **PocketBase** (Datenbank) und das **Frontend** (die App).

### 2 — Empfohlen: geführte Einrichtung (Doppelklick)

Doppelklick auf **`einrichten-lan.bat`**. Das Skript **fragt das Nötige ab** (Netz-Zugriff/Server-IP,
Superuser-Login, erster App-Admin) und macht dann **alles** automatisch: **`pocketbase.exe`
herunterladen**, App bauen, Superuser + Schema + ersten Admin anlegen, beide Programme starten und
**Autostart beim Anmelden** einrichten. Danach ist die App im Netz unter **`http://<server-ip>:4173`**
erreichbar.

> Voraussetzung: nur **Node.js** (0b). PocketBase lädt das Skript selbst.
> Update später: Doppelklick **`update-server.bat`** — baut neu **und startet die Dienste neu**.

Wer lieber jeden Schritt selbst kontrolliert, folgt **2a + 2b von Hand**:

### 2a. PocketBase von Hand einrichten (nur einmal)

**Schritt 1 — herunterladen:** [Release-Seite](https://github.com/pocketbase/pocketbase/releases/tag/v0.39.4)
öffnen → **`pocketbase_0.39.4_windows_amd64.zip`** laden → Rechtsklick → **„Alle extrahieren"** → die
Datei **`pocketbase.exe`** in den Ordner **`pocketbase`** kopieren.

**Schritt 2 — Server-Admin (Superuser) anlegen** (Verwalter der Datenbank, *nicht* dein App-Login;
starkes Passwort merken). Terminal im Ordner `pocketbase` (0c), dann:
```bat
pocketbase.exe superuser upsert admin@deinverein.de "<starkes-pw>" --dir .\pb_data
```

**Schritt 3 — PocketBase starten** (Schema/Funktionen entstehen automatisch):
```bat
pocketbase.exe serve --http=0.0.0.0:8090 --dir .\pb_data --migrationsDir .\pb_migrations --hooksDir .\pb_hooks
```
> **Erfolg:** „Server started" erscheint. **Fenster offen lassen!** Fragt die **Windows-Firewall** →
> **„Zugriff zulassen"**. (`0.0.0.0` = von anderen Geräten erreichbar; nur dieser PC: `127.0.0.1`.)

**Schritt 4 — deinen App-Admin anlegen** (dein Login *in der App*):
1. Browser → **`http://<server-ip>:8090/_/`** → mit dem Superuser aus Schritt 2 anmelden.
2. Links auf **`users`** → **„+ New record"**.
3. **email** = Login-Mail, **password** = starkes Passwort, **role** = **`admin`**, Häkchen bei
   **active** → **„Create".** *(Keine Beispieldaten nötig.)*

### 2b. Frontend starten

**Schritt 1 — Server-Adresse hinterlegen** (Datei `app\.env.local` anlegen). Im Terminal (`<server-ip>` ersetzen):
```bat
cd app
echo VITE_PB_URL=http://<server-ip>:8090> .env.local
```

**Schritt 2 — bauen & starten:**
```bat
cd app
npm install
npm run build
npm run serve
```
> Sollen **andere Geräte im LAN** dieses Frontend erreichen (statt je Gerät ein eigenes):
> `set HOST=0.0.0.0&& npm run serve` — dann über `http://<server-ip>:4173`.

Browser → **`http://localhost:4173`** → beim **ersten Start „Vereinsmodus"** wählen → mit dem
**App-Admin** (2a, Schritt 4) anmelden. **Fenster offen lassen.**

> **Bequemer:** **`start-lan.bat`** startet PocketBase **und** Frontend zusammen.
> **Autostart beim Hochfahren:** Doppelklick auf **`autostart-lan.bat`** (Voraussetzung: 2a erledigt).

### 2c. Die zwei Logins nicht verwechseln

| | **App-Admin** | **PocketBase-Superuser** |
|---|---|---|
| Wofür? | normale Nutzung (Verein verwalten) | Datenbank/Server verwalten |
| Wo anmelden? | in der App (`…:4173`) | unter `…:8090/_/` |
| Wie oft? | täglich | selten (Backups, Notfall) |

---

## 3. Updates einspielen

Eine neue Version sind neue Dateien für `app`. **Deine Daten (`pb_data`) und Konfiguration bleiben
unangetastet.**

> **Lokales Paket (ein Board):** dort heißt das Update-Skript **`update-lokal.bat`** (Linux:
> `./update-lokal.sh`) — gleicher Ablauf, ohne PocketBase. Der folgende Befehl `update-server.bat`
> gilt fürs **Vereins-Paket**.

**Einfach (neue Version auf USB-Stick):** Doppelklick auf **`update-server.bat`** — übernimmt die
neuen Dateien vom Stick, baut die App neu **und startet die Dienste neu**. Per Doppelklick wird
**Laufwerk `E:\`** angenommen; hat dein Stick einen anderen Buchstaben, im Terminal mit Laufwerk
aufrufen, z. B. `update-server.bat F:\`. *(Alternativ in PowerShell: `.\update-server.ps1 -Source E:\`.)*

> Wurde der Server per **`einrichten-lan.bat`** eingerichtet, schließt das Update die DartsHub-Fenster
> und startet sie automatisch neu. Lief alles **von Hand**, danach `start-lan.bat` erneut starten.

**Danach:** an den **Brettern die Seite neu laden** (zur Sicherheit zweimal, wegen PWA-Cache).

---

## 4. Spickzettel — wichtigste Befehle/Aktionen

| Zweck | Wie |
|---|---|
| **Lokal starten** (ein Board) | Doppelklick **`start-lokal.bat`** · Autostart: **`autostart-lokal.bat`** |
| **Vereinsmodus einrichten (geführt)** | Doppelklick **`einrichten-lan.bat`** |
| **Verein von Hand starten/Autostart** | **`start-lan.bat`** · **`autostart-lan.bat`** |
| **Update (USB)** | Doppelklick **`update-server.bat`** |
| Lokal von Hand | `cd app` → `npm run dev` |
| PocketBase starten | `pocketbase.exe serve --http=0.0.0.0:8090 --dir .\pb_data --migrationsDir .\pb_migrations --hooksDir .\pb_hooks` |

**Optional / für später (fortgeschritten):**

| Zweck | Befehl (eine Zeile) |
|---|---|
| Board-Konto fürs Brett | `set BOARD_EMAIL=board1@deinverein.de && set BOARD_PW=<pw> && set PB_URL=http://<ip>:8090 && set PB_SU_EMAIL=<mail> && set PB_SU_PASS=<pw> && node pocketbase\add-board-account.mjs` |
| App-Passwort zurücksetzen | `set USER_EMAIL=<mail> && set NEW_PW=<min-8> && set PB_URL=http://<ip>:8090 && set PB_SU_EMAIL=<mail> && set PB_SU_PASS=<pw> && node pocketbase\reset-password.mjs` |

---

## 5. Wenn etwas nicht klappt

- **Schwarzes Fenster geht sofort zu** → meist fehlt **Node.js** (0b) bzw. die **`pocketbase.exe`** im Ordner `pocketbase`.
- **Browser sagt „nicht erreichbar"** → läuft das passende Fenster noch? (App-Fenster für `…:5173`/`…:4173`,
  PocketBase-Fenster für `…:8090`.) Stimmen Adresse/Port?
- **Andere Geräte erreichen den Server nicht** → PocketBase mit `0.0.0.0` gestartet? Firewall „Zugriff
  zulassen"? Stimmt die **Server-IP** in `app\.env.local` (0d)?
- **`.env.local` wirkt nicht** → heißt die Datei wirklich exakt `.env.local` (Windows blendet die Endung
  `.txt` manchmal aus → im Explorer „Dateinamenerweiterungen" einblenden und prüfen)? Liegt sie im Ordner **`app`**?
- **„Port belegt"** → das Programm läuft schon in einem anderen Fenster. Eines schließen.

---

## 6. Notfälle (Passwörter)

- **App-Passwort vergessen** → mit dem **Superuser** zurücksetzen: `…:8090/_/` → `users` → Konto → neues Passwort.
- **Superuser-Passwort weg** → neu setzen: `pocketbase.exe superuser upsert <mail> "<neues-pw>" --dir .\pb_data`.
- **Vorsorge:** Superuser-Passwort im **Passwortmanager** sichern und früh einen **zweiten App-Admin** anlegen.

---

## Anhang A — Welche Dateien braucht der Betrieb?

**Müssen da sein (Betrieb):**
- `app\` — das **Frontend**. Ohne `node_modules\` und `dist\` (die entstehen beim ersten
  `npm install` / `npm run build`).
- **Nur Vereinsmodus:** `pocketbase\pb_migrations\` + `pocketbase\pb_hooks\` (Schema & Funktionen),
  die selbst geladene **`pocketbase.exe`**, und `pocketbase\pb_data\` (deine Datenbank — entsteht
  beim Start). Außerdem `app\.env.local` (Server-Adresse).
- Die Start-/Autostart-/Update-Skripte (siehe Tabelle).

**Beim Update austauschen:** das neue `app\src`, `app\public` und die Konfig-Dateien
(`package.json` usw.). **`pb_data` und `app\.env.local` bleiben unangetastet** — `update-server.bat`
macht genau das.

## Anhang B — Welches Skript wofür?

| Datei | Zweck |
|---|---|
| `start-lokal.bat` | **Lokal starten** (ein Board, nur Frontend — kein Server) |
| `autostart-lokal.bat` | **Lokaler Autostart** (nur Frontend, fürs Kiosk-Board) |
| `update-lokal.bat` | **Lokal-Update** (nur Frontend, kein PocketBase) |
| `einrichten-lan.bat` | **Geführte Vereinsmodus-Einrichtung** (Download, Build, Admin, Autostart) — empfohlen |
| `start-lan.bat` | **Verein von Hand starten** (PocketBase **und** Frontend) |
| `autostart-lan.bat` | **Vereins-Autostart** beim Hochfahren einrichten |
| `update-server.bat` | **Update** einspielen (Daten bleiben, Dienste starten neu) |
| `update-server.ps1` | Update über PowerShell (Alternative zu `.bat`) |
| *Vereinsmodus, einmalig/selten:* | |
| `pocketbase\provision.mjs` | Schema anlegen/aktualisieren + Admin (Alternative zum Auto-Schema) |
| `pocketbase\add-board-account.mjs` | Board-Konto fürs Brett anlegen |
| `pocketbase\reset-password.mjs` | App-Passwort per Superuser zurücksetzen |
| `pocketbase\season-export\import\offload.mjs` | Saison sichern · zurückspielen · auslagern |
| `pocketbase\_security-guard.mjs` | interner Helfer (nicht direkt starten) |
| `pocketbase\demo-*.mjs` | **nur Testdaten — NICHT im Betrieb verwenden** |

> Fertige Verteil-Pakete (genau diese Dateien je Betriebsart, ohne Test-/Secret-Dateien) erzeugt der
> Einrichter mit dem `copy2share`-Vorgang — du bekommst dann einen einzelnen, passenden Ordner.
