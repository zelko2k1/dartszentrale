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
