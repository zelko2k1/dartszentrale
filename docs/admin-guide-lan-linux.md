# DartsZentrale on the Club Network (LAN) – Setup & Updates (Linux / Raspberry Pi)

**🇬🇧 English | [🇩🇪 Deutsch](de/admin-anleitung-lan-linux.md)**

Step by step, no prior knowledge required. (Windows? → [admin-guide-lan-windows.md](admin-guide-lan-windows.md).)

This is the **simple club variant:** **a single program** (PocketBase) serves both the
app **and** the data — **no Node, no build step.** Ideal for a club network with several boards/tablets.

> **Other modes of operation:**
> - **Just one device, no login** (start and go, data stored in the browser) → package
>   `01-lokal-ein-board` ([guide-local-linux.md](guide-local-linux.md)).
> - **Server on the internet/cloud** (reachable from anywhere) → package `03-verein-cloud`
>   ([admin-guide-cloud.md](admin-guide-cloud.md)).
>
> Day-to-day use: [`manual.md`](manual.md) · Security: [`security-audit.md`](security-audit.md).

---

## 0. Before you start

### 0a. Getting the app onto the machine — the "folder"
You receive the package **`02-verein-lan`** as a folder (USB stick/share from the person who set it up). It contains,
among other things, `start-club-lan.sh`, `pb_public/`, `pb_migrations/`, `pb_hooks/`. **All commands are run inside this folder.**

> **Node.js is NOT required.** The program is a single binary that is downloaded automatically
> on first start. You only need **internet access once**, at the very first start.

### 0b. Opening a terminal in the folder
Open the folder in your file manager → **right-click → "Open in Terminal"**. If a command keeps
running "forever" (the server), that is **intentional** — **leave the window open**.

### 0c. Placeholders in commands
Replace `<server-ip>` and similar with your own value (**drop the brackets `< >`**). **Finding the server IP:**
`hostname -I` (first number, e.g. `192.168.1.50`).

---

## 1. Start & set up (one command)

In the terminal, inside the folder:
```bash
./start-club-lan.sh
```
On the **very first start**, the following happens automatically:
1. the **PocketBase binary** is downloaded (~15 MB, internet needed once),
2. you are asked to create **two accounts** which **you** choose — the passwords are **not
   stored** (write them down in a password manager!):
   - **PocketBase console** (maintenance/emergencies at `…:8090/_/`)
   - **App administrator** (your everyday login *inside the app*)
3. the app starts and the browser opens **`http://127.0.0.1:8090`**.

Every subsequent time, the same command `./start-club-lan.sh` is all you need — the setup only runs
**the first time**. **Leave the window open; stop with Ctrl+C.**

> Only this one device (no network access)? `HOST=127.0.0.1 ./start-club-lan.sh`.

---

## 2. Connecting other boards & tablets

The app is reachable on the network at **`http://<server-ip>:8090`**.
- **Board PC:** save this address as a **bookmark / kiosk shortcut**.
- **Tablet/phone:** in the app, go to *Settings* and scan the **join QR code**.

Sign in with the appropriate account.

---

## 3. Autostart (board starts by itself on boot)

```bash
./autostart-club-lan.sh
```
Sets up **one** systemd user service (starts at boot, restarts on crash). Prerequisite:
`./start-club-lan.sh` has been run once (binary + accounts exist).
- Status: `systemctl --user status dartszentrale`
- Logs: `journalctl --user -u dartszentrale -f`
- Remove: `systemctl --user disable --now dartszentrale`

---

## 4. Don't mix up the two logins

| | **App administrator** | **PocketBase superuser** |
|---|---|---|
| What for? | everyday use (managing the club) | managing the database/server, backups |
| Where to sign in? | in the app (`…:8090`) | at `…:8090/_/` |
| How often? | daily | rarely (backups, emergencies) |

---

## 5. Backups (important!)

An entire season depends on **`pb_data/`**. Set up backups:
- **PocketBase backups:** `…:8090/_/` → **Settings → Backups** → schedule (e.g. daily).
- **Additionally**, copy `pb_data/` regularly to a USB stick/another device (protection against device loss).

---

## 6. Installing updates

A new version arrives as **`dartszentrale-update-<version>.tar.gz`**. **Your data (`pb_data/`)
remains untouched.**

```bash
./update-club-lan.sh                 # takes the newest package in the updates/ folder
./update-club-lan.sh /media/usb      # or specify the path to the stick/package
```
This swaps out the frontend in `pb_public/` — **no restart needed**; just reload the page on the
boards (possibly twice, due to the PWA cache). The old version is kept in `backup/`.

> **Have migrations/hooks (backend) changed?** Then replace the **entire folder** with the new version
> while **keeping `pb_data/`** (your database). Migrations run on the next start.

---

## 7. Network & security

- **Keep port 8090 inside the LAN only — NEVER forward/port-forward it to the internet.** If you need
  external access, use the **cloud package** (TLS via Caddy).
- Use the PocketBase console `…:8090/_/` only on a trusted network; in Settings, enable
  **rate limiting** and **superuser 2FA**. Details: [`security-audit.md`](security-audit.md).

---

## 8. If something doesn't work

- **Exits immediately / "command not found"** → are you in the right folder? (`start-club-lan.sh` must be there; make it executable: `chmod +x start-club-lan.sh`.)
- **Other devices can't reach the server** → started with LAN bind (default `0.0.0.0`)? Firewall
  (`ufw`) open for port 8090 on the LAN? Correct **`<server-ip>`**?
- **"Port in use"** → a server/the autostart service is already running: `systemctl --user status dartszentrale`.
- **Initial binary won't download** → internet needed once; behind a proxy, place the `pocketbase` binary in the folder manually if necessary.

---

## 9. Emergencies (passwords)

- **App password forgotten** → reset it in the app as admin, or via the console `…:8090/_/` → `users` → account → new password.
- **Superuser password lost** → stop the program/service, then set a new one:
  `./pocketbase superuser upsert <mail> "<new-pw>" --dir ./pb_data`.
- **Prevention:** keep both passwords in a **password manager**; create a **second app admin** early on.

---

## Appendix — Which file does what?

| File | Purpose |
|---|---|
| `./start-club-lan.sh` | **Start** (first start downloads the binary + creates the two accounts) |
| `./autostart-club-lan.sh` | **Autostart** at boot (systemd user service) |
| `./update-club-lan.sh` | Install an **update** (swaps `pb_public/`, `pb_data/` is kept) |
| `pb_public/` | the shipped frontend (replaced on update) |
| `pb_migrations/` · `pb_hooks/` | schema & server functions |
| `pb_data/` | **your database** (created on first start) — **back it up!** |

> Ready-made distribution packages (exactly these files per mode of operation, without test/secret files) are
> created by the maintainer using the `copy2share` workflow.
