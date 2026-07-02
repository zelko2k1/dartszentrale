# Plan: 2-Faktor-Authentifizierung (TOTP) — optional, für beide Apps

> Status: **Planung** (2026-06-28). Noch nichts umgesetzt. Gilt für **`dartshub`** (Liga/Verein)
> **und** die geplante **`dartshub-turniere`**-App (gemeinsames Auth-Fundament).

---

## 1. Ziel & Entscheidungen (festgezurrt)

- **TOTP** (RFC 6238, 6-stelliger 30-Sek.-Code) — deckt **alle** Authenticator-Apps ab
  (Google, Microsoft, 2FAS, Authy, …); kein App-spezifischer Code nötig.
- **Optional / opt-in:** jeder Nutzer *kann* 2FA aktivieren; **nicht erzwungen**. Vorbereitet für
  späteres „für Admins erzwingen", wenn die App im Internet steht (Schalter, default aus).
- **Serverseitig verifiziert** über PocketBase `pb_hooks` → **nur Vereins-/Server-Modus**. Lokalmodus
  (kein Server, keine echte Anmeldung) bleibt ohne 2FA.
- **Mit Recovery von Anfang an:** Backup-Codes + Superuser-Rettungsskript.
- **Für beide Apps:** im gemeinsamen Auth-Fundament bauen → Turnier-App erbt es über den Fork.

---

## 2. Standard & Technik

- TOTP, **SHA-1, 6 Ziffern, 30 s** (der von allen Authenticatorn unterstützte Default; viele Apps
  ignorieren den Algorithmus-Parameter und nutzen immer SHA-1 → SHA-1 ist Pflicht für Kompatibilität).
- Enrollment per `otpauth://totp/DartsHub:<email>?secret=<BASE32>&issuer=DartsHub` → als **QR-Code**.
- **Zeit-Toleranz** ±1 Schritt (vor/zurück 30 s) gegen Uhren-Drift.
- Verifikation läuft im Hook; der geheime Schlüssel **verlässt nie** wieder den Server.

**Feasibility-Spike (zuerst klären):** Das PocketBase-JSVM (`$security`) bietet HMAC-SHA**256**
(`hs256`), aber TOTP braucht standardmäßig HMAC-SHA**1**. Spike: prüfen, ob SHA-1/HMAC-SHA1 im
Hook verfügbar ist; falls nicht, eine **kompakte, geprüfte HMAC-SHA1+SHA1-Routine in den Hook
einbetten** (bekannte, kleine Pure-JS-Implementierung). Erst danach Phase B starten.

---

## 3. Datenmodell

Neue, **abgeschottete** Collection `user_mfa` (Secrets nie über die normale API lesbar):

| Feld | Typ | Zweck |
|---|---|---|
| `user` | relation→users | Besitzer (1:1) |
| `secret` | text | TOTP-Base32-Secret |
| `enabled` | bool | aktiv (nach Bestätigung) |
| `pending` | bool | im Enrollment, noch nicht bestätigt |
| `backupCodes` | json | **gehashte** Einmal-Codes (+ used-Flag) |
| `failedAttempts` | number | für Lockout |
| `lockedUntil` | text | temporäre Sperre nach zu vielen Fehlversuchen |
| `confirmedAt` | text | Aktivierungszeitpunkt |

- **API-Regeln:** alle leer/deny → **kein** List/View/Create/Update/Delete über die REST-API.
  Nur die Hooks (laufen mit Superuser-Kontext) lesen/schreiben. Damit ist das Secret nie abrufbar.
- Offen: Secret zusätzlich **verschlüsselt** ablegen? (PB verschlüsselt Felder nicht von Haus aus;
  abgeschottete Collection ist die pragmatische Mindestabsicherung — Entscheidung in §8.)

---

## 4. Endpunkte (pb_hooks, Muster wie `set_password.pb.js`)

| Route | Methode | Auth | Tut |
|---|---|---|---|
| `/api/2fa/setup` | POST | eingeloggt | Secret erzeugen, `pending` anlegen, `otpauth://`-URI + Secret zurück |
| `/api/2fa/enable` | POST | eingeloggt | übergebenen Code prüfen → `enabled=true`; **Backup-Codes erzeugen** (einmalig zurückgeben, gehasht speichern) |
| `/api/2fa/disable` | POST | eingeloggt | nach gültigem Code/Passwort → `user_mfa` löschen |
| `/api/2fa/backup/regenerate` | POST | eingeloggt | neue Backup-Codes (alte entwerten) |
| `/api/login` | POST | — | **zentraler Login** (siehe §5) |

Token-Ausgabe im Hook über `$apis.recordAuthResponse(e, user, "password", meta)`;
Passwortprüfung über `user.validatePassword(pw)`.

---

## 5. Login-Flow (der Kern)

Heute: `pb.collection('users').authWithPassword(...)` gibt **sofort** einen gültigen Token. Damit
2FA *vor* der Token-Ausgabe greift, ersetzt ein **eigener Login-Endpunkt** den Direkt-Aufruf:

