---
name: copy2share
description: Erzeugt unter copy2share/ drei Verteil-Bundles (lokal ein Board · Vereinsmodus LAN als Single-Binary · Vereinsmodus Cloud) mit NUR den jeweils nötigen DartsZentrale-Dateien/Skripten — zum Kopieren auf USB-Stick, Netzwerkshare oder in die Cloud. Aufrufen, wenn der Nutzer ein Verteilpaket / „copy2share" / Dateien für einen bestimmten Betrieb zusammenstellen will.
---

# copy2share — Verteil-Bundles bauen

Baut aus dem Projekt drei in sich geschlossene Ordner, sodass man genau den passenden auf
einen USB-Stick, einen Netzwerkshare oder in die Cloud kopieren kann:

| Ordner | Für |
|---|---|
| `01-lokal-ein-board` | Ein Board lokal: starten & loslegen, **kein Server, kein Login** (Daten im Browser, mit Auto-Backup nach `backup/`). Node/serve-dist. |
| `02-verein-lan` | Vereinsmodus im eigenen Netz — **EINFACH**: ein Binary (PocketBase liefert die App aus `pb_public/` selbst aus), **kein Node, kein Build** (`start-verein-lan.*`, `update-verein-lan.*`, `autostart-verein-lan.*`) |
| `03-verein-cloud` | Vereinsmodus in der Cloud (schlank per Caddy, `einrichten-cloud.sh`) |

Jeder Ordner enthält **nur die nötigen** Dateien + eine `LIESMICH.txt`. Bewusst ausgeschlossen:
`node_modules`, `dist`, `.env.local`, `pb_data`, das PocketBase-Binary, die `demo-*.mjs` (Testdaten)
und `seed-remote.sh` (Secrets).

> **`02-verein-lan`** enthält bewusst das **vorgebaute Frontend als `pb_public/`** (Same-Origin,
> ohne `VITE_PB_URL`), damit der Verein weder Node noch Build braucht. Das PocketBase-Binary lädt
> `start-verein-lan.*` beim ersten Start selbst. Baut nur, wenn `app/node_modules` vorhanden sind
> (`build_pubdir` in `build.sh`); sonst wird das Bundle mit Hinweis übersprungen.
>
> **Arcane/Docker** ist bewusst **kein** copy2share-Bundle, sondern der separate Weg für
> Fortgeschrittene (Homelab/Cloud) — siehe `docs/arcane-homelab-anleitung.md`.

## Ausführen

1. Build-Skript laufen lassen (optional ein Zielpfad als Argument, sonst `copy2share/` im Projekt):
   ```bash
   bash .claude/skills/copy2share/build.sh
   # oder gezielt z. B. direkt auf einen Stick:
   bash .claude/skills/copy2share/build.sh /media/usb/dartszentrale
   ```
2. Dem Nutzer kurz berichten: welche Bundles entstanden sind, ihre Größen (aus der
   Skript-Ausgabe), und dass er nun den passenden Unterordner auf Stick/Share/Cloud kopieren kann.

> Hinweis: `copy2share/` ist gitignored (Verteil-Artefakt, kein Commit). Das Skript ist idempotent —
> es löscht das Ziel vorher und baut frisch.
