# Vereinsmodus: Backend mit PocketBase — Umsetzungsplan

> Lokaler Modus bleibt unverändert (localStorage, offline, kein Backend).
> Dieser Plan betrifft **nur den Vereinsmodus**: geteilte Daten, echte Logins von mehreren Rechnern.

> **Umsetzungs-Hinweis (Stand: implementiert).** Phase 1–3 sind im Code umgesetzt: echte
> PocketBase-Auth, Schreiben/Lesen aller Collections, persönliche Einstellungen (`user_prefs`),
> Vereinsname/Logo (`club_config`) und Realtime-Sync. **Abweichend von Abschnitt 2** wird das
> Datenmodell **denormalisiert** gespeichert: `teams.memberIds/captainId`, `leagues.teams/fixtures`
> und `matches.perPlayer` sind JSON-Felder — keine eigenen Collections `league_teams`/`fixtures`.
> Das maßgebliche, umgesetzte Schema steht in **`pocketbase/SCHEMA.md`**.
> Die normalisierte Variante unten bleibt als ursprüngliche Überlegung erhalten.

## 1. Architektur (Überblick)

```
                    Server (Arcane/Docker oder systemd)
   ┌───────────────────────────────────────────────────────────┐
   │  Caddy (Reverse-Proxy + Let's Encrypt / HTTPS)             │
   │                                                            │
   │   ┌──────────────────┐        ┌──────────────────────┐    │
   │   │ Frontend (statisch)│  →    │ PocketBase (1 Container)│  │
   │   │ Vite-Build         │  API  │ Auth + REST + Admin-UI │  │
   │   │ app.example.com    │       │ db.example.com         │  │
   │   └──────────────────┘        │ SQLite in Volume /pb_data│ │
   │                                └──────────────────────┘    │
   └───────────────────────────────────────────────────────────┘
        ▲                                   ▲
   Browser (Edge/PWA) der Mitglieder, mehrere Geräte
```

- **Eine Codebasis.** Beim Start entscheidet der Modus, welche Datenquelle benutzt wird:
  - `lokal` → localStorage-Adapter (synchron, offline) — wie bisher
  - `verein` → PocketBase-Adapter (asynchron, über HTTPS)
- PocketBase = **ein** Container, deckt **Datenbank (SQLite) + Authentifizierung + Rollen + Admin-Oberfläche** ab.
- Daten liegen im **persistenten Volume** `/pb_data` → überleben Redeploys/Neustarts.

---

## 2. PocketBase: Collections (Datenmodell)

PocketBase hat eine eingebaute Auth-Collection `users`. Jede Collection bekommt automatisch `id`, `created`, `updated`.

### `users` (Auth — entspricht „Benutzer"/Account)
| Feld | Typ | Hinweis |
|---|---|---|
| email | email | Login |
| password | (auth) | von PB verwaltet |
| name | text | Anzeigename |
| first / last | text | |
| role | select | `admin` \| `captain` \| `player` \| `viewer` |
| player | relation → players | Verknüpfung zum Roster-Spieler (optional) |
| position | text | |
| active | bool | |
| avi | number | Avatar-Farbindex |

### `players` (Roster — kann ohne Login existieren)
| Feld | Typ |
|---|---|
| name | text |
| short | text (max 3) |
| avi | number |
| locked | bool (Standard-Spieler schützen) |

### `teams`
| Feld | Typ |
|---|---|
| name | text |
| league | text (Freitext) oder relation → leagues |
| members | relation → players (mehrfach) |
| captain | relation → players (einzeln) |

### `leagues`
| Feld | Typ |
|---|---|
| name | text |
| season | text |

### `league_teams` (normalisiert statt eingebettet)
| Feld | Typ |
|---|---|
| league | relation → leagues |
| name | text |
| own | bool |

### `fixtures` (Spielplan — normalisiert, damit Ergebnisse abfragbar)
| Feld | Typ |
|---|---|
| league | relation → leagues |
| home | relation → league_teams |
| away | relation → league_teams |
| date | date |
| played | bool |
| hs / as | number |

