# Plan: Remote & Live — Handy als Eingabe + Live-Mitverfolgen

> Status: **Umgesetzt** — Phasen 1–5 fertig (2026-07-19): Backend/Provider, Host veröffentlicht,
> Remote-Handy, login-freier Zuschauer-TV, Härtung (Heartbeat/Cleanup, Security-Audit, Doku).
> Kern steht & verifiziert; Kür offen (Playwright-Smoke, PIN, In-App-Live für Mitglieder).
> Gilt für **`dartszentrale`** (Liga/Verein).
> Zwei Bausteine in einem: (1) **Remote** — das Smartphone als vollwertige Fernbedienung für ein
> laufendes Spiel (Notfall bei defekter Maus/Tastatur *und* als bequeme Dauer-Option); (2) **Live** —
> beliebig viele Geräte verfolgen ein laufendes Spiel read-only mit.
> Dieses Dokument ist die Umsetzungs-/Design-Referenz; wird beim Abarbeiten mit ✅-Markierungen gepflegt.

---

## 1. Ziel & Entscheidungen (festgezurrt)

- **Remote (ein Schreiber):** Genau *ein* Handy übernimmt Score-Eingabe **und** Navigation eines
  laufenden Matches (Spiel starten/beenden, Setup, Starter wählen, Korrektur/Undo). Klassischer
  „Anschreiber", nur auf dem Handy statt am PC.
- **Live (viele Zuschauer):** Zusätzlich dürfen beliebig viele angemeldete Vereinsgeräte demselben
  Spiel read-only zusehen (Score, Reihenfolge, Checkout, Wurfverlauf) — ohne Eingriffsmöglichkeit.
- **PC bleibt Autorität und Anzeige.** Der PC (bzw. das Board/Kiosk) rechnet und rendert weiter mit der
  **kompletten bestehenden Spiellogik**. Das Handy schickt nur *Absichten* (Befehle); der PC spielt sie
  über die vorhandenen Store-Aktionen ab. → Keine doppelte Spiellogik, kein Konfliktrisiko.
- **Kanal = PocketBase.** Nutzt das bereits vorhandene Realtime-Gerüst (`provider.subscribe`,
  `pocketbaseProvider.ts:273`). **Nur Vereins-/Server-Modus.** Im reinen Lokalmodus (kein Server) gibt
  es keinen gemeinsamen Kanal → Feature dort **nicht verfügbar** (klar kommuniziert, wie bei 2FA/nuLiga).
- **Auto-Veröffentlichung — nur Board-/Kiosk-Modus** _(entschieden 2026-07-19)_: Sobald der PC im
  **Board-/Kiosk-Modus** läuft, veröffentlicht der Host die Session **automatisch** — **kein PC-Klick**
  nötig, um die Fernbedienung freizuschalten. Fällt Maus/Tastatur aus, klinkt sich das Handy trotzdem ein.
  **Bewusster Trade-off:** Ein *normales* Counter-Spiel am PC (nicht im Kiosk) wird **nicht**
  veröffentlicht → dort ist keine Remote/Zuschauen-Funktion aktiv. Empfehlung fürs Notfall-Szenario:
  Matches im Board-/Kiosk-Modus starten (Autostart-Skripte gibt es). Optionaler späterer Ausweg: manueller
  „Remote freischalten"-Schalter auch für Nicht-Kiosk-Spiele (nur sinnvoll, solange *ein* Eingabegerät noch
  teilweise geht).
- **Kopplung per QR + Kurzcode** (Lib `lib/qrcode.ts` existiert). Board/Counter zeigt QR → Handy scannt,
  meldet sich am Verein an, wird der aktive Remote.
- **Einschränkung Feature-Toggle:** In den Einstellungen abschaltbar (`remoteEnabled`, default an im
  Vereinsmodus), z. B. für Vereine, die keine Fernsteuerung wollen.

