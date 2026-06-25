# PocketBase-Schema (Vereinsmodus)

Diese Collections legst du **einmal** in der PocketBase-Admin-UI an
(`https://db.<domain>/_/` → *Collections* → *New collection*).
Die App spricht genau diese Feldnamen an — bitte exakt so benennen.

> **Modell: denormalisiert.** Mannschafts-Mitglieder, Liga-Tabellen, Spielpläne und
> Spielstatistiken liegen als **JSON-Felder** (nicht als getrennte Relationen-Tabellen).
> Das hält App-Objekt und Datenbank-Record deckungsgleich und den Code einfach.

Jede Collection hat automatisch `id`, `created`, `updated` — die NICHT manuell anlegen.
Die `id` muss das PocketBase-Standardformat behalten (15 Zeichen, a–z/0–9), weil die App
die IDs selbst erzeugt und mitsendet.

---

## Collections

### `players` (Base)
| Feld | Typ |
|---|---|
| name | text |
| short | text (max 3) |
| avi | number |
| locked | bool |
| photo | file (Bild, max 1, Thumbnail 160x160) |

### `teams` (Base)
| Feld | Typ |
|---|---|
| name | text |
| league | text |
| memberIds | json |
| captainId | json |
| viceCaptainIds | json |
| kind | text (`league` Standard \| `cup` = Pokalmannschaft) |

### `leagues` (Base)
| Feld | Typ |
|---|---|
| name | text |
| season | text |
| teams | json |
| fixtures | json |
| kind | text (`league` Standard \| `cup` = Pokal-Wettbewerb) |

### `events` (Base)
| Feld | Typ |
|---|---|
| title | text |
| date | text |
| time | text |
| type | text |
| loc | text |
| scope | text |

### `matches` (Base)
| Feld | Typ |
|---|---|
| date | text |
| startScore | number |
| doubleOut | bool |
| doubleIn | bool |
| unit | text |
| mode | text |
| bestOf | number |
| bestOfSets | number |
| gameLabel | text |
| winnerName | text |
| scoreLine | text |
| perPlayer | json |

### `club_config` (Base) — ein einziger Datensatz
| Feld | Typ |
|---|---|
| clubName | text |
| clubLogo | text (Daten-URL oder Link) |

### `user_prefs` (Base) — persönliche Einstellungen je Nutzer
| Feld | Typ |
|---|---|
| user | relation → users (max 1, eindeutig) |
| settings | json |
| trainingPlays | json |

### `users` (Auth — die eingebaute Collection erweitern)
`email` + `password` sind eingebaut. Zusätzliche Felder hinzufügen:
| Feld | Typ |
|---|---|
| name | text |
| first | text |
| last | text |
| role | select (Werte: `admin`, `captain`, `player`, `viewer`, `board`) |
| playerId | json |
| position | text |
| active | bool |
| avi | number |
| last_login | text |
| isBoard | bool |
| boardNumber | number (onlyInt) |
| photo | file (Bild, max 1, Thumbnail 160x160) |

`board` = Maschinen-Rolle der Board-Rechner: nur spielen (Matches anlegen/lesen), nichts verwalten.
Sie ist über den Hook `pb_hooks/board_role_guard.pb.js` fest an `isBoard` gekoppelt — ein Board-Konto
kann serverseitig nie eine andere Rolle erhalten und `board` nie an ein normales Konto vergeben werden.

**Wichtig:** *Self-Registration deaktivieren* — Konten legt nur der Admin an
(siehe API-Rule unten).

---

## API-Rules (serverseitige Rechte)

Pro Collection unter *API Rules* eintragen. `@request.auth.id != ""` heißt „angemeldet".

| Collection | List / View | Create | Update / Delete |
|---|---|---|---|
| players, teams, leagues, events | `@request.auth.id != ""` | `@request.auth.role = "admin" \|\| @request.auth.role = "captain"` | wie Create |
| matches | `@request.auth.id != ""` | `@request.auth.role != "viewer"` | `@request.auth.role = "admin"` |
| users | `@request.auth.id != ""` | `@request.auth.role = "admin"` | `@request.auth.role = "admin"` |
| club_config | `@request.auth.id != ""` | `@request.auth.role = "admin"` | `@request.auth.role = "admin"` |
| user_prefs | `@request.auth.id = user` | `@request.auth.id = user` | `@request.auth.id = user` |

Damit werden die Rollen **echt** (vom Server erzwungen, nicht nur in der Oberfläche).

---

## Erster Admin

Nach dem Anlegen der Collections in `users` einen Datensatz erstellen:
`email`, `password`, `role = admin`, `active = true`, `name` = dein Name.
Mit diesem Konto meldest du dich in der App an. Weitere Mitglieder legst du danach
bequem **in der App** an (Benutzer → Neuer Benutzer, dort gibst du auch das Startpasswort ein).

> Tipp: `VITE_PB_URL` im Frontend muss auf `https://db.<domain>` zeigen — sonst startet
> die App im lokalen Modus statt gegen dieses Backend.
