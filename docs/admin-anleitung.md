# DartsHub – Admin-Anleitung: Inbetriebnahme & Updates

Kurze, technik-arme Anleitung **nur** dazu, wie du die App zum Laufen bringst und aktuell hältst —
**lokal**, im **Vereinsmodus** und beim **Update**. Ohne Beispiel-/Testdaten.

> Tägliche Bedienung (Spieler, Mannschaften, Ligen, Counter, Rollen): [`handbuch.md`](handbuch.md).
> Online/Cloud betreiben: [`cloud-anleitung.md`](cloud-anleitung.md).
> Alle Befehle gehen vom Projektordner aus (dort liegen `app/` und `pocketbase/` nebeneinander).

---

## 0. Was du brauchst

| | Lokaler Modus | Vereinsmodus |
|---|:---:|:---:|
| **Node.js 20+** (mit `npm`) | ✓ | ✓ |
| **Browser** (Edge/Chrome) | ✓ | ✓ |
| **PocketBase-Binary** (v0.39.x) | – | ✓ |

---

## 1. Lokaler Modus (ein Gerät, kein Server)

Schnellster Weg — alles im Browser, keine Anmeldung, kein Server.

**Bequem (empfohlen):**
- **Windows:** Doppelklick auf `start-dartshub.bat`
- **Linux / Raspberry Pi:** `./start-dartshub.sh`

**Von Hand:**
```bash
cd app
npm install        # nur beim ersten Mal
npm run dev         # öffnet auf http://localhost:5173
```

Beim **ersten Start** fragt die App nach dem Modus → **„Lokal"** wählen. Fertig.

---

## 2. Vereinsmodus (mehrere Geräte, Server im eigenen Netz)

Hier laufen **zwei** Dinge: **PocketBase** (Backend) und das **Frontend**.

### 2a. PocketBase einrichten (einmalig)

1. **Binary holen** und in den `pocketbase/`-Ordner legen (ARM/Pi: `_linux_arm64`):
   ```bash
   cd pocketbase
   wget https://github.com/pocketbase/pocketbase/releases/download/v0.39.4/pocketbase_0.39.4_linux_amd64.zip
   unzip -o pocketbase_0.39.4_linux_amd64.zip pocketbase && chmod +x pocketbase
   ```
2. **Superuser anlegen** (Server-/DB-Verwaltung — starkes Passwort!):
   ```bash
   ./pocketbase superuser upsert admin@deinverein.de "<starkes-pw>" --dir ./pb_data
   ```
3. **Starten** — Schema + Hooks (Rollen/Passwort-Reset) entstehen dabei automatisch:
   ```bash
   ./pocketbase serve --http=0.0.0.0:8090 --dir ./pb_data \
       --migrationsDir ./pb_migrations --hooksDir ./pb_hooks
   ```
   (Nur dieses eine Gerät: `--http=127.0.0.1:8090`. Für andere Boards im Netz: `0.0.0.0`.)
4. **Ersten App-Admin anlegen** (das ist dein Login *in der App*, getrennt vom Superuser):
   `http://<server-ip>:8090/_/` öffnen → Collection **`users`** → neuer Record:
   `role = admin`, `active = true`, E-Mail + **starkes Passwort**. *(Keine Seed-/Demodaten nötig.)*

### 2b. Frontend starten

1. Server-Adresse hinterlegen — Datei `app/.env.local`:
   ```
   VITE_PB_URL=http://<server-ip>:8090
   ```
2. Bauen & starten:
   ```bash
   cd app && npm install && npm run build
   npm run preview -- --port 4173 --strictPort     # http://localhost:4173
   ```
3. Im Browser öffnen → beim **ersten Start „Vereinsmodus"** wählen → mit dem **App-Admin** anmelden.

**Bequemer (beide Dienste auf einmal):**
- **Linux/Pi:** `./start-dartshub.sh` · **Windows:** `start-dartshub.bat` (startet PocketBase **und** Frontend)
- **Autostart beim Hochfahren:** `./autostart-einrichten.sh` (Linux, systemd-Dienst) bzw.
  `autostart-einrichten.bat` (Windows). Voraussetzung 2a (Superuser + App-Admin) muss einmalig erledigt sein.

---

## 3. Updates einspielen

Eine neue Version besteht aus neuen Dateien in `app/` (und selten `pocketbase/`). **Deine Daten
(`pb_data/`) und Konfiguration bleiben dabei unangetastet.**

**Mit git:**
```bash
git pull
cd app && npm install && npm run build
# danach: laufende Dienste/Terminals neu starten
```

**Ohne git (per USB-Stick):**
- **Linux/Pi:** `./update.sh /media/usb`  ·  **Windows:** `.\update.ps1 -Source E:\` (oder `update-dartshub.bat`)
- Das Skript übernimmt die neuen Dateien, macht `npm install` und baut. `pb_data/`, `node_modules/`
  und `app/.env.local` werden **nicht** angefasst.

**Nach jedem Update:**
1. **App-Terminal(s)/Dienst neu starten** (bzw. `systemctl --user restart dartshub-web`).
2. Hat sich das **Schema** geändert: **PocketBase neu starten** (Migrations laufen beim Start automatisch).
3. An den **Boards die Seite neu laden** (ggf. zweimal — PWA-Cache).

---

## 4. Wichtigste Befehle (Spickzettel)

| Zweck | Befehl |
|---|---|
| Lokal starten (manuell) | `cd app && npm run dev` |
| Lokal/Verein starten (Skript) | `./start-dartshub.sh` · `start-dartshub.bat` |
| Autostart einrichten | `./autostart-einrichten.sh` · `autostart-einrichten.bat` |
| PocketBase-Superuser setzen | `./pocketbase superuser upsert <mail> "<pw>" --dir ./pb_data` |
| PocketBase starten | `./pocketbase serve --http=0.0.0.0:8090 --dir ./pb_data --migrationsDir ./pb_migrations --hooksDir ./pb_hooks` |
| App bauen | `cd app && npm install && npm run build` |
| Update (USB) | `./update.sh /media/usb` · `.\update.ps1 -Source E:\` |
| Board-Konto anlegen | `BOARD_EMAIL=board1@deinverein.de BOARD_PW=<pw> PB_URL=http://<ip>:8090 PB_SU_EMAIL=… PB_SU_PASS=… node pocketbase/add-board-account.mjs` |
| App-Passwort zurücksetzen | `USER_EMAIL=… NEW_PW=<min-8> PB_URL=http://<ip>:8090 PB_SU_EMAIL=… PB_SU_PASS=… node pocketbase/reset-password.mjs` |

> **Linux-Dienste verwalten:** `systemctl --user status dartshub-web dartshub-pocketbase` ·
> Logs: `journalctl --user -u dartshub-pocketbase -f`

---

## 5. Notfälle

- **App-Passwort vergessen** → mit dem **Superuser** zurücksetzen: `…/_/` → Collection `users` → neues
  Passwort, *oder* per `reset-password.mjs` (siehe §4).
- **Superuser-Passwort selbst weg** → auf dem Server neu setzen:
  `./pocketbase superuser upsert <mail> "<neues-pw>" --dir ./pb_data`.
- **Sperr dich nicht aus:** Superuser-Passwort sicher im Passwortmanager ablegen; lege dir früh einen
  **zweiten App-Admin** an.
