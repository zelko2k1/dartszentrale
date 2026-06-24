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
1. In Coolify: **Project → New Resource → Docker Compose**.
2. Inhalt aus `pocketbase/docker-compose.yml` (dieses Repo) einfügen.
3. **Domain** für den Service auf `db.<domain>` setzen, **Port 8090**.
4. Sicherstellen, dass das **Volume `pb_data` persistent** ist (Coolify: Persistent Storage).
5. **Deploy**. HTTPS wird von Coolify automatisch ausgestellt.

## 3. PocketBase einrichten
1. `https://db.<domain>/_/` öffnen → **ersten Superuser (Admin) anlegen**.
   - Hinweis: Das ist der PocketBase-Admin (Verwaltung). Die App-Logins sind separat (Collection `users`).
2. **Settings → Application** → `Application URL` = `https://db.<domain>`.
3. **Settings → CORS / Allowed origins** → `https://app.<domain>` eintragen.
4. **Settings → Backups** → automatische Backups aktivieren (optional Ziel: Hetzner Storage Box / S3).
5. **Collections + API-Rules anlegen** — Schritt-für-Schritt-Spezifikation in
   **`pocketbase/SCHEMA.md`** (maßgeblich; die App spricht genau diese Feldnamen an).
   - Self-Registration deaktiviert: `users`-Collection → API-Rule *create* = `@request.auth.role = "admin"`.
6. **Ersten App-Admin** anlegen: Collection `users` → Record hinzufügen, `role = admin`, E-Mail + Passwort. Damit meldest du dich später in der App an.

## 4. Frontend deployen
1. In Coolify: **New Resource → aus Git-Repository** (dieses Repo, Pfad `app/`).
2. Build: Vite (Coolify erkennt es via Nixpacks) → Output `dist/` (statisch).
3. **Environment Variable** setzen: `VITE_PB_URL = https://db.<domain>`.
4. **Domain** = `app.<domain>`, **Deploy**. HTTPS automatisch.

## 5. Nutzung
- `https://app.<domain>` öffnen → im **Vereinsmodus** anmelden (App-`users`-Konto).
- In Edge „Als App installieren" (PWA, HTTPS vorhanden ✔).
- Weitere Mitglieder: Konten legt der Admin in der App (bzw. PB-Admin-UI) an.

## Betrieb / Gut zu wissen
- **Daten liegen im Volume `pb_data`** — Backups regelmäßig prüfen, gelegentlich Restore testen.
- PocketBase-Version in der `docker-compose.yml` pinnen und Updates kontrolliert einspielen.
- Der **lokale Modus** der App ist davon unabhängig und braucht nichts davon.
