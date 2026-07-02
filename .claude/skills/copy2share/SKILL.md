---
name: copy2share
description: Erzeugt unter copy2share/ drei Verteil-Bundles (lokal ein Board · Vereinsmodus LAN · Vereinsmodus Cloud) mit NUR den jeweils nötigen DartsZentrale-Dateien/Skripten — zum Kopieren auf USB-Stick, Netzwerkshare oder in die Cloud. Aufrufen, wenn der Nutzer ein Verteilpaket / „copy2share" / Dateien für einen bestimmten Betrieb zusammenstellen will.
---

# copy2share — Verteil-Bundles bauen

Baut aus dem Projekt drei in sich geschlossene Ordner, sodass man genau den passenden auf
einen USB-Stick, einen Netzwerkshare oder in die Cloud kopieren kann:

| Ordner | Für |
|---|---|
| `01-lokal-ein-board` | Lokaler Betrieb, ein Board (nur Frontend, kein Server) |
| `02-lan-vereinsmodus` | Vereinsmodus im eigenen Netz (Frontend + PocketBase-Ops) |
| `03-cloud-vereinsmodus` | Vereinsmodus in der Cloud (Docker/Coolify-Bundle) |

Jeder Ordner enthält **nur die nötigen** Dateien + eine `LIESMICH.txt`. Bewusst ausgeschlossen:
`node_modules`, `dist`, `.env.local`, `pb_data`, das PocketBase-Binary, die `demo-*.mjs` (Testdaten)
und `seed-remote.sh` (Secrets).

## Ausführen

1. Build-Skript laufen lassen (optional ein Zielpfad als Argument, sonst `copy2share/` im Projekt):
   ```bash
   bash .claude/skills/copy2share/build.sh
   # oder gezielt z. B. direkt auf einen Stick:
   bash .claude/skills/copy2share/build.sh /media/usb/dartszentrale
   ```
2. Dem Nutzer kurz berichten: welche drei Bundles entstanden sind, ihre Größen (aus der
   Skript-Ausgabe), und dass er nun den passenden Unterordner auf Stick/Share/Cloud kopieren kann.

> Hinweis: `copy2share/` ist gitignored (Verteil-Artefakt, kein Commit). Das Skript ist idempotent —
> es löscht das Ziel vorher und baut frisch.
