# DartsZentrale locally (Windows) — one board, no server

**🇬🇧 English | [🇩🇪 Deutsch](de/anleitung-lokal-windows.md)**

The simplest way: the app runs in the browser on **one** Windows PC only — **no server, no
login**. The data is stored locally in that device's browser.

> Multiple devices with real logins, leagues, and teams? That is **club mode** —
> it has its own distribution package (LAN or cloud).
>
> Linux / Raspberry Pi? See [`guide-local-linux.md`](guide-local-linux.md).

---

## 1. One-time: install Node.js (required)

Open [nodejs.org](https://nodejs.org) → download the **LTS** version → installer → Next / Next / Finish.

**Check:** open a Command Prompt, type `node -v` → it must show `v20…` or `v22…`.

> That is **all** local mode needs — no PocketBase, no database.

---

## 2. Starting

Double-click **`start-local.bat`** in the project folder.

The browser opens the app → on the **first start, choose "Local"**. Done.
**Leave the black window open** while you use the app (close the window to stop).

> Does the window close **right away**? Then **Node.js** is usually missing (step 1).

---

## 3. Autostart (kiosk board)

To make the board show the app by itself after booting: double-click **`autostart-local.bat`**.

To remove: `Win+R` → `shell:startup` → delete `DartsZentrale.lnk`.

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

In the project folder, double-click **`update-local.bat`** (uses drive `E:\`; for a different letter:
in a terminal, `update-local.bat F:\`).

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

- **Window closes immediately** → **Node.js** is missing (step 1).
- **"Port in use" / `EADDRINUSE`** → the app is already running in another window; close one of them.
- **Reset everything** → clear the page's **localStorage** in the browser (that is where the data lives).
