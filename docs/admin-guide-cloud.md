# DartsZentrale, lightweight in the cloud — systemd + Caddy, no Docker

**🇬🇧 English | [🇩🇪 Deutsch](de/admin-anleitung-cloud.md)**

The **lightest** way to run club mode online: two native systemd services
plus **Caddy** as the HTTPS proxy. No Docker, no container management (saves ~1 GB of constant load).
Runs on a **1–2 GB nano VPS** from ~€3–4/month.

> **Guided by script:** `setup-cloud.sh` interactively asks for everything it needs (domains, superuser,
> first app admin) and sets up the server completely. The app's **local mode** needs
> none of this.

## What it looks like

```
                Internet (HTTPS, port 443)
                         │
                    ┌────▼─────┐   Caddy (auto-HTTPS via Let's Encrypt)
                    │  Caddy   │   80/443 public
                    └──┬────┬──┘
        app.<domain>   │    │   db.<domain>
                       │    │
        127.0.0.1:4173 │    │ 127.0.0.1:8090   ← both LOCAL only, not public
              ┌────────▼┐  ┌▼──────────────┐
              │ web svc │  │ pocketbase svc│
              │ node    │  │ (Go binary +  │
              │ serve-  │  │  SQLite       │
              │ dist.mjs│  │  pb_data/)    │
              └─────────┘  └───────────────┘
```

- **darts-pocketbase.service** — the PocketBase binary, listens only on `127.0.0.1:8090`.
- **darts-web.service** — `node serve-dist.mjs` (dependency-free), listens only on `127.0.0.1:4173`.
- **Caddy** — the only public-facing service; terminates TLS and routes to the two local ports.

Both internal ports are **not** reachable from the internet — no plaintext HTTP can bypass the
TLS proxy, without any extra firewall rule, because they never bind to external interfaces in the first place.

---

## Prerequisites

| What | For | Cost |
|-----|-------|--------|
| **VPS** (Hetzner CAX11 ARM or a 1–2 GB nano), **Ubuntu 24.04** | app + DB + Caddy | ~€3–5/month |
| **Domain** + DNS access | `app.*` and `db.*` + HTTPS | ~€12/year |
| **Node.js, Caddy, PocketBase** | the setup script fetches/installs them | €0 |

DNS up front: point two **A records** at the server IP —
`app.yourdomain.com` and `db.yourdomain.com` (details below).

