# Coolify-Setup: PocketBase + Frontend (Vereinsmodus)

Schritt-für-Schritt für einen Hetzner-Server mit Docker + Coolify.
Platzhalter `<domain>` durch deine Domain ersetzen (z. B. `dartshub.de`).

## 0. Voraussetzungen
- Hetzner-Server mit installiertem **Coolify** (läuft auf Docker).
- Eine Domain, deren DNS du verwalten kannst.

## 1. DNS
Zwei A-Records auf die Server-IP zeigen lassen:
- `app.<domain>`  → Frontend
- `db.<domain>`   → PocketBase

## 2. PocketBase deployen
1. In Coolify: **Project → New Resource → Docker Compose** und als Quelle **dieses Git-Repository**
   wählen. Wichtig: nicht den YAML-Inhalt von Hand einfügen, sondern aus Git ziehen — nur so sind
   die Bind-Mounts `./pb_migrations` und `./pb_hooks` (relativ zur Compose-Datei) verfügbar.
2. **Compose-Pfad** auf `pocketbase/docker-compose.yml` setzen (Base Directory `pocketbase/`).
3. **Domain** für den Service auf `db.<domain>` setzen, **Port 8090**.
4. Sicherstellen, dass das **Volume `pb_data` persistent** ist (Coolify: Persistent Storage).
   Die Verzeichnisse `pb_migrations`/`pb_hooks` sind read-only aus Git und brauchen kein Volume.
5. **Deploy**. PocketBase legt das Schema beim ersten Start automatisch an (Migrations).
   HTTPS wird von Coolify automatisch ausgestellt.

## 3. PocketBase einrichten
1. `https://db.<domain>/_/` öffnen → **ersten Superuser (Admin) anlegen**.
   - Hinweis: Das ist der PocketBase-Admin (Verwaltung). Die App-Logins sind separat (Collection `users`).
2. **Settings → Application** → `Application URL` = `https://db.<domain>`.
3. **Settings → CORS / Allowed origins** → `https://app.<domain>` eintragen.
4. **Settings → Backups** → automatische Backups aktivieren (optional Ziel: Hetzner Storage Box / S3).
5. **Collections + API-Rules** entstehen **automatisch**: PocketBase wendet beim Start die
   versionierten Migrations aus `pocketbase/pb_migrations/` an (per `docker-compose.yml` ins
   Container-Verzeichnis `/pb_migrations` gemountet). Kein manuelles Anlegen nötig.
   - `pocketbase/SCHEMA.md` bleibt als **lesbare Referenz** (welche Felder/Rules existieren) —
     maßgeblich für die Laufzeit sind aber die Migrations.
   - Der Vereinsmodus (Passwort-Endpunkt, Board-Rollen-Guard) wird über die ebenfalls gemounteten
     **Hooks** aus `pocketbase/pb_hooks/` aktiv.
   - Self-Registration ist via Migration aus (`users` create-Rule = `@request.auth.role = "admin"`).
   - Nach Schema-Änderungen lokal die neuen Migrations committen → beim nächsten Coolify-Redeploy
     werden sie automatisch angewandt.
6. **Ersten App-Admin** anlegen: Collection `users` → Record hinzufügen, `role = admin`, E-Mail + Passwort.
   Damit meldest du dich später in der App an. (Alternativ per Skript: `seed.mjs` legt einen Test-Admin
   + Beispieldaten an, `seed-dsv-fuerth.mjs` einen kompletten Vereins-Testdatensatz.)

## 4. Frontend deployen
1. In Coolify: **New Resource → aus Git-Repository** (dieses Repo, Pfad `app/`).
2. Build: Vite (Coolify erkennt es via Nixpacks) → Output `dist/` (statisch).
3. **Environment Variable** setzen: `VITE_PB_URL = https://db.<domain>`.
4. **Domain** = `app.<domain>`, **Deploy**. HTTPS automatisch.

## 5. Nutzung
- `https://app.<domain>` öffnen → im **Vereinsmodus** anmelden (App-`users`-Konto).
- In Edge „Als App installieren" (PWA, HTTPS vorhanden ✔).
- Weitere Mitglieder: Konten legt der Admin in der App (bzw. PB-Admin-UI) an.
- **Tägliche Bedienung** (Spieler/Mannschaften/Ligen/Counter/Board): siehe [`../docs/handbuch.md`](../docs/handbuch.md).

## 6. Sicherheit / Härtung
Die echte Zugriffskontrolle sind die **PocketBase-API-Rules** (serverseitig) — der Kiosk-/Board-Modus ist nur Oberfläche.
- **Board-Rechner-Konto** (dediziert, rechtearm) anlegen statt echte Spieler-/Admin-Logins an die Bretter zu geben:
  `PB_URL=https://db.<domain> PB_SU_EMAIL=… PB_SU_PASS=… BOARD_EMAIL=board@<domain> BOARD_PW=<starkes-pw> node pocketbase/add-board-account.mjs`
  → Rolle `player`: darf nur **Matches anlegen + lesen**, nichts verwalten, Matches nicht ändern/löschen (nur admin).
- **HTTPS** ist Pflicht (Coolify stellt es automatisch) — sonst wandern Login-Tokens im Klartext.
- **Superuser-/Admin-Passwort** stark wählen und **nie auf den Board-PCs** speichern. Board-PW regelmäßig rotieren (Skript erneut ausführen).
- Self-Registration bleibt aus (`users` create = admin). Unauthentifiziert ist nichts lesbar (alle list/view-Rules verlangen Login).
- Kiosk-Ausstieg am Board verlangt Admin/Kapitän-Login → ein Board-Konto (player) kann den Board-Modus nicht selbst verlassen.

## Betrieb / Gut zu wissen
- **Daten liegen im Volume `pb_data`** — Backups regelmäßig prüfen, gelegentlich Restore testen.
- **Passwort eines App-Kontos vergessen?** Der Superuser ist der Rettungsanker:
  `USER_EMAIL=… NEW_PW=<min-8> PB_URL=https://db.<domain> PB_SU_EMAIL=… PB_SU_PASS=… node pocketbase/reset-password.mjs`
  (setzt Passwort + reaktiviert das Konto). Superuser-PW selbst weg → `./pocketbase superuser upsert <email> "<pw>" --dir ./pb_data`.
- PocketBase-Version in der `docker-compose.yml` pinnen und Updates kontrolliert einspielen.
- Der **lokale Modus** der App ist davon unabhängig und braucht nichts davon.
