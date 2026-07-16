# DartsZentrale locally (Linux / Raspberry Pi) — one board, no server

**🇬🇧 English | [🇩🇪 Deutsch](de/anleitung-lokal-linux.md)**

The simplest way: the app runs in the browser on **one** device only — **no server, no
login**. The data is stored locally in that device's browser.

> Multiple devices with real logins, leagues, and teams? That is **club mode** —
> it has its own distribution package (LAN or cloud).
>
> Windows? See [`guide-local-windows.md`](guide-local-windows.md).

---

## 1. One-time: install Node.js (required)

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
```

**Check:** open a terminal, type `node -v` → it must show `v20…` or `v22…`.

> That is **all** local mode needs — no PocketBase, no database.

---

## 2. Starting

In the project folder: **`./start-local.sh`**.

The browser opens the app → on the **first start, choose "Local"**. Done.
**Leave the terminal open** while you use the app (stop with **Ctrl+C**).

> Does the command exit **immediately**? Then **Node.js** is usually missing (step 1).

---

## 3. Autostart (kiosk board)

To make the board show the app by itself after booting: **`./autostart-local.sh`**.

To remove: the script prints the matching removal command at the end.

---

## 4. Installing updates

### Easiest way — directly in the app (recommended)

1. Place the file **`dartszentrale-update-<version>.tar.gz`** in the **`updates`** folder next to the app
   (the app shows the exact path under *Settings → App & Updates*; the folder is created
   automatically at startup).
2. In the app: **Settings → "App & Updates" → "Check for updates"** → **"Install"**.

The app swaps in the new version and reloads itself — **no restart, no terminal**. On a
local board, no password/token is required for this (it only runs on this device).

### Alternatively — via script (USB stick/folder)

In the project folder: **`./update-local.sh <source>`** (e.g. `./update-local.sh /media/usb`).

This takes over the new files and rebuilds the app. In local mode the data lives in the
browser — nothing is lost. Afterwards, **reload** the page on the board.

---

## 5. Usage

Local mode is **deliberately minimal**: **no** login, **no** roles, leagues,
teams, or user management. The focus is on:

- **Darts Counter** — scoring a game,
- **Board/kiosk mode** — the full-screen view for the board.

How exactly this works is described in [`manual.md`](manual.md), sections **10 (Counter)** and
**11 (Board/kiosk mode)**. (The sections on login, roles, leagues, etc. only apply to
club mode and do not apply here.)

---

## 6. If something doesn't work

- **Command exits immediately** → **Node.js** is missing (step 1).
- **"Port in use" / `EADDRINUSE`** → the app is already running in another terminal; stop one of them.
- **Reset everything** → clear the page's **localStorage** in the browser (that is where the data lives).
