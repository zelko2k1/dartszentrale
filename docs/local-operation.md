# Running DartsZentrale Locally — Command Cheat Sheet

**🇬🇧 English | [🇩🇪 Deutsch](de/lokaler-betrieb.md)**

Two paths: **A) Local mode** (browser only, no server — the easiest) and
**B) Club mode** (with PocketBase + test data + real logins).

All paths are relative to your project folder (written below as `~/dartszentrale`;
on Windows e.g. `C:\dartszentrale`).

---

## Taking It to Another Machine

**Recommended:** fetch the repo via `git clone` → brings all code + scripts
(`provision.mjs`, `demo-seed.mjs`, `season-*.mjs`, `pb_hooks/` …) automatically.

**Additionally take along manually** — of the operational files only `pb_data/` is
**gitignored** and does *not* come via git:
- *(optional)* `pocketbase/pb_data/` — the real DB; only if you want to carry over
  the exact data state instead of seeding fresh (portable SQLite, OS-independent)

> Everything else — this runbook, all `.mjs` scripts, `pb_hooks/` — is tracked in the
> repo and arrives automatically with `git clone`.

**Do NOT take along — recreate on the target:**
- PocketBase binary (`pocketbase` / `pocketbase.exe`) → platform-specific, re-download
- `app/.env.local` → *optionally* recreate (`VITE_PB_URL=http://127.0.0.1:8090`); the
  server address can also be entered directly in the app (which even takes precedence)
- `app/node_modules/` → `npm install`

### Variant Without git (via USB Stick)

**Copy onto the stick:**
- `app/` — complete, **but without** `app/node_modules/`
- `pocketbase/` with:
  - **all `.mjs` scripts** (`provision.mjs`, `demo-seed.mjs`,
    `reset-password.mjs`, `add-*.mjs`, `season-*.mjs`) ← needed for schema + data!
  - **`pb_hooks/`** (both `.pb.js` — password reset & board protection)
  - **not** the binary (download fresh per OS), **not** `pb_data/` (gets recreated)
- *(optional)* `docs/local-operation.md` / the PDF

**Important:** `app/` and `pocketbase/` must remain **sibling folders** (same level) —
the scripts access the PocketBase library via `../app/node_modules`.