1. App → `POST /api/login {email, password, code?}`.
2. Hook: Nutzer per E-Mail finden, `validatePassword(password)`.
3. **Kein 2FA aktiv** → sofort `recordAuthResponse` (Token). *(Verhalten wie bisher — opt-in.)*
4. **2FA aktiv, kein/ungültiger Code** → Antwort `{ mfa_required: true }`, **kein Token**.
5. **Code gültig** (TOTP **oder** Backup-Code) → `recordAuthResponse` (Token).
6. **Lockout:** N Fehlversuche (z. B. 5) → `lockedUntil` setzen, kurze Sperre (z. B. 5 min).

Frontend (`store.loginEmail` / `Login.tsx`): nach Schritt 4 ein **6-stelliges Code-Feld** zeigen
(+ Link „Backup-Code verwenden"), dann erneut `/api/login` mit `code`.

---

## 6. Recovery (Pflicht)

- **Backup-Codes:** bei der Aktivierung **einmalig** angezeigt (Anzeige + Download), 10× z. B.
  8-stellig, **gehasht** gespeichert, **Einmalgebrauch** (used-Flag). Im Login statt TOTP nutzbar.
- **Superuser-Rettung:** Skript `pocketbase/reset-2fa.mjs` (analog zu `reset-password.mjs`):
  authentifiziert als Superuser → löscht den `user_mfa`-Datensatz eines Kontos = 2FA aus.
  Letzter Notnagel bei „Handy weg **und** Backup-Codes weg".

---

## 7. UI

- **Einstellungen → „Sicherheit / 2-Faktor-Authentifizierung":**
  - Status (aus/aktiv), **Aktivieren-Assistent**: QR anzeigen → Code bestätigen → **Backup-Codes**
    anzeigen/herunterladen.
  - Deaktivieren (mit Code/Passwort), Backup-Codes neu erzeugen.
  - **QR-Rendering:** kleine Pure-JS-QR-Erzeugung (SVG) — leichte Abhängigkeit, kein schweres Paket.
- **Login:** nach Passwort ggf. Code-Feld (TOTP / Backup-Code).
- **Admin-Nudge (optional):** Admins ohne 2FA sehen einen dezenten Hinweis-Banner „2FA empfohlen".
- **Policy-Schalter (default aus):** „2FA für Admins erzwingen" — vorbereitet für den Internet-Betrieb.

---

## 8. Härtung (alle Vorschläge)

- **HTTPS Pflicht**, sobald öffentlich (TOTP/Passwort nie über Klartext).
- **PocketBase-Konsole `/_/` nicht ins Internet** — nur LAN/VPN; öffentlich nur App + nötige Endpunkte.
- **Rate-Limit/Lockout** auf `/api/login` und TOTP-Verifikation (PB-eigenen Rate-Limiter nutzen + §5-Lockout).
- **Starkes, einzigartiges Admin-Passwort** (Passwortmanager) — größter Einzelhebel, unabhängig von 2FA.
- Board-/Kiosk-Konten bleiben **unprivilegiert** (bereits so).
- Server-**Uhrzeit korrekt** halten (NTP) — sonst schlägt TOTP fehl.
- Konstante-Zeit-Vergleich für Codes (`$security.equal`).
- **Abgrenzung:** betrifft die App-Rolle `admin` (Collection `users`), **nicht** die PB-Superuser-Konsole
  (die hat ihre eigene 2FA-Option).

---

## 9. Beide Apps

Implementierung **einmal** im gemeinsamen Auth-Fundament (`pocketbaseProvider.ts`, `Login.tsx`,
`Settings.tsx`, `pb_hooks/`, `user_mfa`-Migration). Die **Turnier-App erbt es über den Fork** (Phase 0/1
der Turnier-App). Timing: entweder 2FA zuerst in `dartshub` bauen → Turnier-Fork zieht es mit; oder
nach dem Turnier-Scaffold in beide portieren. Empfehlung: **zuerst in `dartshub`**, dann erbt der Fork.

---

## 10. Phasenplan (für das 2FA-Feature)

| Phase | Inhalt |
|---|---|
| **A — Spike** | TOTP-Verifikation im pb_hook beweisen (HMAC-SHA1 verfügbar? sonst einbetten). De-risk. |
| **B — Backend** | `user_mfa`-Collection (abgeschottet) + Hooks (`setup/enable/disable/backup`, `/api/login` mit Challenge), Backup-Codes (gehasht), Lockout, `reset-2fa.mjs`. |
| **C — Frontend** | Settings-Assistent (QR + Bestätigung + Backup-Codes), Login-Challenge-Feld, Deaktivieren/Neu-Erzeugen. |
| **D — Härtung+Doku** | HTTPS/Exposition-Guidance, Admin-Nudge, Policy-Schalter, Docs (`admin-anleitung-cloud.md`/`lokaler-betrieb.md`). |
| **E — Turnier-App** | über Fork erben bzw. portieren + verifizieren. |

---

## 11. Offene Detailfragen

1. **Secret-Speicherung:** nur abgeschottete Collection (Empf.) vs. zusätzlich verschlüsselt.
2. **Lockout-Werte:** Fehlversuche/Sperrdauer (Vorschlag 5 / 5 min).
3. **Backup-Codes:** Anzahl/Format (Vorschlag 10× 8-stellig).
4. **QR-Lib:** konkrete kleine Pure-JS-Variante wählen.
5. **Reihenfolge zu Turnier-App:** 2FA vor oder nach dem Turnier-Scaffold (Empf.: vorher in dartshub).