> **How big does the server need to be?** The app runtime (PocketBase + `serve-dist.mjs`) only needs
> ~50–100 MB — the only bottleneck is the **build peak** (`npm install` + Vite build, briefly 1–2 GB).
> A **1–2 GB server + 2 GB swap** is therefore plenty; **ARM** (Hetzner's CAX line) is fully
> compatible and cheaper. **Disk:** 20 GB is enough. Optional external backups (Storage Box/S3, ~€3–4/month).

---

## DNS — creating the A records (where exactly?)

> ⚠️ You do **not** enter A records in the cloud server panel, but wherever the
> **DNS zone of your domain** is managed. At Hetzner these are two different products.

| Place | When | What to do |
|---|---|---|
| **Hetzner DNS Console** (`dns.hetzner.com`) | domain uses Hetzner's nameservers | select zone → "Add record" |
| **Domain registrar** (Namecheap, INWX, IONOS, Strato …) | domain is not hosted at Hetzner | in the provider's DNS menu |
| **Hetzner Cloud Console** (`console.hetzner.cloud`) | ❌ **NOT here** | only grab the **server IP** (Server → Public IP) |

**Where is my DNS zone?** If in doubt:
```bash
nslookup -type=ns yourdomain.com
```
- Answer `*.ns.hetzner.com` (hydrogen/oxygen/helium…) → **Hetzner DNS Console**
- anything else → wherever those nameservers belong (usually the registrar)

**The two entries** (both pointing to the **same** server IP). As `Name`, enter only `app`/`db`
— the system appends the domain automatically:

| Type | Name | Value |
|------|------|-------|
| A | `app` | 203.0.113.10 |
| A | `db` | 203.0.113.10 |

> **`app` is freely choosable.** You can name the subdomain anything you like, e.g. `dartszentrale`
> (→ `dartszentrale.yourdomain.com`). Only rule: **the same name in both places** —
> in the A record (`Name = dartszentrale`) **and** in the invocation (`APP_DOMAIN=dartszentrale.yourdomain.com`).
> The script automatically bakes a matching `VITE_PB_URL=https://<DB_DOMAIN>` into the frontend; in
> PocketBase then set the CORS origin to `https://<APP_DOMAIN>`. `db` can be renamed just the same
> (e.g. `pb`/`backend`) — as long as `DB_DOMAIN` is updated along with it.

**Verify afterwards** (DNS takes a few minutes, rarely hours):
```bash
nslookup app.yourdomain.com
nslookup db.yourdomain.com
```
Both must return the server IP. **Only then** run `setup-cloud.sh` or start Caddy
— otherwise HTTPS certificate issuance fails, because Let's Encrypt cannot resolve the
domain to the IP.

---

## Path A — automatic (one script)

Get the files onto the server (unpack the ZIP **or** `git clone …`), change into the folder, then:

```bash
sudo ./setup-cloud.sh
```

The script **interactively asks for everything it needs** (domains, optional Let's Encrypt email, superuser,
first app admin). Values can also be set up front as env vars:
`sudo APP_DOMAIN=app.yourdomain.com DB_DOMAIN=db.yourdomain.com ./setup-cloud.sh`.

The script ([`setup-cloud.sh`](../scripts/setup-cloud.sh)) is idempotent and takes care of:

1. Installing **Node.js + Caddy** (if not present), downloading the **PocketBase binary** matching the
   CPU (amd64/arm64).
2. **Building the frontend** — writes `app/.env.local` with `VITE_PB_URL=https://db.yourdomain.com`
   (baked into the bundle at **build time**) and runs `npm run build`.
3. Writing + enabling **two systemd system services** (run as your user, auto-restart,
   logs to journald).
4. Writing the **Caddyfile** (`app.* → :4173`, `db.* → :8090`) and reloading Caddy.
5. Creating the **superuser + schema + first app admin** (provision.mjs against the running PocketBase).

After that, only these steps remain:

- **Firewall:** ports 80 + 443 open (for Caddy/HTTPS); do **not** open 8090/4173.
- Set the **Application URL** in PocketBase: `https://db.yourdomain.com/_/` → Settings →
  *Application URL* = `https://db.yourdomain.com`. (CORS is already set via `--origins`.)

Done: open `https://app.yourdomain.com` → **club mode** → sign in with the app admin.

---

## Path B — by hand (what the script does)

For everyone who wants to set every step themselves.

### 1. Packages + binaries
```bash
# Node.js 24 (LTS)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs unzip

# Caddy (official apt repo)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# PocketBase (on ARM: linux_arm64)
cd ~/dartszentrale/pocketbase
wget https://github.com/pocketbase/pocketbase/releases/download/v0.39.5/pocketbase_0.39.5_linux_amd64.zip
unzip -o pocketbase_0.39.5_linux_amd64.zip pocketbase && chmod +x pocketbase
```

### 2. Build the frontend
```bash
cd ~/dartszentrale/app
echo 'VITE_PB_URL=https://db.yourdomain.com' > .env.local   # IMPORTANT: build time!
npm ci && npm run build
```

### 3. Create the two systemd services
`/etc/systemd/system/darts-pocketbase.service` (adjust paths/`<user>`):
```ini
[Unit]
Description=DartsZentrale PocketBase
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=<user>
WorkingDirectory=/home/<user>/dartszentrale/pocketbase
ExecStart=/home/<user>/dartszentrale/pocketbase/pocketbase serve --automigrate=0 --http=127.0.0.1:8090 --origins=https://app.yourdomain.com --dir=/home/<user>/dartszentrale/pocketbase/pb_data --migrationsDir=/home/<user>/dartszentrale/pocketbase/pb_migrations --hooksDir=/home/<user>/dartszentrale/pocketbase/pb_hooks
Restart=on-failure
RestartSec=3
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/darts-web.service`:
```ini
[Unit]
Description=DartsZentrale Frontend (static dist server)
After=darts-pocketbase.service
Wants=darts-pocketbase.service

[Service]
Type=simple
User=<user>
WorkingDirectory=/home/<user>/dartszentrale/app
Environment=HOST=127.0.0.1
Environment=PORT=4173
ExecStart=/usr/bin/node /home/<user>/dartszentrale/app/serve-dist.mjs
Restart=on-failure
RestartSec=3
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now darts-pocketbase darts-web
```

### 4. Configure Caddy
Copy [`Caddyfile.example`](../Caddyfile.example) to
`/etc/caddy/Caddyfile`, replace the domains, then:
```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### 5. Set up PocketBase
```bash
cd ~/dartszentrale/pocketbase
./pocketbase superuser upsert <admin-email> '<strong-pw>' --dir ./pb_data
node provision.mjs
```
Then in `https://db.yourdomain.com/_/` → set **Application URL** = `https://db.yourdomain.com`.
(CORS does **not** need to be set in the UI — the `--origins` flag in the unit handles that.)

---

## Operations

| Task | Command |
|---|---|
| **Status** | `systemctl status darts-web darts-pocketbase caddy` |
| **Live logs** | `journalctl -u darts-pocketbase -f` |
| **App update (in-app, frontend only)** | put `dartszentrale-update-*.tar.gz` into **`updates/`** → in the app: Settings → "App & Updates" → Install (using the update token that `setup-cloud.sh` showed at the end / `.update-token`). No service restart needed. |
| **App update (script, PocketBase too)** | pull in new files (ZIP/`git pull`) → `./update-server.sh` (rebuilds + restarts the services) |
| **Schema update** | `update-server.sh` brings it along; migrations run on PB start anyway (if needed: `cd pocketbase && node provision.mjs`) |
| **Backups** | enable in PocketBase (`/_/` → Settings → Backups); data lives in `pocketbase/pb_data/` |
| **Pin the PocketBase version** | download a fixed version instead of `:latest`, swap in a controlled way |

### Accounts & emergencies (board machines, passwords)

The ops scripts live in `pocketbase/` and run **on the server** (PocketBase listens there
locally on `127.0.0.1:8090`). `PB_SU_EMAIL`/`PB_SU_PASS` = the superuser account chosen during setup.

- Create a **board/kiosk account** (minimal rights — may only play; **never** hand the admin login
  to the boards):
  ```bash
  cd pocketbase
  BOARD_EMAIL=board1@yourdomain.com BOARD_PW=<strong-pw> \
  PB_URL=http://127.0.0.1:8090 PB_SU_EMAIL=<su-email> PB_SU_PASS=<su-pw> \
  node add-board-account.mjs
  ```
- **Reset an app password** (someone locked themselves out):
  ```bash
  USER_EMAIL=<email> NEW_PW=<min-8-chars> \
  PB_URL=http://127.0.0.1:8090 PB_SU_EMAIL=<su-email> PB_SU_PASS=<su-pw> \
  node reset-password.mjs
  ```
- **Forgot the superuser password?** Briefly stop the service, set a new one, start again:
  ```bash
  sudo systemctl stop darts-pocketbase
  ./pocketbase superuser upsert <su-email> "<new-pw>" --dir ./pb_data
  sudo systemctl start darts-pocketbase
  ```

> Back up / offload / restore a season: `season-export.mjs` · `season-offload.mjs` ·
> `season-import.mjs` (or in the app under Settings → **Season**).

### Changing the domain

Technically, the domain lives in several places (frontend build `VITE_PB_URL`, PocketBase
`--origins`, Caddyfile + CSP). **Don't touch any of these by hand** — simply run `setup-cloud.sh` again with
the new domains; it rewrites all locations consistently and rebuilds the frontend:

```bash
sudo APP_DOMAIN=new.yourdomain.com DB_DOMAIN=db2.yourdomain.com ./setup-cloud.sh
```

> `VITE_PB_URL` is **baked** into the build (compile time) → a domain change requires
> a rebuild anyway; `setup-cloud.sh` takes care of that too.

Separately (outside the server), only two steps remain:
1. Create **DNS** for the new domain (A records `app`/`db` pointing to the same server IP).
2. Adjust the **Application URL** in `https://db2.yourdomain.com/_/`.

Your data (`pocketbase/pb_data/`) remains untouched.

## Legal — imprint & privacy policy (mandatory when running on the internet)

As soon as the app is publicly reachable at `https://app.<domain>`, German law requires:

- An **imprint** ("Impressum") per **§ 5 DDG** (formerly § 5 TMG) — provider identification (name/club, address,
  authorized representative(s), contact, registry entry if applicable).
- A **privacy policy** per **Art. 13 GDPR** — the app processes personal data
  (names, emails, match statistics).

**The operator (the club) is responsible, not the software.** Here is how to enter both:

1. Sign in as an **administrator** → **Settings → Legal** → enter the imprint and
   privacy policy (stored centrally).
2. Both texts then appear as links **on the login page** and are reachable there **without signing in**
   (as the law requires).

> So that the texts are visible even to visitors who have never signed in, the
> `club_config` collection is **publicly readable** (display/config values only, nothing
> personal; writing remains admin-only). To enable this, run `provision.mjs` again **once**:
> ```bash
> cd pocketbase && PB_URL=http://127.0.0.1:8090 PB_SU_EMAIL=<su-email> PB_SU_PASS=<su-pw> node provision.mjs
> ```
> Existing installations from before this change need to do this step once.

No legal texts of your own at hand? Free imprint/privacy-policy generators exist for clubs
(e.g. from data-protection authorities or club associations) — always verify the details yourself.

## Security (before going online)

- **Only 80/443 public.** 8090/4173 already bind only to `127.0.0.1` — additionally block everything
  except 22/80/443 in the host firewall (ufw/Hetzner Cloud Firewall) (resolves finding #3).
- **Security headers** (X-Frame-Options, nosniff, Referrer-/Permissions-Policy, **HSTS**) are already set
  by Caddy — the `security_headers` snippet is part of the generated Caddyfile (findings #9/#13).
- **CORS** is restricted to the app domain — via `--origins=https://app.<domain>` in the
  PocketBase unit (the default would be `*` = any website). `setup-cloud.sh` sets this automatically.
- **Uncomment the CSP:** enable the `Content-Security-Policy` line in the Caddyfile (the script
  already prefills `connect-src https://db.<domain>` correctly) — **test first** that
  login/API/PWA work (check the DevTools console for CSP errors), then `sudo systemctl reload caddy`.
- **Shield the admin console `/_/`:** restrict it to your IP in Caddy (`@admin path /_/*` +
  `handle` blocks, snippet in [`Caddyfile.example`](../Caddyfile.example)) —
  find your IP via `curl ifconfig.me`. No static IP? Put `basic_auth` in front or use VPN/Tailscale. The most important
  protection remains a **strong, unique superuser password**.
- **No `demo-*.mjs` against the production DB** — `setup-cloud.sh` creates the app admin with
  your strong password; the `demo-*.mjs` scripts are for local testing only.
- **HTTPS is mandatory** — Caddy handles it automatically; never serve plaintext HTTP.

➡ Day-to-day use of the app: [`manual.md`](manual.md).