### Nicht-Ziele (bewusst später/ausgeklammert)
- **Mehrere Schreiber gleichzeitig** (jeder Spieler tippt seine Würfe) — später denkbar, jetzt nicht.
- **Autoscore/Kamera** — separates Thema (`plan-autodarts-autoscore.md`).
- **Echter Video-/Medienstream** (Board abfilmen/encodieren, HLS/WebRTC/DLNA) — bewusst NICHT: bei
  Zahlen/Text ist Daten-Push + Browser überlegen (scharf, latenzarm, winzig, leicht absicherbar). Ein
  echter Stream lohnt nur für ein Kamerabild der Matches → eigenes, größeres Feature.
- **Bedienung der Verwaltung** (Liga/Spielerpflege) vom Handy — nur das laufende Match.

### Login-freies Zuschauen — sicher, verein-/abendweit _(entschieden 2026-07-19)_
Szenario: **Zuschauer-TV im Nebenraum** (gehört NICHT zu einem einzelnen Board, sondern zum Abend).
- **Ein dauerhafter Zuschauer-Link** (verein-/abendweit) → TV öffnet ihn EINMAL und sieht automatisch,
  was gerade gespielt wird: 1 Board aktiv → Vollbild; mehrere → Kachel-Übersicht; keins → „Warten…".
- **Token-Link**: unrat­bar, **nicht auflistbar** (kein Durchprobieren). Öffentlicher Kanal enthält NUR
  Boardname + gerenderter Spielstand — **nichts Sensibles**; der Kopplungs-Code bleibt strikt privat.
- **Admin-Schalter „Öffentliches Zuschauen"** — **serverseitig erzwungen** (echter Kill-Switch, wirkt
  sofort auch auf bereits verteilte Links), **Default AUS im Internet-Betrieb** (im LAN vorbelegbar an).
- **Link rotieren** (alten entwerten), **HTTPS-Pflicht** (Caddy), optional **PIN** vor der Watch-Seite.
- Angemeldete Mitglieder schauen weiterhin regulär in der App zu (Login-Pfad bleibt).

---

## 2. Architektur

```
   [ Handy = Remote ]                [ PocketBase ]              [ PC = Host + Anzeige ]
   ─ Keypad + Navigation             live_sessions  ◀──schreibt── ─ volle Spiellogik (unverändert)
   ─ rendert View-State  ──Befehl──▶ live_commands  ──Realtime──▶ ─ spielt Befehle in Reihenfolge ab
   ─ zeigt Live-Stand    ◀──Realtime── (View-State) ◀──schreibt── ─ Board / großer Screen
                                             ▲
                          Realtime (nur lesen) │
                                    [ n × Zuschauer-Geräte ] read-only Board
```

**Rollen einer Session:**
- **Host** = das Gerät, das das Spiel tatsächlich führt (PC/Board). Einziger Schreiber des *View-State*,
  einziger Konsument der Befehle. Autorität.
- **Remote** = das eine gekoppelte Handy. Einziger, der *Befehle* erzeugen darf.
- **Zuschauer** = beliebige angemeldete Geräte, die den View-State nur lesen.

**Warum Command-Relay statt geteiltem State:** Das Notfall-Szenario ist „Eingabegeräte defekt", **nicht**
„PC defekt" — der PC läuft weiter und behält seine gesamte, getestete Logik (`useStore.ts` `apply`/
`pressEnter`/`quick`/`undo`, Berechnung in `counter.ts`). Das Handy bleibt ein dünnes Terminal → minimale
neue Angriffsfläche, keine Logik-Duplikation, deterministische Reihenfolge über `seq`.

---

## 3. Datenmodell

Zwei neue Collections (Migration + Spiegelung in `provision.mjs`, Muster wie
`pb_migrations/1782300006_events_seriesid.js`).

### `live_sessions` — der aktuelle Spielzustand je Board (vom Host geschrieben)

