# DartsZentrale on the Club Network (LAN) – Setup & Updates (Windows)

**🇬🇧 English | [🇩🇪 Deutsch](de/admin-anleitung-lan-windows.md)**

Step by step, no prior knowledge required. (Linux/Raspberry Pi? → [admin-guide-lan-linux.md](admin-guide-lan-linux.md).)

This is the **simple club variant:** **a single program** (PocketBase) serves both the
app **and** the data — **no Node, no build step.** Ideal for a club network with several boards/tablets.

> **Other modes of operation:**
> - **Just one device, no login** (start and go, data stored in the browser) → package
>   `01-single-board` ([guide-local-windows.md](guide-local-windows.md)).
> - **Server on the internet/cloud** (reachable from anywhere) → package `03-club-cloud`
>   ([admin-guide-cloud.md](admin-guide-cloud.md)).
>
> Day-to-day use: [`manual.md`](manual.md) · Security: [`security-audit.md`](security-audit.md).

---

## 0. Before you start

### 0a. Getting the app onto the machine — the "folder"
You receive the package **`02-club-lan`** as a folder (USB stick/share from the person who set it up). It contains,
among other things, `start-club-lan.bat`, `pb_public\`, `pb_migrations\`, `pb_hooks\`. **Everything belongs in this folder.**

> **Node.js is NOT required.** The program is a single binary that is downloaded automatically
> on first start. You only need **internet access once**, at the very first start.

### 0b. Placeholders
Replace `<server-ip>` and similar with your own value (**drop the brackets `< >`**). **Finding the server IP:**
Command Prompt → `ipconfig` → "IPv4 Address" (e.g. `192.168.1.50`).

---

## 1. Start & set up (double-click)

**Double-click `start-club-lan.bat`** in the folder.

On the **very first start**, the following happens automatically:
1. the **PocketBase binary** is downloaded (~15 MB, internet needed once),
2. you are asked to create **two accounts** which **you** choose — the passwords are **not
   stored** (write them down in a password manager!):
   - **PocketBase console** (maintenance/emergencies at `…:8090/_/`)
   - **App administrator** (your everyday login *inside the app*)
3. the app starts and the browser opens **`http://127.0.0.1:8090`**.

Every subsequent time, double-clicking `start-club-lan.bat` is all you need — the setup only runs
**the first time**. **Leave the window open; close the window to stop.**

> Window closes immediately? Usually antivirus/SmartScreen is in the way — whitelist the folder.

---

## 2. Connecting other boards & tablets

The app is reachable on the network at **`http://<server-ip>:8090`**.
- **Board PC:** save this address as a **bookmark / kiosk shortcut**.
- **Tablet/phone:** in the app, go to *Settings* and scan the **join QR code**.

Sign in with the appropriate account.

---

## 3. Autostart (board starts by itself at sign-in)

**Double-click `autostart-club-lan.bat`** — creates a Startup shortcut. Prerequisite:
`start-club-lan.bat` has been run once (binary + accounts exist).

> **Remove:** `Win+R` → `shell:startup` → delete `DartsZentrale.lnk` there.

---

## 4. Don't mix up the two logins

| | **App administrator** | **PocketBase superuser** |
|---|---|---|
| What for? | everyday use (managing the club) | managing the database/server, backups |
| Where to sign in? | in the app (`…:8090`) | at `…:8090/_/` |
| How often? | daily | rarely (backups, emergencies) |

---

## 5. Backups (important!)

An entire season depends on **`pb_data\`**. Set up backups:
- **PocketBase backups:** `…:8090/_/` → **Settings → Backups** → schedule (e.g. daily).
- **Additionally**, copy `pb_data\` regularly to a USB stick/another device (protection against device loss).

---

## 6. Installing updates

A new version arrives as **`dartszentrale-update-<version>.tar.gz`**. **Your data (`pb_data\`)
remains untouched.**

- Place the package in the **`updates`** folder → **double-click `update-club-lan.bat`**.
- Or with a path/drive: open a Command Prompt in the folder → `update-club-lan.bat E:\` (USB stick).

This swaps out the frontend in `pb_public\` — **no restart needed**; just reload the page on the
boards (possibly twice, due to the PWA cache). The old version is kept in `backup\`.

> **Have migrations/hooks (backend) changed?** Then replace the **entire folder** with the new version
> while **keeping `pb_data\`** (your database). Migrations run on the next start.

---

## 7. Network & security

- **Keep port 8090 inside the LAN only — NEVER forward/port-forward it to the internet.** If you need
  external access, use the **cloud package** (TLS via Caddy).
- Use the PocketBase console `…:8090/_/` only on a trusted network; in Settings, enable
  **rate limiting** and **superuser 2FA**. Details: [`security-audit.md`](security-audit.md).

---

## 8. If something doesn't work

- **Window closes immediately** → antivirus/SmartScreen? Whitelist the folder. Is `pocketbase.exe` in the folder (after the first start)?
- **Other devices can't reach the server** → the Windows Firewall asks on first start — **allow access on private networks**. Correct **`<server-ip>`** (`ipconfig`)?
- **"Port in use"** → a window/the autostart is already running. Close the other window.
- **Initial binary won't download** → internet needed once; behind a proxy, place `pocketbase.exe` in the folder manually if necessary.

---

## 9. Emergencies (passwords)

- **App password forgotten** → reset it in the app as admin, or via the console `…:8090/_/` → `users` → account → new password.
- **Superuser password lost** → close the window, then in a Command Prompt inside the folder:
  `pocketbase.exe superuser upsert <mail> "<new-pw>" --dir pb_data`.
- **Prevention:** keep both passwords in a **password manager**; create a **second app admin** early on.

---

## Appendix — Which file does what?

| File | Purpose |
|---|---|
| `start-club-lan.bat` | **Start** (first start downloads the binary + creates the two accounts) |
| `autostart-club-lan.bat` | **Autostart** at sign-in (Startup shortcut) |
| `update-club-lan.bat` | Install an **update** (swaps `pb_public\`, `pb_data\` is kept) |
| `pb_public\` | the shipped frontend (replaced on update) |
| `pb_migrations\` · `pb_hooks\` | schema & server functions |
| `pb_data\` | **your database** (created on first start) — **back it up!** |

> Ready-made distribution packages (exactly these files per mode of operation, without test/secret files) are
> created by the maintainer using the `copy2share` workflow.
