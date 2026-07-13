# 🐞 BUGS

> Sammelstelle für konkrete Fehler & Testfunde. Für geplante Features / größere offene Punkte siehe [ROADMAP.md](ROADMAP.md).
>
> **Status:** `[ ]` offen · `[~]` in Arbeit · `[x]` behoben · `[?]` nicht reproduzierbar / Rückfrage
> **Prio:** 🔴 hoch (blockiert) · 🟡 mittel · ⚪ niedrig / kosmetisch

---

## Offen
<!-- Neue Funde hier oben eintragen. Vorlage darunter kopieren. -->

### [ ] #0 — Kurztitel
- **Prio:** 🟡
- **Screen/Bereich:** z. B. Counter · Training · Settings · Dashboard
- **Gerät:** z. B. Board-Monitor (Desktop, ~2,37 m) · Tablet · Smartphone
- **Erwartet:** was passieren sollte
- **Tatsächlich:** was passiert
- **Schritte:** 1. … 2. … 3. …
- **Notiz:** Screenshot, Konsole, Vermutung …

---

## Behoben

_Behoben am 2026-07-13 — gegen PocketBase im Vereinsmodus reproduziert & live verifiziert (Import der echten Vereins-CSV + nuLiga-Abgleich)._

### [x] #10 — CSV-Import: Pokalmannschaften werden als Ligamannschaften erkannt (nur eine Mannschaft pro Pokal)
- **Prio:** 🟡 · **Bereich:** Mannschaften (nach CSV-Import) · **Gerät:** alle
- **Symptom:** Nach dem Spielplan-Import fehlten die **Pokalmannschaften**. Eine Mannschaft, die in Liga **und** Pokal spielt (z. B. „DSV Nürnberg", „DSV Nürnberg II"), existierte nur **einmal** (als Ligamannschaft); reine Pokal-Teams (Manuka, 501 No Scope II, DSV Devils & Angels) wurden ohne Pokal-Kennung angelegt.
- **Ursache:** `deriveOwnTeams` (`app/src/lib/scheduleImport.ts`) hat die eigenen Mannschaften **nur nach Namen** dedupliziert und **keine `kind`** gesetzt → gleiche Namen aus Liga & Pokal fielen zusammen, alles landete als Liga-Team.
- **Fix:** Ableitung erhält jetzt die **Art** aus dem Wettbewerb (Pokal-Liga → `kind='cup'`, sonst `'league'`) und dedupliziert pro **(Art + Name)**. So entstehen für denselben Namen eine Liga- **und** eine Pokalmannschaft; ein Spieler darf je einer angehören.
- **Verifiziert:** Import der echten Vereins-CSV → 15 eigene Mannschaften (10 Liga + 5 Pokal), „DSV Nürnberg"/„DSV Nürnberg II" in PocketBase als je Liga- **und** Pokal-Team.

### [x] #9 — CSV-Import: Pokal-Saison „Pokal 2025/26" statt „2025/26" (Phantom-Saison)
- **Prio:** 🟡 · **Bereich:** Ligen/Saison (nach CSV-Import) · **Gerät:** alle
- **Symptom:** Pokal-Wettbewerbe erschienen unter der Saison **„Pokal 2025/26"** statt der eigentlichen Saison **„2025/26"** — die Saison wurde für Pokal-Zeilen nicht korrekt erkannt.
- **Ursache:** BDV/nuLiga filet Pokale in der `Saison`-Spalte unter „Pokal 2025/26". Der Import übernahm den Wert **wörtlich** als Saison-Label → eigene Phantom-Saison neben „2025/26".
- **Fix:** Saison-Label wird normalisiert (Jahr `\d{4}/\d{2,4}` extrahiert): „Pokal 2025/26" → „2025/26". Die **Cup-Erkennung** nutzt weiter den Rohwert (Staffelname „…Pokal"/„Cup" bzw. rohe Saison), bleibt also erhalten. `app/src/lib/scheduleImport.ts`.
- **Verifiziert:** Import → nur noch **ein** Saison-Label „2025/26"; alle drei Pokale (Klaus Unterberg Pokal, 8er-Cup, Damenpokal) mit `kind='cup'` darunter.

_Behoben am 2026-07-05 — gegen PocketBase reproduziert & verifiziert._

