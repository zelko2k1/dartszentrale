# Plan: Saison-Lebenszyklus (Abschluss · Neubeginn · Soft-Archiv · Auslagern)

> **Status: umgesetzt (Phasen 1–4).** Saison-Entität, Soft-Archiv + Read-only, Abschluss/Snapshot/Export,
> „Neue Saison"-Assistent und Auslagern/Re-Import sind im Code. Dieses Dokument bleibt als Konzept/Plan.

Stand: 2026-06-26. Ziel: Datenbestand sauber nach Saisons trennen, abgeschlossene
Saisons als **Soft-Archiv** in der DB behalten und bei Platzbedarf eine Saison
**auslagern** (wegsichern + aus der Live-DB entfernen), ohne die History in der App zu
verlieren.

Bestehende Collections (aus `provision.mjs`): `players`, `teams`, `leagues`, `events`,
`matches`, `club_config`, `user_prefs`, `users`.

---

## 1. Leitidee: Zwei-Stufen-Archiv

| Stufe | Was passiert | In DB | In App sichtbar | Footprint |
|------|--------------|-------|-----------------|-----------|
| **aktiv** | laufende Saison | voll | editierbar | – |
| **archiviert** (Soft) | Saison abgeschlossen | voll (read-only) + Snapshot | komplett, nur lesen | winzig |
| **ausgelagert** (Cold) | Detaildaten weggesichert + gelöscht | nur Snapshot | nur Zusammenfassung | minimal |

Der **Snapshot** (eingefrorene Endtabelle + Saison-Aggregate je Spieler + Kader) bleibt
**immer** in der DB — auch nach dem Auslagern. So zeigt die App jede alte Saison günstig
an, ohne die rohen Matches zu brauchen.

> **Ehrliche Platz-Einordnung:** Relationale Saisondaten sind klein (Matches sind
> Aggregate, ~wenige MB/Saison). Die echten Plattenfresser sind meist (1) auflaufende
> **PocketBase-Auto-Backups**, (2) **hochgeladene Fotos/Dateien**, (3) Logs. Das
> Auslagern ist Zukunftssicherung; der größere Hebel ist eine **Backup-Retention** +
> Größen-Monitoring von `pb_data` (siehe §7).

---

## 2. Datenmodell-Änderungen

### Neu: `seasons`
```
Season { id, name ("2025/26"), startDate, endDate,
         status: 'active' | 'archived',
         offloaded: bool (true = Detaildaten ausgelagert, nur Snapshot da) }
```
- Invariante: **genau eine** aktive Saison (in App + API-Rule absichern).

### Neu: `season_snapshots` (unveränderlich, bleibt nach Auslagern erhalten)
```
SeasonSnapshot { id, seasonId,
  standings: [ { leagueId, leagueName, rows:[{pos,team,sp,s,u,n,diff,pkt}] } ],
  playerStats: [ { playerId, name, avg3, games, wins, losses, c180, checkoutPct, highFinish, ... } ],
  teamRosters: [ { teamId, name, kind, captainId, memberIds } ],
  meta: { generatedAt, matchCount } }
```

### `seasonId` ergänzen bei: `leagues`, `teams`, `events`, `matches`
- `leagues.season` (Freitext) → auf `seasonId` migrieren (Text als Label behalten/ableiten).
- `events`: zumindest für Typen `ligaspiel`/`pokal`/`spieltag` an Saison binden.

### Altlast beheben: `matches` referenzieren Spieler per **Name**
- `MatchPlayerStat` um **`playerId`** erweitern. Pflicht für belastbare
  saisonübergreifende Statistik (Namensänderung/Gleichnamigkeit). → Phase 1/2.

---

## 3. Flow „Saison abschließen"

Admin-Aktion, idempotent:
1. **Guard:** aktive Saison vorhanden; Hinweis auf offene Pflicht-Begegnungen.
2. **Snapshot einfrieren:** Tabellen je Liga, Spieler-Saison-Aggregate, Kader →
   `season_snapshots`-Datensatz (eingefroren, weil berechnete Tabellen sich bei späteren
   Änderungen verschieben würden).
3. **Export-Bundle erzeugen** (immer, *vor* jedem Löschen): portable Datei mit
   Leagues+Fixtures, Teams, Events, Matches, Snapshot →
   `dartszentrale-season-2025-26-<datum>.json` (optional `.zip`), in der App herunterladbar
   und/oder auf ein Backup-Ziel geschrieben. **Das ist die Wegsicherung.**
4. `season.status = 'archived'`.
5. App zeigt die Saison ab jetzt **read-only** (aus Snapshot).

## 4. Flow „Neue Saison anlegen"

1. Neue `Season` (status `active`) — vorige muss archiviert sein (oder Auto-Archiv mit
   Bestätigung).
