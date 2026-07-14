# Plan: 2-Faktor-Authentifizierung (TOTP) — optional

> Status: **Planung** (2026-06-28). Noch nichts umgesetzt. Gilt für **`dartszentrale`** (Liga/Verein).

---

## 1. Ziel & Entscheidungen (festgezurrt)

- **TOTP** (RFC 6238, 6-stelliger 30-Sek.-Code) — deckt **alle** Authenticator-Apps ab
  (Google, Microsoft, 2FAS, Authy, …); kein App-spezifischer Code nötig.
- **Optional / opt-in:** jeder Nutzer *kann* 2FA aktivieren; **nicht erzwungen**. Vorbereitet für
  späteres „für Admins erzwingen", wenn die App im Internet steht (Schalter, default aus).
- **Serverseitig verifiziert** über PocketBase `pb_hooks` → **nur Vereins-/Server-Modus**. Lokalmodus
  (kein Server, keine echte Anmeldung) bleibt ohne 2FA.
- **Mit Recovery von Anfang an:** Backup-Codes + Superuser-Rettungsskript.

---

## 2. Standard & Technik

- TOTP, **SHA-1, 6 Ziffern, 30 s** (der von allen Authenticatorn unterstützte Default; viele Apps
  ignorieren den Algorithmus-Parameter und nutzen immer SHA-1 → SHA-1 ist Pflicht für Kompatibilität).
- Enrollment per `otpauth://totp/DartsZentrale:<email>?secret=<BASE32>&issuer=DartsZentrale` → als **QR-Code**.
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
| `/api/2fa/setup` | POST | eingeloggt | ✅ **umgesetzt** (`pb_hooks/2fa_hooks.pb.js`) — Secret erzeugen, `pending` anlegen, `otpauth://`-URI + Secret zurück |
| `/api/2fa/enable` | POST | eingeloggt | ✅ **umgesetzt** (`pb_hooks/2fa_hooks.pb.js`) — übergebenen Code prüfen → `enabled=true`; **Backup-Codes** (10× 8-stellig, einmalig zurück, sha256-gehasht) |
| `/api/2fa/disable` | POST | eingeloggt | ✅ **umgesetzt** — nach gültigem Code/Passwort (Re-Auth) → `user_mfa` löschen |
| `/api/2fa/backup/regenerate` | POST | eingeloggt | ✅ **umgesetzt** — nach Re-Auth 10 neue Backup-Codes (alte vollständig entwertet) |
| `/api/login` | POST | — | ✅ **umgesetzt** (`pb_hooks/2fa_hooks.pb.js`) — zentraler Login mit 2FA-Challenge (§5), TOTP **oder** Backup-Code, Lockout 5/5min |
| `/api/2fa/status` | GET | eingeloggt | ✅ **umgesetzt** — eigener 2FA-Status (die UI erfährt ihn nur so, da `user_mfa` abgeschottet ist) |
| `/api/2fa/admin/list` | GET | **Admin** | ✅ **umgesetzt** — IDs aller Konten mit aktivem 2FA (für die Spalte in der Benutzerliste) |
| `/api/2fa/admin/reset` | POST | **Admin** | ✅ **umgesetzt** — 2FA eines Kontos zurücksetzen (In-App-Gegenstück zu `reset-2fa.mjs`) |

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
- **Admin-Reset in der App:** ✅ **umgesetzt** — in der Benutzerliste zeigt eine **2FA-Spalte**, wer
  2FA aktiv hat; im Bearbeiten-Dialog eines Kontos kann der Admin **„2FA zurücksetzen"** (mit Bestätigung).
  Löscht den `user_mfa`-Datensatz → der Nutzer meldet sich nur mit Passwort an und richtet 2FA neu ein.
  Endpunkte `/api/2fa/admin/list` + `/api/2fa/admin/reset` (admin-gated). Der erste Anlaufpunkt bei
  „Handy/Codes weg" — ohne CLI/Superuser.
- **Superuser-Rettung (CLI):** ✅ **umgesetzt** — `pocketbase/reset-2fa.mjs` (analog zu `reset-password.mjs`):
  authentifiziert als Superuser → löscht den `user_mfa`-Datensatz eines Kontos = 2FA aus (mit Gegenprobe).
  Letzter Notnagel, falls **kein** App-Admin verfügbar ist.
  Aufruf: `USER_EMAIL=… node reset-2fa.mjs` (Cloud zusätzlich `PB_URL`/`PB_SU_EMAIL`/`PB_SU_PASS`).