| Feld | Typ | Zweck |
|---|---|---|
| `host` | relation→users | Gerät/Konto, das das Spiel führt (Autorität, einziger Schreiber) |
| `boardName` | text | Anzeigename (z. B. „Board 1"), für die Zuschauer-Liste |
| `code` | text | Kurzer Kopplungscode (z. B. 6 Zeichen), im QR enthalten |
| `remoteUser` | relation→users (opt.) | aktuell gekoppeltes Handy (der eine erlaubte Schreiber) |
| `status` | select `idle`\|`active`\|`ended` | Lebenszyklus |
| `state` | json | **kompakter View-State** (siehe §5) — Quelle für Remote *und* Zuschauer |
| `lastAppliedSeq` | number | zuletzt verarbeiteter Befehl (Ack + Idempotenz) |
| `heartbeat` | autodate/text | Host-Lebenszeichen für Stale-Erkennung/Cleanup |
| `updated` | autodate | Realtime-Trigger |

### `live_commands` — Befehls-Postfach (vom Remote erzeugt, vom Host konsumiert)

| Feld | Typ | Zweck |
|---|---|---|
| `session` | relation→live_sessions | Zugehörige Session |
| `seq` | number | monoton steigende Reihenfolge (Client vergibt, Host prüft) |
| `type` | text | Befehlstyp (siehe §4) |
| `payload` | json | Parameter (z. B. `{v:100}`, `{rem:32,darts:2}`) |
| `createdBy` | relation→users | Absender (muss = `session.remoteUser`) |
| `created` | autodate | Sortierschlüssel |

**API-Regeln (zentral für Sicherheit):**
- `live_sessions`: **list/view** = `@request.auth.id != ""` (jedes angemeldete Mitglied darf zuschauen).
  **create/update/delete** = `@request.auth.id = host.id` (nur der Host schreibt seine eigene Session).
- `live_commands`: **create** = `@request.auth.id != "" && session.remoteUser = @request.auth.id`
  (nur der aktuell gekoppelte Remote darf Befehle senden). **list/view/delete** =
  `@request.auth.id = session.host.id` (nur der Host liest/räumt ab).
- Das **Setzen von `remoteUser`** (Kopplung) läuft **nicht** über die REST-API, sondern über einen Hook
  (Code-Prüfung, §6) — so bleibt die Update-Regel „nur Host" strikt.

### Öffentlicher Zuschauer-Kanal (login-frei, verein-/abendweit) — _umgesetzt_

Umgesetzt **ohne** eigene Board-Spiegel-Collection: der öffentliche Endpunkt liest die aktiven
`live_sessions` serverseitig und gibt **nur** `boardName` + `state` (§5) zurück — die sensiblen Spalten
`code`/`host`/`remoteUser` werden nie angefasst. Kein Mirror nötig (Phase-2-Punkt entfällt).

- **`watch_config`** (abgeschottete Collection, Rules alle null → nur Superuser/Hooks): `watchEnabled`
  (bool, Default **false**), `watchToken` (unrat­barer Zufallswert, rotierbar). Bewusst **nicht** in der
  öffentlich lesbaren `club_config` (dort wäre der Token world-readable).
- **Hook `pb_hooks/watch_hooks.pb.js`**: `GET/POST /api/live/watch/config` (nur Admin, verwaltet
  enabled/rotate), `GET /api/live/public?token=…` (öffentlich, ohne Login): validiert `watchEnabled`
  **und** Token → liefert aktive Boards sanitized.
- **Zugriffsgrenze serverseitig erzwungen:** ohne `watchEnabled=true` + korrekten Token → 403 (auch für
  bereits verteilte Links → echter Kill-Switch); **nicht auflistbar** ohne Token; Token rotierbar.
- Abruf per **Polling** (~1,5 s) statt Realtime — für ein Scoreboard ausreichend und für anonyme Clients
  robust (keine Realtime-Auth-Komplexität). Optional PIN: später.

---

## 4. Befehlsprotokoll

Jeder Befehl bildet **1:1 eine bestehende Store-Aktion** ab, die der Host abspielt. Kein neuer Spielcode.

| `type` | Payload | Host ruft auf (`useStore.ts`) | Entspricht am PC |
|---|---|---|---|
| `digit` | `{d:"0".."9"}` | `pressDigit(d)` | Zifferntaste |
| `enter` | — | `pressEnter()` | Enter |
| `del` | — | `pressDel()` | Backspace |
| `clear` | — | `pressClear()` | C |
| `quick` | `{v}` | `quick(v)` | F1–F8 / Quick-Chip |
| `restOpen` | — | `openRestEntry()` | F9 |
| `restSubmit` | `{…}` | `submitRestEntry(…)` | F9-Dialog |
| `checkout` | `{rem,darts}` | `apply(rem,darts)` | F10–F12 |
| `undo` | — | `undo()` | Korrektur |
| `starter` | `{idx}` / `{mode:"bull"\|"draw"}` | Starterwahl / `b` / `z` | „Wer beginnt" |
| `nav` | `{to:"setup"\|"counter"\|…}` | `go(to)` | Navigation |
| `newGame` | `{setup…}` | Setup übernehmen + Spiel starten | Neues Spiel |
| `winnerClose` | — | Sieg-Overlay schließen / weiter | Overlay bestätigen |

**Ablauf pro Befehl (Host):** Realtime-`create`-Event auf `live_commands` → nach `seq` sortiert
abarbeiten → `seq ≤ lastAppliedSeq` ignorieren (Idempotenz) → Store-Aktion ausführen → `state` +
`lastAppliedSeq` in `live_sessions` schreiben → Befehl löschen. Der Remote sieht am steigenden
`lastAppliedSeq`, dass sein Befehl angekommen ist (sonst „verbindet…"/Retry).

---

## 5. View-State (`live_sessions.state`)

Kompakter, gerenderter Stand — die Ausgaben der Selektoren aus `store/counter.ts`, damit Remote und
Zuschauer **ohne** eigene Spiellogik rendern können:

```jsonc
{
  "phase": "whoBegins" | "playing" | "bust" | "won",
  "format": { "startScore": 501, "legs": 3, "sets": 1, "doubleOut": true },
  "players": [{ "name": "…", "avatar": "…", "score": 148, "legs": 1, "sets": 0 }],
  "currentIdx": 0,
  "input": "60",                 // aktueller Tipp-Puffer (Live-Feedback aufs Handy)
  "checkout": ["T20","T20","D24"],
  "lastThrow": { "player": 1, "value": 140 },
  "winner": null                 // bei phase="won": Spielername
}
```

- Der Host schreibt `state` **debounced** (z. B. 100–150 ms) nach jeder relevanten Zustandsänderung —
  analog zum bestehenden `persistLive()` (`useStore.ts:2447`), nur zusätzlich in die Session.
- **Zuschauer** rendern daraus ein read-only Board (Wiederverwendung `components/BoardPanel`/`BoardScale`).
- **Remote** rendert daraus die Score-/Checkout-Anzeige und darüber das schon existierende
  Handy-Keypad-Layout (`PhoneCounter`, `Counter.tsx:520`) — nur dass Tasten Befehle senden statt lokal
  zu mutieren.

---

## 6. Kopplung & Sicherheit

**Kopplungs-Flow:**
1. Host läuft, Session ist `active`, hat `code`. Board/Counter zeigt **QR** mit Deep-Link
   `…/#/remote/<sessionId>?code=<code>` (QR via `lib/qrcode.ts`).
2. Handy scannt → App öffnet im **Remote-Modus** → Vereins-Login (falls nicht angemeldet).
3. Handy ruft Hook `POST /api/live/claim {sessionId, code}` → Hook prüft Code, setzt `remoteUser`
   (nur wenn frei **oder** ausdrückliche Übernahme) → ab jetzt darf genau dieses Konto Befehle senden.
4. `POST /api/live/release` (oder Timeout/Heartbeat-Verlust) gibt den Remote-Platz wieder frei.

**Hook `pb_hooks/live_hooks.pb.js`** (Muster wie `set_password.pb.js`): Endpunkte `claim`, `release`;
laufen im Superuser-Kontext, damit die strikte „nur Host"-Update-Regel bestehen bleibt.

**Ein-Schreiber-Garantie & Übernahme** _(entschieden 2026-07-19)_: `remoteUser` ist einwertig; die
`create`-Regel von `live_commands` bindet an genau dieses Konto. Ein zweites Handy kann nicht still kapern:
`claim` bei belegtem `remoteUser` erzeugt eine **Übernahme-Anfrage**, die das **aktuell gekoppelte Handy
bestätigen** muss (der Host zeigt sie im View-State an, das alte Handy bestätigt/lehnt ab). Ausnahme: gilt
der alte Remote per Heartbeat als offline, kann der Host die Übernahme direkt freigeben (kein hängendes
Board). Umsetzung im `claim`-Hook + kleiner Bestätigungs-State.

**Sicherheitspunkte für die Umsetzung** (Ergänzung zu `docs/security-audit.md`):
- Kein anonymes Zuschauen (mind. angemeldetes Mitglied). Board-/Kiosk-Konten dürfen Host sein.
- Code ist kurzlebig (an Session gebunden, bei `ended` wertlos); Rate-Limit auf `claim`.
- Befehle sind reine Absichten gegen **validierende** Store-Aktionen (0–180-Prüfung, Bust/Checkout-Logik
  bleiben serverseitig … pardon, host-seitig) — ein manipulierter Befehl kann keinen ungültigen Score
  erzwingen, nur einen gültigen Tastendruck simulieren.
- Aufräumen: `ended`/verwaiste Sessions + zugehörige `live_commands` per Heartbeat-TTL entfernen.

---

## 7. Deep-Linking (nötige Grundlagen-Änderung)

Die App hat **kein** React-Router — Navigation ist ein State-Enum (`screen`, `useStore.ts:184`) ohne
URL-Routing. Für QR-Aufrufe brauchen Remote/Zuschauer aber einen **per URL erreichbaren Einstieg**:

- Minimaler Hash-Parser in `main.tsx`/`App.tsx`: erkennt `#/remote/<id>` und `#/watch/<id>` **vor** dem
  normalen Shell-Rendering und startet direkt in den Remote-/Zuschauer-Modus.
- Kein vollwertiges Router-Framework — nur dieser eine Einstiegspunkt (hält den Eingriff klein).
- PWA: sicherstellen, dass der Service Worker Deep-Links korrekt an die App durchreicht.

---

## 8. Provider-Erweiterung (`data/provider.ts`)

Additiv zum `DataProvider`-Interface (Lokal: no-op/`unsupported`, wie bei 2FA/nuLiga):

| Methode | Rolle | Tut |
|---|---|---|
| `livePublish(state)` | Host | Session anlegen/aktualisieren (View-State + Heartbeat) |
| `liveEnd()` | Host | Session auf `ended` |
| `liveConsume(cb)` | Host | Realtime-Abo auf `live_commands` der eigenen Session |
| `liveAck(seq,state)` | Host | `lastAppliedSeq` + `state` schreiben |
| `liveClaim(id,code)` | Remote | Hook `/api/live/claim` |
| `liveRelease()` | Remote | Hook `/api/live/release` |
| `liveSend(cmd)` | Remote | `live_commands`-Record erzeugen (mit `seq`) |
| `liveWatch(id,cb)` | Remote+Zuschauer | Realtime-Abo auf eine `live_sessions` |
| `liveList(cb)` | Zuschauer | Abo auf aktive Sessions (für die Auswahl-Liste) |

---

## 9. Phasen

**Phase 1 — Fundament (Backend/Provider)** ✅ _umgesetzt & E2E-verifiziert (2026-07-19)_
- [x] Migration `pb_migrations/1784300000_live_collections.js` (`live_sessions` + `live_commands` inkl.
      API-Regeln, Index); in `provision.mjs` gespiegelt (Abschnitt 3.6).
- [x] Hook `pb_hooks/live_hooks.pb.js`: `claim` / `claim/approve` / `claim/deny` / `release` +
      `onRecordCreateRequest`-Guard (Ein-Schreiber-Garantie serverseitig erzwungen).
- [x] `DataProvider`-Methoden (§8) in Interface + `pocketbaseProvider.ts` + `localProvider.ts` (no-op,
      `liveSupported=false`).
- [x] Deep-Link-Einstieg `#/remote/<id>` & `#/watch/<id>` (`lib/deepLink.ts`, Stub `screens/LiveEntry.tsx`,
      Zweig in `App.tsx`).
- **Verifiziert:** `tsc`/Build grün, 190 Tests grün; E2E gegen echte PocketBase-Instanz (17 Checks:
      Session-Anlage nur als eigener Host, Befehl vor Kopplung blockiert, Code-Prüfung, Ein-Schreiber-
      Garantie, Host-only-Read der Befehle, Übernahme-Flow pending→approve→Transfer, Alt-Remote gesperrt).

**Phase 2 — Host veröffentlicht (PC-Seite)** ✅ _umgesetzt (2026-07-19)_
- [x] Auto-Publish nur im Board-/Kiosk-Modus: `useLiveHost()` (in `App.tsx` gemountet) erkennt
      „Vereinsmodus + Board-Konto + `remoteEnabled`" → `livePublish` mit Kopplungscode, `state` debounced
      (150 ms) via `useStore.subscribe`. Session endet beim Verlassen/Logout.
- [x] View-Projektion `projectLiveState` (`lib/liveProjection.ts`, Node-testbar) — baut `LiveViewState`
      rein aus den `counter.ts`-Funktionen; liefert später auch die öffentliche Payload (Phase 4).
- [x] Befehle konsumieren: `liveConsume` → `applyRemoteCommand` spielt sie über die bestehenden
      Store-Aktionen ab (seq-Guard, idempotent) → `liveAck` + Befehl löschen.
- [x] QR + Kurzcode am Board/Counter (`components/LivePairBadge.tsx`, QR via `lib/qrcode.ts`) +
      `remoteEnabled`-Toggle in den Einstellungen (Board-Rubrik, i18n de/en).
- **Verifiziert:** `tsc`/Build/ESLint grün, **196 Tests** (6 neue Projektionstests: idle/whoBegins/
      playing/checkout/won/input). Transport bereits in Phase-1-E2E belegt.
- **Offen (bewusst → Phase 3):** kompletter Browser-E2E des Host↔Remote-Loops (Board veröffentlicht →
      Handy sendet Befehl → Host spielt ab → Stand aktualisiert) — sinnvoll erst, wenn die Remote-UI
      (Phase 3) den Loop real treibt. `mirror in öffentlichen Kanal` folgt mit Phase 4.

**Phase 3 — Remote (Handy-Schreiber)** ✅ _umgesetzt (2026-07-19)_
- [x] Remote-Screen `screens/RemoteConsole.tsx`: rendert rein aus `session.state`, jede Taste →
      `liveSend(type,payload)` (Ziffernblock, Enter/Del/Clear, Quick-Scores). Eigene UI statt direkter
      `PhoneCounter`-Wiederverwendung (das ist store-gebunden), im gleichen Handy-Layout.
- [x] Kopplung: `liveClaim` (Code aus QR-Deep-Link), Übernahme-Anfrage/-Bestätigung im UI, Verbindungs-/
      Ack-Anzeige („verbunden"/„sendet…" via `lastAppliedSeq` vs. gesendeter `seq`). `liveRelease` beim Verlassen.
- [x] Navigation/Phasen: whoBegins (Starter/Bull-Off/Losen), won (Revanche/Neues Spiel/Dashboard),
      idle (Neues Spiel), playing (Undo/Abbruch/Neu). `LiveEntry` ist jetzt Router (remote→Konsole,
      watch→schlanke Read-only-Ansicht als Phase-4-Vorstufe).
- **Verifiziert:** `tsc`/Build/ESLint grün (0 Errors). **202 Tests**: +6 in-process Befehls-Loop-Tests
      (`applyRemoteCommand` mutiert den ECHTEN Store: quick/digit+enter/del+clear/undo/starter/unbekannt,
      node + localStorage-Shim, keine neue Dependency). Damit ist der komplette Loop logisch belegt:
      Senden (Transport, Phase-1-E2E) → `liveConsume` → `applyRemoteCommand`→Store → `projectLiveState` →
      `liveAck` zurück.
- **Offen (bewusst):** rein visueller Browser-Smoke (Playwright) der Remote-/Watch-Screens — optionaler
      Akzeptanztest; die Logik ist durch die Testkette abgedeckt.

**Phase 4 — Live-Mitverfolgen (Zuschauer, read-only)** ✅ _umgesetzt & E2E-verifiziert (2026-07-19)_
- [x] **Login-freier Zuschauer-TV** `#/watch/<watchToken>` (`screens/LiveEntry.tsx` → `WatchView`): 1 Board
      → Vollbild, mehrere → responsive Kachel-Übersicht, keins → „Warten…". Polling (~1,5 s) auf
      `watchPublic(token)`. Rendert VOR den Mode-/Login-Gates (Routing-Zweig in `App.tsx`).
- [x] Serverseitige Absicherung: `watch_config` (Migration `1784300001` + `provision.mjs` §3.7) +
      `pb_hooks/watch_hooks.pb.js`; Kill-Switch `watchEnabled` (Default AUS), Token-Rotation. PIN: später.
- [x] Admin-UI `components/WatchTvPanel.tsx` (Board-Rubrik der Einstellungen, admin-only): Schalter,
      Watch-Link + QR, „neu generieren", „Link kopieren". Provider-Methoden `watchGetConfig/SetEnabled/
      Rotate/Public` (PB + Local-no-op).
- [ ] _Optional/später:_ „Live"-Einstieg für angemeldete Mitglieder in der App (Auswahl aktiver Sessions
      via `liveListActive`) — der login-freie TV (Kernanforderung) steht; dieser In-App-Weg ist Kür.
- **Verifiziert:** `tsc`/Build/ESLint grün, 202 Tests. **15 Watch-E2E-Checks** gegen echtes PocketBase:
      Kill-Switch (Kanal AUS blockt auch mit gültigem Token), Nicht-Admin↛Konfig, **login-frei** funktioniert,
      **keine sensiblen Felder** im Payload, falscher Token→403, Rotation entwertet alte Links.

**Phase 5 — Robustheit, Sicherheit, Politur** ✅ _umgesetzt (2026-07-19)_
- [x] **Heartbeat** (Host erneuert alle 30 s, `useLiveHost`) + **Cron-Cleanup** `live_cleanup`
      (`live_hooks.pb.js`, alle 2 Min): entfernt `ended` + veraltete `active`-Sessions (heartbeat > 2 Min alt);
      `live_commands` cascaden mit. Übernahme-Handling steckt bereits in Phase 3.
- [x] Ein-Schreiber-Garantie & Board-Host final geprüft (E2E: Board-Konto hostet; Guard blockt sogar
      Superuser-Forgery); **Eintrag in `security-audit.md`** (unter „✅ Verifiziert sicher").
- [x] Doku: `manual.md` (Fernbedienung + Zuschauer-TV), `CHANGELOG.md`. QR als data-URI im `<img>`
      (kein HTML-Injection-Sink → Audit-Invariante gewahrt). i18n: `remoteEnabled`-Toggle de/en; die neuen
      Live-Screens sind bewusst deutschsprachig inline (spätere i18n = Kür).
- [x] **Voller Browser-Smoke (Playwright/Chromium, 2026-07-19):** App aus PocketBase ausgeliefert
      (same-origin), echte Konten. **Kompletter Loop im echten Browser bestätigt:** Board loggt ein →
      Spiel gestartet (whoBegins) → Handy koppelt (eigener Kontext, Login) → Starter gewählt → **180 getippt
      → Board wendet ihn an (Alice 501→321, Aufschrieb/Average korrekt, Zug an Bob)** → **login-freier TV**
      zeigt den Live-Stand. Screenshots vorhanden. Dabei **zwei echte Bugs gefunden & gefixt:**
      (a) Watch-Ansicht nutzt jetzt modus-unabhängig einen Server-Provider (frischer TV-Browser ohne
      „Vereinsmodus"-Wahl kam sonst nicht an den Server); (b) Einzel-Board-TV-Layout füllt die Breite
      (war links). Nebenbei bestätigt: verwaiste Session (Browser hart geschlossen) → Cleanup-Bedarf real.
- [x] **Nachschliff (2026-07-19, nach echtem Handy-Test):** manuelle **Code-Eingabe** am Handy
      (`#/remote` ohne ID → Code tippen; Server findet die Session per Code, `/api/live/claim` akzeptiert
      code-only, `liveClaimByCode`). Koppel-UI (QR + Code) vom **überlappenden Floating-Badge** in die
      **Einstellungen** verlegt (`components/BoardPairPanel.tsx`, nur im **Kiosk** sichtbar). Beides im
      echten Browser verifiziert (Handy tippt Code → verbunden → 180 → Board rechnet).
- [ ] _Optional/offen:_ PIN vor der Watch-Seite; In-App-„Live"-Einstieg für Mitglieder. Kernfeature steht.

---

## 10. Entscheidungen & offene technische Punkte

**Festgezurrt (2026-07-19):**
1. **Auto-Publish:** ✅ **nur Board-/Kiosk-Modus** (§1, inkl. Trade-off für Nicht-Kiosk-Spiele).
2. **Mehrere Boards:** ✅ **Auswahlliste nach `boardName`** — mehrere parallele Sessions werden unterstützt.
3. **Übernahme durch zweites Handy:** ✅ **Bestätigung am alten Handy** (Ausnahme: alter Remote offline
   → Host gibt direkt frei). Details §6.
4. **Zuschauer-Detailtiefe:** ✅ **schlank** — Score + Checkout + Reihenfolge + Legs/Sets. Kein
   Wurf-für-Wurf-Ticker/Statistik in v1 (hält View-State klein, senkt Realtime-Last).

**Technische Punkte — erledigt:**
5. ✅ **`state`-Frequenz:** umgesetzt als 150 ms Debounce (lokale Änderungen) + 30 s Heartbeat; im LAN
   unproblematisch (kleine Payload). Bei Bedarf später nachjustierbar.
6. ✅ **Board-Konten als Host:** per E2E bestätigt — ein Board-Konto (role=board, isBoard) darf
   `live_sessions` anlegen/aktualisieren und `live_commands` lesen/löschen; `board_role_guard.pb.js`
   betrifft nur `users` und steht dem nicht im Weg.

---

## 11. Testplan (Kurz)

- **Unit:** Befehls-Reducer/Reihenfolge (`seq`, Idempotenz), View-State-Projektion aus `counter.ts`.
- **Integration:** Host↔PocketBase↔Remote im LAN — Befehl senden, Ack, Undo, Übernahme, Reconnect.
- **E2E (Playwright):** PC-Board + Handy-Emulation koppeln, komplettes Leg per Handy tippen, parallel ein
  Zuschauer-Gerät mitlaufen lassen; Notfall simulieren (PC-Tastatur „tot" → Handy führt Spiel zu Ende).
- **Sicherheit:** Nicht-Remote darf keine Befehle senden; nicht angemeldet → kein Zuschauen; abgelaufener
  Code → `claim` scheitert.