### `events` (Termine)
| Feld | Typ |
|---|---|
| title | text |
| date | date |
| time | text |
| type | select (training, ligaspiel, …) |
| loc | text |
| scope | select (`verein`) — lokal-Events bleiben im localStorage |

### `matches` (gespielte Spiele/Statistik)
| Feld | Typ |
|---|---|
| date | date |
| gameLabel | text |
| startScore, bestOf, bestOfSets | number |
| unit, mode | text |
| winnerName | text |
| scoreLine | text |
| perPlayer | json (Liste der Spieler-Statistiken) |
| createdBy | relation → users |

> `perPlayer` zunächst als JSON (denormalisierte Statistik). Falls später tiefe Auswertungen nötig sind, in eine eigene Collection `match_players` normalisieren.

### `club_config` (geteilte Vereinseinstellungen — ein Datensatz)
| Feld | Typ |
|---|---|
| clubName | text |
| clubLogo | file oder text (Daten-URL) |

### `user_prefs` (persönliche UI-Einstellungen pro Nutzer)
| Feld | Typ |
|---|---|
| user | relation → users (eindeutig) |
| settings | json (Theme, Akzentfarbe, Score-Optionen, fkeys, Shortcuts …) |
| trainingPlays | json (meistgespielte Trainingsspiele) |

> Trennung: **Visuelle/persönliche** Einstellungen pro Nutzer; **Vereinsweite** (clubName/Logo) in `club_config`.

---

## 3. API-Rules (serverseitige Rechte)

Spiegeln die heutige `perm()`-Logik, aber **erzwungen vom Server** (nicht nur UI):

| Collection | list/view | create/update/delete |
|---|---|---|
| players, teams, leagues, league_teams, fixtures, events | `@request.auth.id != ""` (alle angemeldeten) | `@request.auth.role = "admin" \|\| @request.auth.role = "captain"` |
| users | admin (view ggf. self) | `@request.auth.role = "admin"` |
| matches | angemeldet | create: `@request.auth.role != "viewer"`; update/delete: admin oder Ersteller |
| club_config | angemeldet | `@request.auth.role = "admin"` |
| user_prefs | nur Eigentümer: `@request.auth.id = user` | nur Eigentümer |

- `viewer` = überall nur Lesezugriff.
- Diese Regeln machen die Rollen **echt** (heute sind sie kosmetisch).

---

## 4. Frontend-Anpassungen

### 4.1 Datenschicht-Abstraktion (Adapter)
Heute laufen alle Daten zentral über `read`/`write` im Zustand-Store → guter Ankerpunkt.

- Interface `DataProvider` (CRUD je Collection + `loadAll()` + Auth).
- `LocalProvider` → localStorage (synchron, sofort aufgelöst).
- `PocketBaseProvider` → PocketBase JS-SDK (`npm i pocketbase`), asynchron.
- Store-Actions werden **async** (await provider). Lokal löst sofort auf → ein gemeinsamer Codepfad.
- Auswahl beim Start: `appMode === 'verein'` → PocketBaseProvider, sonst LocalProvider.

### 4.2 Authentifizierung (echt)
- Login-Screen (existiert) → `pb.collection('users').authWithPassword(email, pw)`.
- Token-Persistenz über `pb.authStore` (im localStorage des Browsers, automatisch).
- Rolle/Identität aus `pb.authStore.model`; `perm()` liest daraus.
- Logout → `pb.authStore.clear()`.
- Verein bleibt „Login erforderlich" (wie heute `needsLogin`).

### 4.3 Konfiguration
- `VITE_PB_URL` (z. B. `https://db.example.com`) als Build-/Runtime-Env.
- Lade-/Fehlerzustände in den Verein-Screens (Spinner, Retry).
- **Realtime aktiv:** `pb.collection(...).subscribe` → mehrere Geräte sehen Änderungen live (festgelegt).

> Die Screens/UI bleiben weitgehend unverändert; es ändert sich die **Datenbeschaffung** (async) und der **Login**.

---