---

## 7. UI

- **Einstellungen → „Sicherheit / 2-Faktor-Authentifizierung":**
  - Status (aus/aktiv), **Aktivieren-Assistent**: QR anzeigen → Code bestätigen → **Backup-Codes**
    anzeigen/herunterladen.
  - Deaktivieren (mit Code/Passwort), Backup-Codes neu erzeugen.
  - **QR-Rendering:** ✅ eigener vendored Pure-JS-Encoder `app/src/lib/qrcode.ts` (Byte-Modus, ECC-M,
  Versionen 1–10, Reed-Solomon + Masken + Versions-Info) → SVG; **kein npm-Paket**. Gegen node-qrcode
  (0/2401 Zell-Diff) und per jsQR-Dekodierung verifiziert.
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

## 9. Phasenplan (für das 2FA-Feature)

| Phase | Inhalt |
|---|---|
| **A — Spike** | ✅ **ERLEDIGT 2026-07-05** ([`../spikes/2fa/ERGEBNIS.md`](../spikes/2fa/ERGEBNIS.md)). Befund: `$security` hat **kein** SHA-1/HMAC-SHA1 → Pure-JS-Routine (`spikes/2fa/totp.js`, ES5.1, inline im Hook) eingebettet; im echten goja-JSVM gegen alle RFC-6238-Vektoren + 200× Node-`crypto`-Kreuzvergleich verifiziert. |
| **B — Backend** | ✅ **fast fertig** (2026-07-05): `user_mfa` (Migration `1782300002_user_mfa.js` + provision.mjs, abgeschottet) · Hooks `setup` + `enable` + `/api/login`-Challenge (TOTP/Backup, Lockout 5/5min) + **`disable` + `backup/regenerate`** (Re-Auth via Code ODER Passwort) — alle in `pb_hooks/2fa_hooks.pb.js`, plus **`reset-2fa.mjs`** (Superuser-Rettung), E2E gegen frische PB grün (setup/enable 17/17, login 13/13, disable/regenerate 14/14, reset 3/3 + Rand-Fälle). **✅ Phase B abgeschlossen** — nächster Schritt Phase C (Frontend). **⚠ Zwei JSVM-Fallen (verifiziert):** (1) `record.get('<json>')` liefert ROHE UTF-8-Bytes (byte-Array), nicht geparst → per `String.fromCharCode`+`JSON.parse` dekodieren. (2) Route-Handler laufen in **isolierter VM ohne Modul-Scope** → geteilte Helfer (z. B. Re-Auth) MÜSSEN handler-lokal sein, ein Top-Level-`function` wirft `ReferenceError` (= generischer 400). |
| **C — Frontend** | ✅ **umgesetzt** (2026-07-05). Login auf **`POST /api/login`** umgestellt (`pocketbaseProvider.login` → `LoginResult`, Store `loginEmail` behandelt `mfaRequired`, `Login.tsx` blendet Code-Feld ein). Settings-Assistent „2-Faktor-Authentifizierung" unter *Mein Konto* (`TwoFactorSettings` in `Settings.tsx`): QR (eigener vendored Pure-JS-Encoder `app/src/lib/qrcode.ts`, gegen node-qrcode + jsQR verifiziert) + Secret-Fallback → Bestätigung → Backup-Codes (kopieren/herunterladen) · Deaktivieren · Neu-Erzeugen (Re-Auth). Neuer Backend-Endpunkt `GET /api/2fa/status`. **End-to-End im echten Browser (Playwright) verifiziert: 9/9.** |
| **D — Härtung+Doku** | HTTPS/Exposition-Guidance, Admin-Nudge, Policy-Schalter, Docs (`admin-anleitung-cloud.md`/`lokaler-betrieb.md`). |

---

## 10. Offene Detailfragen

1. **Secret-Speicherung:** nur abgeschottete Collection (Empf.) vs. zusätzlich verschlüsselt.
2. **Lockout-Werte:** Fehlversuche/Sperrdauer (Vorschlag 5 / 5 min).
3. **Backup-Codes:** Anzahl/Format (Vorschlag 10× 8-stellig).
4. **QR-Lib:** konkrete kleine Pure-JS-Variante wählen.
