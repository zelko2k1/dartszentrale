# DartsHub im Homelab mit Coolify — nur per IP (LAN)

Praxis-Anleitung für den Betrieb im eigenen Netz: **PocketBase + Frontend in Coolify**,
Zugriff über **interne IP** (kein DNS, keine Domain, kein HTTPS). Festgehalten nach dem
ersten Aufsetzen — inkl. der Stolpersteine, die dabei aufgetaucht sind.

> Begriffe vorweg, damit nichts durcheinandergeht:
> - **Superuser** = PocketBase-**Verwaltung** (`/_/`-Login). Verwaltet die DB.
> - **App-Admin** = Konto in der Collection `users` mit `role = admin`. Damit loggt man sich in der **App** ein.
> - **Volume `pb_data`** = die einzigen persistenten Daten (SQLite + Uploads + Backups).
> - **Image** = enthält Schema (`/pb/migrations`) + Hooks (`/pb/hooks`) — fest eingebacken, **nicht** im Volume.

---

## 0. Voraussetzungen

- Coolify läuft im Homelab.
- Du kennst die **interne IP** des Servers (hier `<IP>` genannt, z. B. `192.168.x.x`).
- Repo: `https://github.com/zelko2k1/dartshub.git` (SSH: `git@github.com:zelko2k1/dartshub.git`), Branch `main`.

---

## 1. PocketBase deployen (Docker Compose)

1. **Projects → dartshub → New Resource → Docker Compose**, Quelle = **dieses Git-Repo**.
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
   - `Application name` = `dartshub` (kosmetisch)
   - `Application URL` = `http://<IP>:8090`
3. **CORS gibt es im Dashboard nicht** (PocketBase 0.39). Default ist `*` (alles erlaubt) → im LAN ok,
   nichts zu tun. Einschränken ginge nur per `--origins`-Flag im Compose-`command`.
4. **Ersten App-Admin anlegen:** Collection **`users`** → New record:
   - `role = admin`, Mail + starkes Passwort
   - **`active` anhaken (= true)** ← unbedingt!
   *(Das ist NICHT der Superuser — damit loggst du dich später in der App ein.)*
   > ⚠️ Die `users`-Collection hat die Auth-Rule **`active = true`** — nur aktive Records dürfen sich
   > einloggen. Beim Anlegen im Dashboard ist `active` standardmäßig **nicht** gesetzt → Login scheitert
   > mit **HTTP 403** (nicht 400!). `active` anhaken + Save → Login geht. Das ist KEIN Passwort-Problem.

---

## 2. Frontend deployen (Dockerfile)

1. **Projects → dartshub → New Resource → Repository** (dasselbe Repo).
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

## 5. Merksätze

- **Superuser** = PB-Verwaltung · **App-Admin** = App-Login (`users`, `role=admin`). Zwei verschiedene Dinge.
- **`VITE_PB_URL`** ist **Build-Zeit** → ändern heißt **redeploy**, und in Coolify als **Build-Variable** markieren.
- **Erster-Superuser-Dialog** erscheint nur, wenn `pb_data` **leer** ist. Sonst nur Login.
- **Alles http im LAN** ist ok, solange App und PB beide http sind (kein Mixed Content).
- Unterschied zu „ohne Coolify" (systemd + Caddy): nur die **Verpackung**. PocketBase selbst tickt gleich.
  Siehe [`cloud-schlank-anleitung.md`](cloud-schlank-anleitung.md).
