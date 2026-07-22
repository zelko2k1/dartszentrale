# PocketBase-Schema (Vereinsmodus) — Lese-Referenz

> **Du musst hier nichts von Hand anlegen.** Schema, Felder und API-Rules entstehen beim Start von
> PocketBase **automatisch** aus den versionierten **Migrations** (`pocketbase/pb_migrations/`).
> Diese Seite ist nur die **lesbare Übersicht** dazu — maßgeblich für die Laufzeit sind die Migrations.

> **Modell: denormalisiert.** Mannschafts-Mitglieder, Liga-Tabellen, Spielpläne und Spielstatistiken
> liegen als **JSON-Felder** (nicht als getrennte Relationen-Tabellen). Jede Collection hat automatisch
> `id`, `created`, `updated`. Die `id` hat das PB-Standardformat (15 Zeichen a–z/0–9), die App erzeugt
> sie selbst. Viele Inhalts-Collections tragen ein `seasonId` (→ Soft-Archiv je Saison).

---

## Collections

### `players` (Base)
`name` · `short` (text, max 3) · `avi` (number) · `locked` (bool) · `photo` (file, 160×160-Thumb) ·
`trainingBests` (json: Map `modeId` → `{value, date}`, persönliche Trainings-Bestwerte, board-übergreifend)

### `seasons` (Base) — Saison-Klammer
`name` · `status` (`active` | `archived`) · `startDate` · `endDate` · `offloaded` (bool)

### `season_snapshots` (Base) — eingefrorener Abschluss-Stand einer Saison
`seasonId` · `seasonName` · `standings` (json) · `playerStats` (json) · `teamRosters` (json) · `meta` (json)

### `teams` (Base)
`name` · `league` · `memberIds` (json) · `captainId` (json) · `viceCaptainIds` (json) ·
`kind` (`league` | `cup`) · `seasonId`

### `leagues` (Base)
`name` · `season` · `seasonId` · `teams` (json) · `fixtures` (json) · `kind` (`league` | `cup`) ·
`singlesCount` (number) · `doublesCount` (number) · `format` (json) — Match-Format der Liga

### `events` (Base) — Kalender/Termine
`title` · `date` · `time` · `type` · `loc` · `scope` · `seasonId` · `fixtureId` (Verknüpfung zu einer Begegnung)

### `matches` (Base) — gezählte Spiele
`date` · `startScore` (number) · `doubleOut` (bool) · `doubleIn` (bool) · `unit` · `mode` ·
`bestOf` (number) · `bestOfSets` (number) · `gameLabel` · `winnerName` · `scoreLine` ·
`perPlayer` (json) · `seasonId` · **`createdBy`** (Ersteller; serverseitige Owner-Bindung)

### `club_config` (Base) — ein einziger Datensatz
`clubName` · `clubLogo` (Daten-URL oder Link)

### `user_prefs` (Base) — persönliche Einstellungen je Nutzer
`user` (relation → users, max 1, eindeutig) · `settings` (json) · `trainingPlays` (json)

### `user_mfa` (Base) — 2FA/TOTP, **abgeschottet**
`user` (relation → users, max 1, eindeutig, cascadeDelete) · `secret` (text, hidden) · `enabled` (bool) ·
`pending` (bool) · `backupCodes` (json, hidden — gehashte Einmal-Codes) · `failedAttempts` (number) ·
`lockedUntil` (text) · `confirmedAt` (text). **Alle API-Rules = `null`** → nur Superuser bzw. `pb_hooks`
lesen/schreiben; das TOTP-Secret verlässt nie über die REST-API den Server (Plan `docs/plan-2fa.md` §3).

### `users` (Auth — eingebaute Collection, erweitert)
`email` + `password` sind eingebaut. Zusätzlich: `name` · `first` · `last` ·
`role` (select: `admin`, `captain`, `player`, `viewer`, `board`) · `playerId` (json) · `position` ·
`active` (bool) · `avi` (number) · `last_login` · `isBoard` (bool) · `boardNumber` (number, onlyInt) ·
`photo` (file). **Auth-Rule `active = true`** → deaktivierte Konten können sich nicht anmelden.
**Manage-Rule `role = "admin"`** → App-Admins dürfen E-Mail/Passwort/verified direkt ändern (ohne
diese Rule blockt PocketBase E-Mail-Änderungen für Nicht-Superuser).

> `board` = Maschinen-Rolle der Board-Rechner (nur spielen). Über `pb_hooks/board_role_guard.pb.js` fest
> an `isBoard` gekoppelt — ein Board-Konto kann serverseitig nie eine andere Rolle erhalten, und `board`
> nie an ein normales Konto vergeben werden. **Self-Registration ist aus** (users-create = admin).

---

## API-Rules (serverseitige Rechte)

`authed` = `@request.auth.id != ""` (angemeldet) · `admin` = `@request.auth.role = "admin"` ·
`cap` = `@request.auth.role = "captain"`.

| Collection | List/View | Create | Update | Delete |
|---|---|---|---|---|
| `players` | authed | admin \|\| cap | admin \|\| cap \|\| **authed, wenn NUR `trainingBests` im Body** | admin \|\| cap |
| `events` | authed | admin \|\| cap | admin \|\| cap | admin \|\| cap |
| `teams` | authed | admin \|\| cap | **admin \|\| (cap && `captainId = auth.playerId`)** | **admin** |
| `leagues` | authed | **admin** | admin \|\| cap | **admin** |
| `seasons` | authed | **admin** | admin \|\| cap | **admin** |
| `season_snapshots` | authed | admin | admin | admin |
| `matches` | authed | **`createdBy = @request.auth.id`** (eigener Stempel) | **admin \|\| `createdBy = @request.auth.id`** | admin |
| `users` | authed | admin | admin | admin |
| `club_config` | authed | admin | admin | admin |
| `user_prefs` | `auth.id = user` | `auth.id = user` | `auth.id = user` | `auth.id = user` |
| `user_mfa` | **`null` (nur Superuser/Hooks)** | `null` | `null` | `null` |

**Härtung (Sicherheits-Audit):**
- **#4 matches:** anlegen nur mit `createdBy == eigene id` (keine fremden/forgierten Ergebnisse); ändern
  nur Admin oder Ersteller. Feld `createdBy` ist Pflicht beim Schreiben.
- **#6:** `teams` löschen sowie `leagues`/`seasons` anlegen+löschen → **nur Admin** (Kapitän kann keine
  fremden Strukturen anlegen/löschen).
- **#6 (Rest):** `teams` **ändern** → Admin oder der Kapitän **genau seiner** Mannschaft
  (`captainId = @request.auth.playerId`). Kein Roster-Editing fremder Teams mehr. (Vize-Kapitäne
  haben i. d. R. Rolle `player` und sind bewusst nicht eingeschlossen.)

Damit werden die Rollen **echt** (vom Server erzwungen, nicht nur in der Oberfläche).

---

## Erster Admin

Migrations legen **kein** Konto an. Den ersten App-Admin selbst anlegen: in `…/_/` → Collection `users`
→ neuer Record, `role = admin`, `active = true`, E-Mail + **starkes** Passwort. Weitere Mitglieder
danach bequem **in der App** (Benutzer → Neuer Benutzer). Keine Demo-/Seed-Skripte gegen Produktiv-DBs.

> `VITE_PB_URL` im Frontend muss auf `https://db.<domain>` zeigen. Beim **ersten Start** fragt die App
> nach dem Modus → **„Vereinsmodus"** wählen.
