# DartsZentrale with Arcane — homelab (via IP)

**🇬🇧 English | [🇩🇪 Deutsch](de/arcane-homelab-anleitung.md)**

Hands-on guide for **PocketBase + frontend as Compose stacks in [Arcane](https://arcane.ofkm.dev/)**.
The focus is running it on your own network via the **internal IP** (no DNS, no domain, no
HTTPS) — written down after the first setup, including the pitfalls.

> **Why Arcane instead of Coolify?** For a homelab, a lean Docker/Compose manager is enough.
> Arcane does exactly that (start stacks, logs, volumes) and isn't as bloated. The trade-off:
> Arcane ships **no** reverse proxy and **no** automatic HTTPS. For LAN-by-IP you don't
> need those anyway — the two services publish their ports directly.
>
> **Public operation with domain + HTTPS?** Two paths are described in [section 5](#5-public-with-domain--https).
> The leanest variant (systemd + Caddy, entirely without Docker) is [`admin-guide-cloud.md`](admin-guide-cloud.md).

> Terminology up front, so nothing gets mixed up:
> - **Superuser** = PocketBase **administration** (`/_/` login). Manages the DB.
> - **App admin** = account in the `users` collection with `role = admin`. This is what you sign in to the **app** with.
> - **Volume `pb_data`** = the only persistent data (SQLite + uploads + backups).
> - **Image** = contains schema (`/pb/migrations`) + hooks (`/pb/hooks`) — baked in, **not** in the volume.
> - **Stack / Compose project** = a `docker-compose.yaml` plus build context that Arcane starts as one unit.

---

## 0. Prerequisites

- **Arcane** is running in the homelab (managing the local Docker host).
- You know the **internal IP** of the server (called `<IP>` here, e.g. `192.168.x.x`).
- The **repo lives on the Docker host** — both stacks build from a local context (`build:`),
  so Arcane needs the files on that machine:
  ```bash
  git clone https://github.com/zelko2k1/dartszentrale.git
  ```
  Updating later: `git pull` in the same directory, then **Redeploy** in Arcane (with rebuild).

---

## 1. Deploy the PocketBase stack

The Compose file [`pocketbase/docker-compose.yaml`](../pocketbase/docker-compose.yaml) is ready to go:
it builds the custom image (schema + hooks baked in), creates the persistent volume `pb_data`,
publishes port **8090**, and has a healthcheck.

1. In Arcane, **Compose → New / Create Project** (or "Add Stack").
2. Source = the **`pocketbase/`** directory from the cloned repo (it contains `docker-compose.yaml`
   **and** the build context). Alternatively paste the file's contents into the editor — then the
   build context (`.`) must point to that directory.
3. **Deploy / Up.** On first start, the **migrations** baked into the image create the schema
   automatically (→ 10 collections). Hooks (`/pb/hooks`) enable club mode.

**Reachability:** PocketBase listens on **port 8090** → `http://<IP>:8090`.

### Set up PocketBase (in the dashboard)

1. Open `http://<IP>:8090/_/` (**with trailing slash!**) → **create the first superuser**
   (email + strong password). If you only see a **login** without a create dialog,
   the volume already contains data (old superuser) → see "Fresh start" below.
2. **Settings → Application:**
   - `Application name` = `dartszentrale` (cosmetic)
   - `Application URL` = `http://<IP>:8090`
3. **CORS no longer exists in the dashboard** (PocketBase since 0.23) — default `*`; nothing to do on a LAN.
   Restricting it is possible via the **`--origins` flag** in the Compose `command` (e.g. `--origins=http://<IP>:8081`).
   With token auth (JWT in localStorage, no cookies), CORS isn't a real protective wall anyway.
4. **Create the first app admin:** collection **`users`** → New record:
   - `role = admin`, email + strong password
   - **check `active` (= true)** ← essential!
   *(This is NOT the superuser — this is what you'll sign in to the app with later.)*
   > ⚠️ The `users` collection has the auth rule **`active = true`** — only active records may
   > sign in. When creating a record in the dashboard, `active` is **not** set by default → login fails
   > with **HTTP 403** (not 400!). Check `active` + Save → login works. This is NOT a password problem.

---

## 2. Deploy the frontend stack

The Compose file [`app/docker-compose.yaml`](../app/docker-compose.yaml) builds the SPA (nginx serves
the static bundle) and passes the PocketBase URL as a **build arg** right in the file:

```yaml
services:
  dartzentrale:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        # Wert kommt aus app/.env (nicht versioniert), NICHT hier hartkodieren.
        - VITE_PB_URL=${VITE_PB_URL:?bitte VITE_PB_URL in app/.env setzen (Vorlage: app/.env.example)}
    ports:
      - "8081:80"
    restart: unless-stopped
```

1. **Set `VITE_PB_URL` in a separate `app/.env`** (not in the Compose file):
   `cp app/.env.example app/.env`, then enter `VITE_PB_URL=http://<IP>:8090` in it. The `.env` is
   **gitignored** → your IP never lands in the repo and survives `git pull`. Compose reads it
   automatically from the `app/` folder at build time; Vite bakes the value into the bundle **at build time** (`ARG VITE_PB_URL`
   in the Dockerfile). If the variable is missing, the build deliberately aborts instead of baking in a wrong URL.
   *(Alternatively to `.env`: set `VITE_PB_URL` as a stack environment variable in Arcane.)*
2. Create a second **Compose stack** in Arcane from the **`app/`** directory.
3. **Deploy / Up.**

> ⚠️ **Build time, not runtime.** If the IP or the port changes, a restart is not enough —
> the frontend stack needs a **rebuild** (in Arcane: "Redeploy" with pull/rebuild).
>
> ⚠️ **Port conflict?** `Bind for :::8081 failed: port is already allocated` → change the left-hand host port
> (e.g. `8088:80`, `3000:80`). Check what's using it: `docker ps --filter "publish=8081"`.

**Reachability:** `http://<IP>:8081`

---

## 3. Testing

1. Open `http://<IP>:8081` → club-mode login screen.
2. Sign in with the **app admin** (from step 1.4).
3. If the page loads but login/data fail → **F12 → "Network" tab**, repeat the login,
   inspect the **`auth-with-password`** request (target URL + status code):
   - Goes to `localhost:8090` or a wrong IP → `VITE_PB_URL` was wrong/empty at build time → fix it in
     `app/.env` + **rebuild**.
   - Goes to `http://<IP>:8090`, **status 400** (`Failed to authenticate`) → wrong email/wrong password
     → record in `users` → set it again via "Change password".
   - Goes to `http://<IP>:8090`, **status 403** → auth rule `active = true` not satisfied
     → record in `users` → **check `active`** + Save (see step 1.4). The most common pitfall!

> Both run over **http** (app `:8081`, PB `:8090`) → no "mixed content" problem.

---

## 4. Cheat sheet / diagnostics

**Who is answering me right now?** Unlike with Coolify, there is **no reverse proxy in between** —
the containers publish their ports directly. A "404 page not found" here therefore does **not**
come from a proxy, but from a wrong path/port or a stopped container.

```bash
# Is PocketBase alive? (direct) → expected: {"code":200,...}
curl -s http://localhost:8090/api/health

# Does the admin dashboard respond? (with slash!) → expected: 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8090/_/

# Does the frontend respond? → expected: 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8081/

# Who is holding a port?
docker ps --filter "publish=8090" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"

# Logs of a container (or directly in the Arcane UI)
docker logs --tail 50 <container-name>
```

- **Deleting a container ≠ deleting data** — data lives in the **volume `pb_data`** and survives redeploys
  and re-deploying the stack. Manage stacks/containers preferably **via the Arcane UI**, so
  Arcane keeps its state consistent (instead of manual `docker rm`).
- **The volume only contains `pb_data`** — that's correct. Migrations/hooks live in the **image** under `/pb/...`.
- Arcane shows **logs, health, and ports** per stack right in the UI — usually faster than the `docker` commands above.

### Superuser password forgotten / set it

```bash
docker exec -it <pocketbase-container> /usr/local/bin/pocketbase \
  superuser upsert "admin@dein.local" "NewStrongPassword" --dir=/pb_data
```
`upsert` = create **or** set the password. Affects only that one email; other admins stay untouched.

### Complete fresh start (all data + all admins gone!)

In Arcane, remove the PocketBase stack **and delete the volume `pb_data` with it** (or remove the volume in
the Volumes view), then redeploy. ⚠️ Irreversible: deletes **all** superusers,
**all** app `users`, and all data.

---

## 5. Public with domain + HTTPS

Arcane ships **no** automatic HTTPS. For public operation (domain, TLS) there are
therefore two paths — depending on whether you want to stay in the Docker/Arcane world or run maximally lean:

### Path A (recommended, leanest) — systemd + Caddy, no Docker

Two native systemd services + **Caddy** as the HTTPS reverse proxy (auto Let's Encrypt). Saves ~1 GB
of constant load and the whole Docker layer, guided by `setup-cloud.sh`. Fully described in
[`admin-guide-cloud.md`](admin-guide-cloud.md).

### Path B — stay with Arcane: Caddy as an additional container

If you want **one tool everywhere** (Arcane in the homelab **and** in the cloud), you add a
**Caddy container** to the stack that handles HTTPS. The idea:

- **DNS:** two A records pointing to the server IP — `app.<domain>` (frontend) and `db.<domain>` (PocketBase).
- **One shared Compose stack** with three services on an internal Docker network:
  `caddy` (ports 80/443 public) → reverse_proxy to `frontend:80` and `pocketbase:8090`.
  Frontend and PocketBase then publish **no** host ports of their own anymore (Caddy fronts them).
- **`VITE_PB_URL` = `https://db.<domain>`** (build time!) instead of the LAN IP.
- Caddy fetches/renews the Let's Encrypt certificates automatically; prerequisite: ports **80 + 443**
  reachable from the internet, DNS pointing to the server IP.
- Use [`Caddyfile.example`](../Caddyfile.example) as the template for the Caddy config — except that the
  `reverse_proxy` targets in the container stack point to the **service names** (`frontend:80`, `pocketbase:8090`)
  instead of `127.0.0.1:4173/:8090`. The security-header/CSP notes there apply unchanged.
- **Legal (mandatory):** Publicly you need an **imprint** (§ 5 DDG) and a
  **privacy policy** (Art. 13 GDPR). You enter both **in the app** (as admin:
  Settings → **Legal**); they appear on the login page and are reachable without
  signing in. So that the texts are visible to visitors who are not signed in, the migration
  `pb_migrations/1782300001_club_config_public_legal.js` makes the `club_config` collection publicly
  readable — it takes effect **automatically on the next rebuild** (the image is rebuilt, PocketBase
  applies new migrations on start). **No `provision.mjs` on the server** — that's the path of
  the lean systemd variant, not the Docker/Arcane path.

> For a single small club server, **path A** is usually the better choice (fewer moving
> parts, no rebuild for certificates). Path B is worth it if you deliberately want everything in Docker/Arcane.

---

## 6. Accounts & security

The real access control is the **PocketBase API rules** (server-side) — the board/kiosk mode is UI only.

- Create a **board-machine account** (minimal rights) instead of handing real admin logins to the boards:
  ```bash
  PB_URL=http://<IP>:8090 PB_SU_EMAIL=… PB_SU_PASS=… BOARD_EMAIL=board@dein.local BOARD_PW=<strong-pw> \
    node pocketbase/add-board-account.mjs
  ```
  Role `board`: may only **create + read matches**, manage nothing. Correcting a result is allowed only for **admin or creator** (owner binding).
- **App password forgotten?** The superuser is the lifeline:
  ```bash
  USER_EMAIL=… NEW_PW=<min-8> PB_URL=http://<IP>:8090 PB_SU_EMAIL=… PB_SU_PASS=… \
    node pocketbase/reset-password.mjs
  ```
- **For public operation** (domain/internet): HTTPS is mandatory, do **not** expose PocketBase port
  **8090** to the internet, shield the admin console **`/_/`** (IP/VPN). Full
  pre-go-live list: [`security-audit.md`](security-audit.md).
- Self-registration stays off (`users` create = `admin`); nothing is readable unauthenticated.

---

## 7. Things to remember

- **Superuser** = PB administration · **app admin** = app login (`users`, `role=admin`). Two different things.
- **`VITE_PB_URL`** is **build time** → changing it means a **rebuild**; the value lives in `app/.env` (gitignored, template `app/.env.example`), not in the versioned Compose file.
- The **first-superuser dialog** only appears if `pb_data` is **empty**. Otherwise just a login.
- **All-http on the LAN** is fine, as long as app and PB are both http (no mixed content).
- **Arcane has no proxy/HTTPS** — irrelevant on the LAN (direct ports), in the cloud you need Caddy (path A or B).
- Difference from the lean variant (systemd + Caddy): only the **packaging**. PocketBase itself ticks the same.
  See [`admin-guide-cloud.md`](admin-guide-cloud.md).