## 5. Deployment

> **Aktueller Stand (statt dieses ursprünglichen Coolify-Plans):** Homelab läuft über **Arcane**
> (Docker-Compose-Stacks) — siehe [`de/arcane-homelab-anleitung.md`](de/arcane-homelab-anleitung.md);
> die Cloud über **systemd + Caddy** (schlank, ohne Docker) — siehe
> [`de/admin-anleitung-cloud.md`](de/admin-anleitung-cloud.md). Die Skizze unten bleibt als Konzept erhalten.

### 5.1 PocketBase-Service
- Docker-Image (z. B. `ghcr.io/muchobien/pocketbase`) **oder** eigenes Dockerfile mit dem PB-Binary.
- **Persistentes Volume** → Mount `/pb_data` (enthält SQLite-DB + Uploads). **Kritisch**, sonst Datenverlust beim Redeploy.
- Domain z. B. `db.example.com`, HTTPS via Caddy automatisch.
- Erststart: Admin-Konto im PB-Admin-UI (`/_/`) anlegen, dann Collections + Rules importieren (per `pb_migrations` oder UI).

### 5.2 Frontend-Service
- Aus dem Git-Repo bauen (eigenes Dockerfile + statischer Webserver / nginx).
- Build: `npm run build` → `dist/` statisch ausliefern.
- Build-Arg `VITE_PB_URL=https://db.example.com` setzen (Build-Zeit!).
- Domain z. B. `app.example.com`, HTTPS automatisch (für PWA nötig).

### 5.3 CORS / Domains
- PocketBase erlaubt konfigurierbare Origins; Frontend-Domain dort eintragen.
- Alternativ alles unter einer Domain mit Pfad-Routing (z. B. `/api` → PocketBase).

---

## 6. Backups & Betrieb
- **PocketBase** hat eingebaute Backups (Admin-UI), Ziel auch S3/Hetzner Storage Box möglich → automatisieren.
- Zusätzlich **Volume-Snapshots** des `/pb_data` (Arcane/Docker) bzw. Datei-Backup der `pb_data/` (systemd).
- Empfehlung: tägliches automatisches Backup + gelegentlicher Restore-Test.

---

## 7. Datenmigration (bestehende lokale Daten übernehmen)
- Einmal-Tool/Script: nimmt die **Export-JSON** (aus Einstellungen → Daten) und schreibt sie über die PB-API in die Collections.
- Reihenfolge wegen Relationen: players → users → teams → leagues → league_teams → fixtures → events → matches.

---

## 8. Phasenplan & grober Aufwand

| Phase | Inhalt | Aufwand |
|---|---|---|
| 0 | PocketBase deployen, Collections + Rules, Admin-Konto | klein–mittel |
| 1 | `DataProvider`-Abstraktion, PB-SDK, **Lese**-Pfade Verein | mittel |
| 2 | **Schreib**-Pfade + echte Auth + Rollen serverseitig | mittel |
| 3 | Datenimport-Tool, Realtime (optional), Backups, Feinschliff | klein–mittel |

> Lokaler Modus bleibt in allen Phasen voll funktionsfähig und unangetastet.

---

## 9. Festgelegte Entscheidungen (Stand 2026-06-23)
1. **Domains:** getrennte Subdomains — `app.<domain>` (Frontend) + `db.<domain>` (PocketBase). CORS via Origin-Allowlist in PocketBase.
2. **Einstellungen:** clubName/Logo zentral in `club_config` (nur Admin), persönliche UI-Prefs pro Nutzer in `user_prefs`. ✔
3. **Registrierung:** **nur Admin** legt Konten an → Self-Registration in PocketBase deaktiviert; `users`-create-Rule = `@request.auth.role = "admin"`.
4. **Realtime-Sync:** **aktiv** — PocketBase-`subscribe` in den Verein-Screens, damit mehrere Geräte live aktualisiert werden.
5. **Liga-Daten:** **normalisiert** — `leagues` / `league_teams` / `fixtures` als eigene Collections (wie in Abschnitt 2).