**On the target machine — order of steps with commands.**
(Example paths: Linux `~/dartszentrale`, Windows `C:\dartszentrale`; USB Linux `/media/usb`, Windows `E:\`.)

**1) Create the project folder + copy files from the stick** (`app/` and `pocketbase/` side by side)
```bash
# Linux / Git Bash
mkdir -p ~/dartszentrale && cd ~/dartszentrale
cp -r /media/usb/app ./app
cp -r /media/usb/pocketbase ./pocketbase
```
```powershell
# Windows / PowerShell
mkdir C:\dartszentrale; cd C:\dartszentrale
Copy-Item -Recurse E:\app .\app
Copy-Item -Recurse E:\pocketbase .\pocketbase
```

**2) Get the PocketBase binary for your OS** → place in `pocketbase/`
```bash
# Linux (on ARM: linux_arm64)
cd ~/dartszentrale/pocketbase
wget https://github.com/pocketbase/pocketbase/releases/download/v0.39.5/pocketbase_0.39.5_linux_amd64.zip
unzip -o pocketbase_0.39.5_linux_amd64.zip pocketbase && chmod +x pocketbase
```
```powershell
# Windows
cd C:\dartszentrale\pocketbase
Invoke-WebRequest https://github.com/pocketbase/pocketbase/releases/download/v0.39.5/pocketbase_0.39.5_windows_amd64.zip -OutFile pb.zip
Expand-Archive pb.zip -DestinationPath . -Force
```

**3) Install dependencies** (requires internet)
```bash
# Linux
cd ~/dartszentrale/app && npm install
```
```powershell
# Windows
cd C:\dartszentrale\app; npm install
```

**4) *(optional)* Set the server default** — otherwise enter the address in the app later
```bash
# Linux
printf 'VITE_PB_URL=http://127.0.0.1:8090\n' > ~/dartszentrale/app/.env.local
```
```powershell
# Windows
'VITE_PB_URL=http://127.0.0.1:8090' | Out-File -Encoding ascii C:\dartszentrale\app\.env.local
```

**5) PocketBase: create the superuser + start** (own terminal, leave open)
```bash
# Linux
cd ~/dartszentrale/pocketbase
./pocketbase superuser upsert admin@dartszentrale.local "dartszentrale-admin-2026" --dir ./pb_data
./pocketbase serve --automigrate=0 --http=127.0.0.1:8090 --dir ./pb_data
```
```powershell
# Windows
cd C:\dartszentrale\pocketbase
.\pocketbase.exe superuser upsert admin@dartszentrale.local "dartszentrale-admin-2026" --dir .\pb_data
.\pocketbase.exe serve --automigrate=0 --http=127.0.0.1:8090 --dir .\pb_data
```
> PocketBase creates `pb_data/` and `pb_migrations/` on its own.

**6) Schema + data** (second terminal, in the `pocketbase/` folder — same commands on both OSes)
```bash
node provision.mjs          # schema + app admin (asks for email/password on 1st run)
node demo-seed.mjs    # sample data "Dartverein Demo"
```

**7) Start the app** (own terminal, from the project folder — same on both OSes)
```bash
npm --prefix app run dev -- --port 5173 --strictPort   # desktop  → http://localhost:5173
npm --prefix app run dev -- --port 5174 --strictPort   # kiosk    → http://localhost:5174 (third terminal)
```

> For **testing**, `npm install` + `npm run dev` is enough — an `npm run build` is only
> needed for production (static `dist/`).

### Applying Updates (Without git)

Updates are **mode-specific** — use the script of the respective package. **`pb_data/` (your data),
`node_modules/`, `app/.env.local` and the PocketBase binary are always left untouched.**

| Mode | Update |
|---|---|
| **Single board, local** (`01`) | `./update-local.sh <source>` or `update-local.bat` — or in the app *Settings → App & Updates → Install* |
| **Club LAN** (`02`, single binary) | `./update-club-lan.sh` or `update-club-lan.bat` — swaps `pb_public/`, no restart |
| **Club cloud** (`03`) | `./update-server.sh` (rebuilds + restarts the services) — or in-app |

Afterwards **reload the page on the boards** (possibly twice — the PWA cache may keep serving the
old version for one more load). Details per mode in the `admin-guide-*` documents.

### Linux: Club Mode as a Service (Autostart)

The club-mode LAN setup runs as **one** program (PocketBase serves app + API from `pb_public/`) —
**no Node, no build.** Two scripts take care of it — in the **source repo** they live under
`scripts/`, in a **downloaded bundle** they sit flat next to `app/` (then drop the `scripts/`
prefix, e.g. just `./start-club-lan.sh`):

- **Start manually** (the first start downloads the binary + creates the two admin accounts; Ctrl+C stops):
  ```bash
  scripts/start-club-lan.sh
  ```
- **Set up as a service** (systemd user unit: autostart at boot, auto-restart, journald logs):
  ```bash
  scripts/autostart-club-lan.sh
  ```
  Management afterwards:
  ```bash
  systemctl --user status dartszentrale
  journalctl --user -u dartszentrale -f          # live logs
  systemctl --user disable --now dartszentrale   # remove autostart again (data stays)
  ```

Complete step-by-step guide (also Windows, backups, updates):
[admin-guide-lan-linux.md](admin-guide-lan-linux.md) or
[admin-guide-lan-windows.md](admin-guide-lan-windows.md).

### The Most Important Git Commands

The repo is **public** → `git clone` works without signing in. Only **push** needs
authentication, so `gh auth login` is only required if you want to upload changes.

```bash
# once on a new machine — only needed if you intend to push
gh auth login && gh auth setup-git          # GitHub sign-in (or token at push time)
git config --global user.name  "username"
git config --global user.email "mail"
git clone https://github.com/zelko2k1/dartszentrale.git

# daily
git status                  # what changed?
git pull                    # fetch the latest state
git add -A                  # stage all changes
git commit -m "description"
git push                    # upload
git log --oneline -10       # history

# inspect / undo
git diff                    # view (unstaged) changes
git restore <file>          # discard changes to a file
git restore --staged <file> # take back out of "add"

# branches (optional)
git checkout -b feature/xyz # create + switch to a branch
git checkout main           # back to main
git merge feature/xyz       # merge into main
git branch -d feature/xyz   # delete the finished branch
```

---

## 0. Required Programs

| Program | What for | Linux | Windows |
|---|---|---|---|
| **Node.js 24 (LTS)** (with `npm`) | build/run the app + `.mjs` scripts | package manager / nodejs.org / nvm | installer from nodejs.org |
| **Browser** (Edge/Chrome recommended) | use the app (PWA installation) | present | present |
| **PocketBase 0.39.x** (a single binary) | backend — **club mode only** | `pocketbase` + `chmod +x` | `pocketbase.exe` |
| **Git** | fetch/update the code | `apt install git` | git-scm.com (comes with **Git Bash**) |
| **Terminal** | enter commands | bash | PowerShell **or** Git Bash |

- **Local mode only** (see A) needs just **Node.js + browser** — PocketBase only for club mode.
- **Windows:** easiest is **Git Bash** → all commands below apply 1:1. In PowerShell use
  `.\pocketbase.exe …` instead and set variables via `$env:VAR="value"; node script.mjs`.

## 0b. Installing the Programs

### Ubuntu
```bash
# Node.js 24 (LTS) via NodeSource (Ubuntu's apt Node is often too old)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs git unzip

# PocketBase 0.39.5 into the pocketbase folder (on ARM: linux_arm64)
cd pocketbase
wget https://github.com/pocketbase/pocketbase/releases/download/v0.39.5/pocketbase_0.39.5_linux_amd64.zip
unzip -o pocketbase_0.39.5_linux_amd64.zip pocketbase && chmod +x pocketbase
./pocketbase --version
```

### Windows
```powershell
# in PowerShell (Windows 10/11)
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```
Alternatively install Node LTS from nodejs.org and Git from git-scm.com (Git comes with **Git Bash**
→ all commands here apply 1:1). PocketBase: extract `pocketbase_0.39.5_windows_amd64.zip` from the
GitHub releases, place `pocketbase.exe` in the `pocketbase\` folder.
Start: `.\pocketbase.exe serve --automigrate=0 --http=127.0.0.1:8090 --dir .\pb_data`.

Check: `node -v` (≥ 20), `npm -v`, `git --version`.

## 0c. One-Time: Install Dependencies

```bash
cd ~/dartszentrale/app
npm install
```

---

## A) Local Mode — Browser Only, No Server

Fastest way for personal use on a single device. Data lives in the browser
(localStorage), sample data is created automatically on first start.

```bash
cd ~/dartszentrale/app
# make sure it does NOT point at a server:
#   delete app/.env.local OR leave VITE_PB_URL empty
npm run dev
```

Then open **http://localhost:5173**. If the app lands on the login screen:
Settings → Usage mode → choose **Local**.

> No login, no league/team/user management — deliberately reduced.
> To reset: clear the page's localStorage in the browser.

---

## B) Club Mode — PocketBase + Test Data

Full feature set (login, roles, leagues, teams, seasons …).

### 1. Start PocketBase
In its **own terminal** (runs in the foreground — leave open), from the `pocketbase/` folder:

```bash
# Linux / Git Bash
cd ~/dartszentrale/pocketbase
./pocketbase serve --automigrate=0 --http=127.0.0.1:8090 --dir ./pb_data
```
```powershell
# Windows / PowerShell
cd C:\path\to\dartszentrale\pocketbase
.\pocketbase.exe serve --automigrate=0 --http=127.0.0.1:8090 --dir .\pb_data
```
Runs at http://127.0.0.1:8090 · admin console: **http://127.0.0.1:8090/_/**

**First start — create the superuser (DB admin)** (needed only once). Either via CLI *before* the `serve`:
```bash
./pocketbase superuser upsert admin@dartszentrale.local "dartszentrale-admin-2026" --dir ./pb_data
```
…or fill in the form shown in the browser under `/_/`.
> The scripts sign in with `admin@dartszentrale.local` / `dartszentrale-admin-2026` — use the same
> credentials, or prepend `PB_SU_EMAIL`/`PB_SU_PASS`.

**Stopping:** Ctrl+C in the PocketBase terminal. Data stays in the `pb_data/` folder.

### 2. Create Schema + App Admin (Idempotent)
In a second terminal:
```bash
cd ~/dartszentrale/pocketbase
node provision.mjs
```
Creates all collections (incl. `seasons`/`season_snapshots`) and — if **no** admin
exists yet — interactively asks for the first app admin's email + password
(non-interactively via `APP_ADMIN_EMAIL=… APP_ADMIN_PASS=… node provision.mjs`).
**Run again after every `git pull`** in case the schema changed
(an existing admin is left untouched).

> **Dev convention:** If you want to use the demo scripts/test logins below 1:1, type
> `chef@dartszentrale.local` / `dartszentrale123` at the prompt — then `demo-seed*.mjs` and the
> test-login table line up. (This is just a local recommendation, not a hard-wired account.)

### 3. Load Test Data
```bash
node demo-seed.mjs      # "Dartverein Demo": 20 members, 2 teams, 2 leagues + schedule
node add-board-account.mjs         # low-privilege board account for kiosk tests
```
> `demo-seed.mjs` **empties** the content collections first and creates them fresh
> (**existing admin accounts are left untouched**). Ideal for resetting to a clean state.

### 4. Point the App at the Server — Two Ways

**The entry in the app always takes precedence.** `VITE_PB_URL` is only a build default
(applies when nothing is entered in the app). Order in the code:
`app setting → else VITE_PB_URL → else local mode`.

- **a) In the app** (no `.env.local` needed): start the app → Settings →
  Usage mode **Club** → enter the **server/PocketBase address** `http://127.0.0.1:8090`.
  Stored per device.
- **b) As a default via file** `app/.env.local` (already exists) — convenient when every
  freshly built instance should point at the server right away (e.g. deployment **or** the
  two-instance setup :5173/:5174, so you don't have to type the address in both browsers):
  ```
  VITE_PB_URL=http://127.0.0.1:8090
  ```

### 5. Start the App
```bash
cd ~/dartszentrale/app
npm run dev
```
Open **http://localhost:5173** and sign in.

### Test Logins (demo accounts from `demo-seed*.mjs`, all with password `dartszentrale123`)
| Role | Email |
|------|-------|
| Admin | the admin chosen at the `provision.mjs` prompt (dev convention: `chef@dartszentrale.local`) |
| Captain | `sandra.koester@sv-adler.de` |
| Player | `daniel.weber@sv-adler.de` |
| Viewer (read only) | `schriftfuehrung@sv-adler.de` |
| Inactive (login blocked) | `t.reiter@web.de` |
| PocketBase console | `admin@dartszentrale.local` / `dartszentrale-admin-2026` |

> ⚠️ **These passwords (`dartszentrale123`, `dartszentrale-admin-2026`) are purely default values
> for local first-time setup and testing** — they are deliberately public in the docs. For
> real operation (LAN/cloud), **set your own strong passwords at first login or when creating accounts.**
> A security guard (`pocketbase/_security-guard.mjs`) aborts as soon as a known default
> would run against a non-local target.

---

## Two Instances (Testing Desktop + Kiosk)

Kiosk mode needs a different localStorage origin → second port:
```bash
npm --prefix app run dev -- --port 5173 --strictPort   # desktop
npm --prefix app run dev -- --port 5174 --strictPort   # kiosk (second terminal)
```
Sign in on :5174 with the **board account** (from `add-board-account.mjs`) → kiosk.

> ⚠️ **Don't keep two dev servers running while changing code** — they share
> the Vite cache and then partly serve stale code. When developing, run only
> one server; the second only for testing. Repair: stop the servers,
> `rm -rf app/node_modules/.vite`, restart.

---

## Script Reference (pocketbase/) — What Does What

All scripts are Node scripts, sign in as the **PocketBase superuser** and are
idempotent (safe to run multiple times). The default target is the local instance `:8090`; for
the cloud, prepend `PB_URL`, `PB_SU_EMAIL`, `PB_SU_PASS` as environment variables.

### How Do I Run the .mjs Scripts?

`.mjs` = JavaScript file that runs with **Node.js**. Prerequisites:

1. **Node.js 24 (LTS)** installed (`node -v` to check).
2. **`npm install` run in `app/`** — the scripts use the PocketBase library
   from `app/node_modules` (via relative import). Without `node_modules` they fail.
3. **PocketBase is running** (`./pocketbase serve …` in another terminal) — the scripts
   talk to the running instance.
4. Call them from the **`pocketbase/` directory** (the relative paths assume it).

```bash
cd ~/dartszentrale/pocketbase

node provision.mjs                                   # simple call
USER_EMAIL=chef@dartszentrale.local NEW_PW="abc12345" node reset-password.mjs   # with variables
node season-import.mjs dartszentrale-saison-2024-25.json  # with a file argument

# against a cloud instance instead of local:
PB_URL=https://db.yourdomain.com PB_SU_EMAIL=admin@… PB_SU_PASS=… MEMBER_PW=… node demo-seed.mjs
```

`VAR=value node script.mjs` sets an environment variable for this one call only.
For several, simply prepend them one after another (separated by spaces).

| Script | Purpose | Invocation |
|--------|---------|------------|
| **provision.mjs** | **Schema setup.** Creates/updates all collections (players, teams, leagues, events, matches, users, seasons, season_snapshots …), sets the API rules and the first app admin. Also does the season backfill (active season + filling in `seasonId`/`playerId`). **Mandatory after every schema update / `git pull`.** | `node provision.mjs` |
| **demo-seed.mjs** | **Import "Dartverein Demo".** Fresh DB: season 2026/27 (Sept–July), 20 members (as players + accounts), 2 teams (8 each + captain), 2 leagues with 10 teams each and a complete home/away schedule (no results, events spread across the season). | `node demo-seed.mjs` |
| **add-board-account.mjs** | Creates a **low-privilege board account** (role "board") for kiosk machines (may only play, manage nothing). | `BOARD_EMAIL=board@… BOARD_PW=… node add-board-account.mjs` |
| **reset-password.mjs** | **Reset an app account's password** + reactivate the account. Emergency tool when you've locked yourself out of the app (the superuser is the lifeline). | `USER_EMAIL=… NEW_PW=… node reset-password.mjs` |
| **reset-2fa.mjs** | **Switch off an app account's two-factor auth (TOTP).** Last resort when the authenticator phone **and** the backup codes are gone — afterwards the user signs in with the password only and can set 2FA up again. | `USER_EMAIL=… node reset-2fa.mjs` |
| **season-export.mjs** | **Back up a season as a JSON bundle** (leagues, teams, events, matches, snapshot). Safekeeping / re-import basis / Grafana feed. | `SEASON_NAME="2024/25" node season-export.mjs` |
| **season-offload.mjs** | **Offload a season**: deletes the (heavy) matches of an *archived* season from the DB and sets `offloaded=true` → frees space. Standings/squads/events remain. Export first! | `SEASON_NAME="2024/25" node season-offload.mjs` |
| **season-import.mjs** | **Restore a bundle**: recreates missing records and sets `offloaded=false`. Reverses an offload. | `node season-import.mjs <bundle.json>` |

> Export / closing / offloading / re-import are also available **in the app** under
> Settings → **Season** (admin).

### App Scripts (app/, via npm)
| Command | Purpose |
|---------|---------|
| `npm run dev` | development server with hot reload (http://localhost:5173) |
| `npm run build` | production build: check TypeScript + bundle into `dist/` |
| `npm run preview` | serve the built `dist/` for **testing** (via Vite, needs dev dependencies) |
| `npm run serve` | serve the built `dist/` in **production** (`node serve-dist.mjs`, dependency-free, SPA fallback; `HOST`/`PORT` via env) |
| `npm run lint` | ESLint over the code |

---

## Checking the Production Build
```bash
cd ~/dartszentrale/app
npm run build      # tsc + vite build → dist/
npm run preview    # test the static dist/ locally
```

### Building Only the `app/` Folder (e.g. from a USB Stick)

The `app/` folder is **self-contained** — it needs neither `pocketbase/` nor
anything else to build. **Node.js + npm** on the target machine remains a prerequisite.

- **Copy `app/` without `node_modules`** (recommended, small): run `npm install`
  over there (needs internet) → `npm run build`.
- **Copy `app/` with `node_modules`**: builds offline **without** `npm install` — but **only
  on the same operating system**. ⚠️ Linux ↔ Windows fails (platform-specific
  binaries like esbuild/Rollup). In that case delete `node_modules` and run `npm install` again.
- **Run only, no build:** the finished **`dist/` folder** is static and runs
  without `node_modules` — e.g. with `node app/serve-dist.mjs` (Node standard library only,
  via `npm run serve`) or any web server. (`npm run preview`, by contrast, needs
  the dev dependencies.)

> Never copy `node_modules` between different operating systems.

## Stopping
- Dev server / PocketBase: **Ctrl+C** in the respective terminal.
- Free stuck ports: `fuser -k 5173/tcp 5174/tcp 8090/tcp`
