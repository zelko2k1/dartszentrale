# 2FA-Spike (Phase A) — Ergebnis

> Datum: 2026-07-05 · Ziel: TOTP-Verifikation im PocketBase-`pb_hooks`-JSVM beweisen (De-Risk vor Phase B).

## Frage
Ist HMAC-SHA1 (für TOTP nach RFC 6238 nötig) im PB-JSVM verfügbar — und falls nicht,
läuft eine eingebettete Pure-JS-Routine korrekt im echten goja-JSVM?

## Befund

1. **`$security` bietet KEIN SHA-1 / HMAC-SHA1.** Verfügbar sind nur:
   `md5, sha256, sha512, hs256` (HMAC-SHA256), `hs512` (HMAC-SHA512), `encrypt/decrypt`,
   JWT, Random. (Quelle: `pocketbase/pb_data/types.d.ts`, `declare namespace $security`.)
   → Der „einfache Pfad" (eingebautes HMAC-SHA1) ist ausgeschlossen, wie im Plan vermutet.

2. **Eingebettete Pure-JS-Routine funktioniert — verifiziert auf zwei Ebenen:**
   - **Node** (`test-totp.js`): 12/12 Tests grün — alle 6 RFC-6238-Appendix-B-Vektoren (8-stellig),
     200× Kreuzvergleich gegen Node-`crypto` HMAC-SHA1 (Zufalls-Secrets, 6-stellig, identisch),
     `verify()`-Fenster ±1 Schritt akzeptiert Drift, falsche/±2-Codes werden abgelehnt.
   - **Echtes goja-JSVM** (temporärer Hook `/api/2fa/_spike`, PocketBase 0.39.4 lokal):
     `{"allPass": true}` — alle 6 RFC-Vektoren stimmen im tatsächlichen Hook-Interpreter.

## Konsequenz für Phase B
- TOTP-Kern = die Routine in `totp.js` (SHA-1 + HMAC-SHA1 + Base32-Decode + HOTP/TOTP + `verify`).
  Sie ist bewusst **ES5.1-only** (keine TypedArrays/Node-APIs) und wird **inline** in jeden Hook
  kopiert (isolierte VM — kein Modul-Scope, siehe `board_role_guard.pb.js`-Warnung).
- Nächster Schritt: `user_mfa`-Collection (abgeschottet) + Hooks `setup/enable/disable/backup`
  und der zentrale `/api/login`-Challenge-Endpunkt (Plan §3–§5).

## Dateien
- `totp.js` — die embedbare Routine (Factory `makeTotp()`; im Hook wird ihr Inhalt inline kopiert).
- `test-totp.js` — Node-Testharness (`node test-totp.js`).
- Spike-Hook `_spike_totp.pb.js` wurde nach dem Test wieder **entfernt** (war nur temporär).

## Reproduzieren
```bash
cd spikes/2fa && node test-totp.js        # Node-Beweis
# JSVM-Beweis: _spike_totp.pb.js (aus git-Historie/ERGEBNIS) nach pocketbase/pb_hooks/ legen,
#   ./pocketbase serve --http=127.0.0.1:8091 --dir=./pb_data --hooksDir=./pb_hooks
#   curl http://127.0.0.1:8091/api/2fa/_spike   -> {"allPass":true,...}   danach Hook löschen.
```
