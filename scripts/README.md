# scripts/ — Start, update & autostart scripts

This folder holds the **operations scripts** for DartsZentrale: starting, updating,
launching automatically at boot, and setting up the cloud server.

> **Important — they sit flat in the download:** In the [downloaded bundles](https://github.com/zelko2k1/dartszentrale/releases/latest)
> these files are **not** inside a `scripts/` subfolder — they sit directly in the main folder
> next to `app/`. So a club double-clicks e.g. `start-local.bat` right at the top of the extracted
> folder, without descending into a subfolder. The `scripts/` folder is just where they **live in
> the source code**; the `copy2share` build copies the matching scripts flat into each bundle.

For most tasks there is a **Linux version (`.sh`)** and a **Windows version (`.bat`/`.ps1`)** —
the `.bat` often just calls the `.ps1`. Naming scheme:

- **`…-local…`** → a single board on one PC (app only, no login)
- **`…-club-lan…`** → club mode on your own network (one program serves the app **and** the database)
- **`…-cloud` / `…-server`** → club mode on an internet server

## Starting
| File | Purpose |
|---|---|
| `start-local.sh` / `.bat` | Starts **a single board** at `http://127.0.0.1:4173` — no server, no login. |
| `start-club-lan.sh` / `.ps1` / `.bat` | Starts **club mode on the LAN** (one program for app + database); the first run creates the admin accounts. |

## Updating
| File | Purpose |
|---|---|
| `update-local.sh` / `.bat` | Installs a **new app version** for a board (from a USB stick/folder). |
| `update-club-lan.sh` / `.ps1` / `.bat` | Replaces **only the app** in LAN mode; your data stays, the old version is backed up. |
| `update-server.sh` | Updates an **internet/Pi server** (app + database) from a stick/folder. |

## Start automatically at boot (autostart)
| File | Purpose |
|---|---|
| `autostart-local.sh` / `.bat` | Board starts **automatically when powered on** (ideal for a kiosk PC). |
| `autostart-club-lan.sh` / `.bat` | LAN server starts **automatically when powered on**. |

## Setup (one-time)
| File | Purpose |
|---|---|
| `setup-cloud.sh` | Sets up an **internet server** completely (database + app as background services + Caddy for HTTPS). Linux, as root. |

## Which bundle gets which script?

Which script ends up in which download bundle is documented in the
[main README](../README.en.md#getting-started--which-guide-fits-me); the
step-by-step guides live under [`docs/`](../docs/) and inside every bundle.
Database and maintenance tools (password reset, season export …) are not here —
they live under [`pocketbase/`](../pocketbase/).
