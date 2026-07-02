# DartsZentrale mit Coolify — Homelab (per IP) & öffentlicher Server (Domain)

Praxis-Anleitung für **PocketBase + Frontend in Coolify**. Schwerpunkt ist der Betrieb im eigenen
Netz über die **interne IP** (kein DNS, keine Domain, kein HTTPS) — festgehalten nach dem ersten
Aufsetzen inkl. der Stolpersteine. Der Betrieb mit **Domain + HTTPS** auf einem öffentlichen Server
läuft fast identisch; die wenigen Unterschiede stehen in [Abschnitt 5](#5-mit-domain--https-öffentlicher-server).

> Coolify/Docker ganz vermeiden? Die schlanke Cloud-Variante (systemd + Caddy) steht in
> [`admin-anleitung-cloud.md`](admin-anleitung-cloud.md).

> Begriffe vorweg, damit nichts durcheinandergeht:
> - **Superuser** = PocketBase-**Verwaltung** (`/_/`-Login). Verwaltet die DB.
> - **App-Admin** = Konto in der Collection `users` mit `role = admin`. Damit loggt man sich in der **App** ein.
> - **Volume `pb_data`** = die einzigen persistenten Daten (SQLite + Uploads + Backups).
> - **Image** = enthält Schema (`/pb/migrations`) + Hooks (`/pb/hooks`) — fest eingebacken, **nicht** im Volume.

---

## 0. Voraussetzungen

- Coolify läuft im Homelab.
- Du kennst die **interne IP** des Servers (hier `<IP>` genannt, z. B. `192.168.x.x`).
- Repo: `https://github.com/zelko2k1/dartszentrale.git` (SSH: `git@github.com:zelko2k1/dartszentrale.git`), Branch `main`.

---

## 1. PocketBase deployen (Docker Compose)

1. **Projects → dartszentrale → New Resource → Docker Compose**, Quelle = **dieses Git-Repo**.
2. **Base Directory:** `/pocketbase`
   **Compose-Pfad:** `pocketbase/docker-compose.yaml`
3. **Persistent Storage** prüfen: Volume **`pb_data`** muss persistent sein (sonst Daten weg bei Redeploy).
4. **Deploy.** Beim ersten Start legen die ins Image gebackenen **Migrations** das Schema automatisch an
   (→ 10 Collections). Hooks (`/pb/hooks`) aktivieren den Vereinsmodus.

**Erreichbarkeit:** PocketBase lauscht auf **Port 8090** → `http://<IP>:8090`.

### PocketBase einrichten (im Dashboard)

1. `http://<IP>:8090/_/` öffnen (**mit Slash am Ende!**) → **ersten Superuser anlegen**
   (Mail + starkes Passwort). Erscheint stattdessen nur ein **Login** ohne Anlege-Dialog,
   liegen im Volume schon Daten (alter Superuser) → siehe „Neuanfang" unten.
2. **Settings → Application:**
   - `Application name` = `dartszentrale` (kosmetisch)
   - `Application URL` = `http://<IP>:8090`
3. **CORS gibt es nicht mehr im Dashboard** (PocketBase seit 0.23) — Default `*`, im LAN nichts zu tun.
   Einschränken ginge per **`--origins`-Flag** im Compose-`command` (z. B. `--origins=http://<IP>:8081`).
   Bei Token-Auth (JWT im localStorage, keine Cookies) ist CORS ohnehin kein echter Schutzwall.
4. **Ersten App-Admin anlegen:** Collection **`users`** → New record:
   - `role = admin`, Mail + starkes Passwort
   - **`active` anhaken (= true)** ← unbedingt!
   *(Das ist NICHT der Superuser — damit loggst du dich später in der App ein.)*
   > ⚠️ Die `users`-Collection hat die Auth-Rule **`active = true`** — nur aktive Records dürfen sich
   > einloggen. Beim Anlegen im Dashboard ist `active` standardmäßig **nicht** gesetzt → Login scheitert
   > mit **HTTP 403** (nicht 400!). `active` anhaken + Save → Login geht. Das ist KEIN Passwort-Problem.

---

## 2. Frontend deployen (Dockerfile)

1. **Projects → dartszentrale → New Resource → Repository** (dasselbe Repo).
2. **Build Pack = Dockerfile** (NICHT Nixpacks — pinnt zu altes Node, Build bricht ab).
3. **Pfade** (zwei getrennte Felder!):
   | Feld | Wert |
   |---|---|
   | **Base Directory** | `/app` |
   | **Dockerfile Location** | `/app/Dockerfile` |
   > ⚠️ Dockerfile Location ist **relativ zum Repo-Root**, nicht zum Base Directory.
   > Steht da nur `/Dockerfile`, sucht Coolify im Root → `open Dockerfile: no such file or directory`.
4. **Environment Variable — als BUILD-Variable:**
   ```
   VITE_PB_URL = http://<IP>:8090
   ```
   ☑️ Häkchen **„Build Variable / Available at buildtime"** setzen!
   > ⚠️ Diese URL wird **zur Build-Zeit** ins Bundle gebacken (`ARG VITE_PB_URL` im Dockerfile).
   > Ohne das Häkchen kommt sie im Build nicht an → App zeigt auf `localhost` und findet PocketBase nicht.
   > Nachträgliche Änderung = **Redeploy** nötig.
5. **Domain:** leer lassen.
6. **Ports Mapping:** `8081:80` (links Host-Port frei wählbar, rechts Container-Port 80 = nginx, fest).
   > ⚠️ Port-Konflikt? `Bind for :::<port> failed: port is already allocated` → anderen Host-Port nehmen
   > (z. B. `8081`, `8088`, `3000`). Belegung prüfen: `docker ps --filter "publish=<port>"`.
7. **Deploy.**

**Erreichbarkeit:** `http://<IP>:8081`

---

## 3. Testen

1. `http://<IP>:8081` öffnen → Login-Maske Vereinsmodus.
2. Mit dem **App-Admin** (aus Schritt 1.4) anmelden.
3. Klappt das Laden, aber Login/Daten gehen nicht → **F12 → Tab „Network"**, Login wiederholen,
   den Request **`auth-with-password`** ansehen (Ziel-URL + Status-Code):
   - Geht an `localhost:8090` → `VITE_PB_URL` war keine **Build-Variable** → korrigieren + redeploy.
   - Geht an `http://<IP>:8090`, **Status 400** (`Failed to authenticate`) → falsche Mail/falsches Passwort
     → Record in `users` → „Change password" neu setzen.
   - Geht an `http://<IP>:8090`, **Status 403** → Auth-Rule `active = true` nicht erfüllt
     → Record in `users` → **`active` anhaken** + Save (siehe Schritt 1.4). Häufigster Stolperstein!

> Beides läuft über **http** (App `:8081`, PB `:8090`) → kein „Mixed Content"-Problem.

---

## 4. Spickzettel / Diagnose

**Wer antwortet mir gerade?** Die meiste Verwirrung löst sich, wenn man die Schicht eingrenzt:

```bash
# Lebt PocketBase? (direkt, am Proxy vorbei) → erwartet: {"code":200,...}
curl -s http://localhost:8090/api/health

# Antwortet das Admin-Dashboard? (mit Slash!) → erwartet: 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8090/_/

# Wer hält einen Port?
docker ps --filter "publish=8090" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"

# Logs eines Containers
docker logs --tail 50 <container-name>
```

- **„404 page not found"** (Klartext) kommt vom **Reverse-Proxy** (Traefik), nicht von PocketBase.
  PocketBase würde JSON zurückgeben. Ursache meist: Proxy hat keine Route (alter/abgeschalteter Container).
- **Container löschen ≠ Daten löschen** — Daten leben im **Volume `pb_data`**, überleben Redeploys.
  Container immer **über die Coolify-UI** löschen (Danger Zone), nicht mit `docker rm` (sonst Phantom-Zustand).
- **Im Volume liegt nur `pb_data`** — das ist korrekt. Migrations/Hooks liegen im **Image** unter `/pb/...`.

### Superuser-Passwort vergessen / setzen

```bash
docker exec -it <pocketbase-container> /usr/local/bin/pocketbase \
  superuser upsert "admin@dein.local" "NeuesStarkesPasswort" --dir=/pb_data
```
`upsert` = anlegen **oder** Passwort setzen. Trifft nur diese eine Mail, andere Admins bleiben unberührt.

### Kompletter Neuanfang (alle Daten + alle Admins weg!)

Über die **Coolify-UI**: Resource löschen und beim Dialog **Volume mitlöschen** wählen — oder das
Volume `pb_data` entfernen und neu deployen. ⚠️ Unwiderruflich: löscht **alle** Superuser, **alle**
App-`users` und sämtliche Daten.

---

## 5. Mit Domain + HTTPS (öffentlicher Server)

Derselbe Coolify-Weg funktioniert auch mit **Domain und automatischem HTTPS** (z. B. ein Hetzner-Server
statt Homelab). Nur wenige Unterschiede zum IP-Betrieb oben:

- **DNS:** zwei A-Records auf die Server-IP — `app.<domain>` (Frontend) und `db.<domain>` (PocketBase).
- **PocketBase-Resource:** **Domain** = `db.<domain>`, Port `8090`; Coolify stellt **HTTPS automatisch** aus.
  Dann **Settings → Application URL** = `https://db.<domain>`. CORS bei Bedarf per
  **`--origins=https://app.<domain>`** im Compose-`command` (nicht mehr im UI). Öffentlich: **`/_/`**
  am Proxy abschirmen → [`security-audit.md`](security-audit.md) #5.
- **Frontend-Resource:** **Domain** = `app.<domain>`, Build-Variable **`VITE_PB_URL = https://db.<domain>`** (statt der IP).
- Alles läuft über **https** (kein „Mixed Content") und ist als PWA installierbar.
- **Rechtliches (Pflicht):** Öffentlich brauchst du ein **Impressum** (§ 5 DDG) und eine
  **Datenschutzerklärung** (Art. 13 DSGVO). Beides trägst du **in der App** ein (als Admin:
  Einstellungen → **Rechtliches**); es erscheint dann auf der Anmeldeseite und ist ohne Anmeldung
  erreichbar. Damit die Texte auch für nicht angemeldete Besucher sichtbar sind, macht die Migration
  `pb_migrations/1782300001_club_config_public_legal.js` die `club_config`-Collection öffentlich
  lesbar — sie greift **automatisch beim nächsten Redeploy** (das Image wird neu gebaut, PocketBase
  wendet neue Migrationen beim Start an). **Kein `provision.mjs` auf dem Server** — das ist der Weg
  der schlanken systemd-Variante, nicht der Docker/Coolify-Weg.

> Willst du Coolify/Docker ganz vermeiden, gibt es die schlanke Variante (systemd + Caddy):
> [`admin-anleitung-cloud.md`](admin-anleitung-cloud.md).

---

## 6. Konten & Sicherheit

Die echte Zugriffskontrolle sind die **PocketBase-API-Rules** (serverseitig) — der Board-/Kiosk-Modus ist nur Oberfläche.

- **Board-Rechner-Konto** (rechtearm) anlegen, statt echte Admin-Logins an die Bretter zu geben:
  ```bash
  PB_URL=http://<IP>:8090 PB_SU_EMAIL=… PB_SU_PASS=… BOARD_EMAIL=board@dein.local BOARD_PW=<starkes-pw> \
    node pocketbase/add-board-account.mjs
  ```
  Rolle `board`: darf nur **Matches anlegen + lesen**, nichts verwalten. Ein Ergebnis korrigieren darf nur **Admin oder Ersteller** (Owner-Bindung).
- **App-Passwort vergessen?** Der Superuser ist der Rettungsanker:
  ```bash
  USER_EMAIL=… NEW_PW=<min-8> PB_URL=http://<IP>:8090 PB_SU_EMAIL=… PB_SU_PASS=… \
    node pocketbase/reset-password.mjs
  ```
- **Bei öffentlichem Betrieb** (Domain/Internet): HTTPS ist Pflicht, den PocketBase-Port **8090 nicht**
  offen ins Internet stellen, die Admin-Konsole **`/_/`** abschirmen (IP/VPN). Vollständige
  Pre-Go-live-Liste: [`security-audit.md`](security-audit.md).
- Self-Registration bleibt aus (`users` create = `admin`); unauthentifiziert ist nichts lesbar.

---

## 7. Merksätze

- **Superuser** = PB-Verwaltung · **App-Admin** = App-Login (`users`, `role=admin`). Zwei verschiedene Dinge.
- **`VITE_PB_URL`** ist **Build-Zeit** → ändern heißt **redeploy**, und in Coolify als **Build-Variable** markieren.
- **Erster-Superuser-Dialog** erscheint nur, wenn `pb_data` **leer** ist. Sonst nur Login.
- **Alles http im LAN** ist ok, solange App und PB beide http sind (kein Mixed Content).
- Unterschied zu „ohne Coolify" (systemd + Caddy): nur die **Verpackung**. PocketBase selbst tickt gleich.
  Siehe [`admin-anleitung-cloud.md`](admin-anleitung-cloud.md).