2. **Übernahme-Assistent:**
   - **Mannschaften:** Vorsaison-Teams als Startpunkt klonen (Kader + Kapitäne), dann
     bearbeiten → neue `Team`-Datensätze mit neuer `seasonId` (alte bleiben).
   - **Spieler:** globale Spielerliste bleibt (saisonübergreifend).
   - **Ligen:** neu anlegen (Name/Saison/Format), optional Struktur/Gegner aus Vorsaison
     übernehmen.
   - **Spielpläne:** neue Liga-/Pokaltermine — **vorhandenes Tooling nutzen**
     (`app/src/lib/scheduleImport.ts`, `tools/pdf2schedule.mjs`).
   - **Kalender:** Liga-/Pokal-Events aus den neuen Fixtures generieren (an `seasonId`).
3. Als aktiv setzen.

## 5. Flow „Saison auslagern" (Plattenplatz freigeben)

Nur für bereits **archivierte** Saisons. Destruktiv → starke Bestätigung.
1. **Export verifizieren:** Bundle existiert + ist sicher off-server (S3/Storage Box),
   Prüfsumme ok. Ohne verifizierten Export **kein** Löschen.
2. **Purge** der schweren Zeilen für `seasonId = X`: vor allem `matches`. Optional auch
   `leagues`/`teams`/`events` (klein) — Snapshot enthält Tabellen+Kader.
3. **Behalten:** `seasons`- und `season_snapshots`-Datensatz. `season.offloaded = true`.
4. App zeigt die Saison nur noch aus Snapshot („Detaildaten ausgelagert — Re-Import
   möglich").
5. **Re-Import** jederzeit aus dem Bundle möglich.

---

## 6. Tooling (Skripte, Stil wie `add-board-account.mjs`)

- `pocketbase/season-export.mjs` — Saison → JSON-Bundle (+ optional Upload S3/Storage Box).
- `pocketbase/season-offload.mjs` — Purge der schweren Zeilen, **nur** nach verifiziertem Export.
- `pocketbase/season-import.mjs` — Bundle zurückspielen.
- In-App: „Abschließen"/„Neue Saison"/„Auslagern" als Admin-Aktionen; das eigentliche
  Purgen läuft über das Skript (destruktiv, mit Bestätigung).

## 7. Betrieb / Plattenplatz (der eigentliche Hebel)

- **Backup-Retention** in PocketBase setzen (alte Auto-Backups rotieren) — sonst füllen
  die Backup-Zips die Platte schneller als die Nutzdaten.
- `pb_data`-Größe monitoren (`du -sh pb_data`), Alarm bei Schwellwert.
- Fotos/Dateien im Blick behalten (PocketBase-File-Storage).

## 8. Migration (`provision.mjs`, idempotent)

- Neue Collections `seasons`, `season_snapshots`; `seasonId`-Felder; `playerId` in
  Match-Stats.
- **Backfill:** eine „aktuelle" Season anlegen, bestehende `leagues`/`teams`/`events`/
  `matches` ihr zuordnen.
- **API-Rules:** archivierte Saisons schreibgeschützt (Schreibregeln prüfen Saison-Status
  bzw. nur Admin); „eine aktive Saison" absichern.

## 9. UI-Änderungen

- **Saison-Umschalter** (Dropdown in Kopf/Sidebar): jede Saison ansehen; aktive
  editierbar, archivierte read-only, ausgelagerte nur Zusammenfassung.
- Admin/Einstellungen: „Saison abschließen", „Neue Saison" (Assistent), „Saison
  auslagern" (mit verifizierter Export-Pflicht).
- Screens Ligen/Mannschaften/Kalender/Statistiken filtern nach gewählter Saison;
  archiviert/ausgelagert → aus Snapshot lesen.

---

## 10. Phasen (inkrementell auslieferbar)

1. **Soft-Archiv-Kern:** Season-Entität + `seasonId`-Backfill + Saison-Umschalter +
   read-only für archivierte Saisons. (Größter Nutzen zuerst.)
2. **Abschluss-Flow:** eingefrorener Snapshot + Export-Bundle (Download).
3. **Neue-Saison-Assistent:** Teams/Ligen klonen, Spielplan-Import, Kalender-Generierung.
4. **Auslagern:** Purge + Re-Import-Skripte + Backup-Retention.
5. *(optional, später)* Grafana/Postgres-Export aus dem Bundle für freie Auswertung.

## 11. Offene Entscheidungen

- **`matches.playerId`** in Phase 1 oder 2 nachziehen? (Empfehlung: so früh wie möglich.)
- Beim Auslagern auch `leagues`/`teams`/`events` purgen oder nur `matches`?
- Snapshot bei archivierter (noch nicht ausgelagerter) Saison neu generierbar lassen?
  (Empfehlung: ja, bis zum Auslagern.)
- Export-Ziel: In-App-Download, S3, Hetzner Storage Box — was steht zur Verfügung?
- Grafana: jetzt mitdenken (Bundle als Feed) oder ganz später?