### [x] #8 — Benutzerverwaltung: E-Mail-Adresse eines Kontos lässt sich nicht ändern
- **Prio:** 🔴 · **Bereich:** Benutzerverwaltung · **Gerät:** alle
- **Symptom:** Beim Ändern der E-Mail eines Kontos (auch des eigenen Admin-Kontos) → „Änderung konnte nicht gespeichert werden". Andere Felder (Name, Rolle …) speichern normal.
- **Ursache:** Die `users`-Collection hatte **keine `manageRule`** (war `null`). PocketBase behandelt `email`/`verified` als „managed" Auth-Felder und lässt sie über die Records-API nur von einem **Superuser** oder einer Anfrage mit erfüllter `manageRule` ändern. Die App meldet sich als normaler `users`-Datensatz an (App-Rolle `admin`, kein PB-Superuser) → E-Mail-Änderung wird mit HTTP 400 `validation_values_mismatch` („Values don't match") abgewiesen, das ganze Update scheitert. Der echte Feld-Fehler landete nur in der Konsole (`persist` → generisches `syncError`).
- **Fix:** `manageRule = "@request.auth.role = \"admin\""` an der `users`-Collection (deckungsgleich mit `updateRule`). Migration `pocketbase/pb_migrations/1782300003_users_manage_rule.js` + gespiegelt in `pocketbase/provision.mjs`.
- **Verifiziert:** Reproduktion gegen PocketBase — vorher 400, nach der Migration ändert der App-Admin fremde **und** eigene E-Mail mit 200; Superuser-Pfad unverändert.
- **Nebenwirkung (erwartet):** Ändert ein Admin seine **eigene** E-Mail, invalidiert PocketBase dessen Session-Token (wie bei Passwortänderung) → danach neu anmelden.

_Behoben am 2026-07-03 — im lokalen Verein-Test verifiziert._

### [x] #7 — Kiosk: Admin kann sich zum Verlassen des Board-Modus nicht anmelden
- **Prio:** 🔴 · **Bereich:** Kiosk-Ausstieg (Board-Modus) · **Gerät:** Board-Monitor
- **Symptom:** Nach Eingabe korrekter Admin-Zugangsdaten im Exit-Dialog passiert nichts / „Anmeldung fehlgeschlagen".
- **Ursache:** `kioskExitLogin` prüfte die Rolle **vorab per E-Mail-Vergleich** gegen die geladene Kontoliste. Ein Board-Konto sieht fremde E-Mails aber nur bei `emailVisibility=true` (bei manuell im PB-Panel angelegten Admins default **aus**) → Konto wird nicht gefunden → Abbruch **vor** jedem Login-Versuch.
- **Fix:** Neue Provider-Methode `kioskExitAuth(email, pw, allowedRoles)` — meldet an, prüft die Rolle am echten authentifizierten Record und stellt die Board-Sitzung bei Ablehnung/falschem Passwort wieder her. `app/src/data/provider.ts`, `pocketbaseProvider.ts`, `localProvider.ts`, `store/useStore.ts`.
- **Verifiziert:** lokaler Verein-Test T1–T5 (Admin mit versteckter E-Mail, Admin/Kapitän mit sichtbarer E-Mail, Spieler-Ablehnung + Board-Sitzung erhalten, falsches Passwort).

_Behoben am 2026-07-02 — verifiziert in der Preview._

### [x] #1 — Startbildschirm: „PocketBase" → „Datenbank"
- **Bereich:** ModePicker (Ersteinrichtung) · **Fix:** Benutzertext auf „Datenbank" umbenannt (kein Techbegriff „PocketBase" mehr) — `app/src/screens/ModePicker.tsx`.

### [x] #2 — Trainingsspiele per Tastatur bedienbar
- **Bereich:** Trainingsspiele · **Fix:** Zahlentasten im Board-Betrieb: Doppel/Bob's 27 & Around-the-Clock `0–3`, Checkout 121 `1–3` + `0` = verfehlt, Baseball `0–9`. Hits-, Advance-, Checkout- & Runs-Panel via neuem `useTrainKeys`-Hook — `app/src/screens/TrainingGame.tsx`. (Score-/Halve-Panels hatten bereits Eingabefeld + Enter.)

### [x] #3 — Ersteinrichtung: leerer Kalender
- **Bereich:** Kalender · **Fix:** `seedEvents()` liefert `[]` → frische Installation ohne Demo-Termine (lokal & Verein) — `app/src/data/seed.ts`.

### [x] #4 — Nach Spielende: Buttons per Tastatur
- **Bereich:** Darts Counter (Sieg-Overlay) · **Fix:** `1` = Dashboard, `2` = Neues Spiel, `3`/`Enter` = Revanche, mit Tasten-Hinweisen — `app/src/screens/Counter.tsx`.

### [x] #5 — Einstellungen: „Zum Darts Counter"-Button entfernt
- **Bereich:** Einstellungen · **Fix:** Button samt ungenutztem Icon-Import entfernt — `app/src/screens/Settings.tsx`.

### [x] #6 — Counter-Setup: Tastenkürzel Alt+Enter
- **Bereich:** Darts Counter (Setup) · **Fix:** „Spiel starten" jetzt auf **Alt+Enter**, als globaler Listener (funktioniert unabhängig vom Fokus; das alte Strg+Enter griff nur bei Fokus im Suchfeld). Hinweis-Badge/Tooltip angepasst — `app/src/screens/CounterSetup.tsx`.
