# ✅ Go-live checklist — cloud operation (Caddy + systemd)

**🇬🇧 English | [🇩🇪 Deutsch](de/go-live-checkliste-cloud.md)**

> Step-by-step tick-off list for a **secure production launch** in cloud mode
> (`app.<domain>` / `db.<domain>` behind Caddy, PocketBase + frontend on loopback only).
> Rationale for each item: [`security-audit.md`](security-audit.md). Deployment details:
> [`admin-guide-cloud.md`](admin-guide-cloud.md).
>
> **Legend:** ✅ = done automatically by the setup script (just **verify**) · 🔧 = actual manual work · 🔴 = mandatory.
> All ops commands run **on the server** in `~/dartszentrale/pocketbase/` (PB listens there on `127.0.0.1:8090`);
> `PB_SU_EMAIL`/`PB_SU_PASS` = your superuser account.

---

## Phase 0 — Roll out the current state 🔴

So that the new features (2FA, email changes by admins) are live:

- [ ] 🔧 Pull in the new code and restart the services:
  ```bash
  cd ~/dartszentrale && git pull
  ./update-server.sh          # rebuilds the frontend + restarts darts-web & darts-pocketbase
  ```
  > **Important:** PocketBase must restart so that the new **hooks** (`/api/login`, `/api/2fa/*`) and
  > **migrations** (`user_mfa`, `manageRule`) take effect. A frontend-only update (in-app) is **not** enough for this.
- [ ] 🔧 Sync schema/rules (sets `user_mfa` + `manageRule`, in case the migration alone doesn't cover everything):
  ```bash
  cd ~/dartszentrale/pocketbase
  PB_URL=http://127.0.0.1:8090 PB_SU_EMAIL=<su-email> PB_SU_PASS=<su-pw> node provision.mjs
  ```
- [ ] ✅ **Verify:** `curl -s -X POST http://127.0.0.1:8090/api/login -d '{}' -H 'Content-Type: application/json'`
  → must return **`"E-Mail und Passwort sind erforderlich."`** ("Email and password are required.", **HTTP 400**), **not** 404.

---

## Phase 1 — Accounts & passwords 🔴

- [ ] 🔴 **#1 Rotate the superuser password.** Set a new, strong, unique password (password manager) and
  store it somewhere safe:
  ```bash
  sudo systemctl stop darts-pocketbase
  ./pocketbase superuser upsert <su-email> "<new-strong-pw>" --dir ./pb_data
  sudo systemctl start darts-pocketbase
  ```
  If `seed-remote.sh` ever contained a password literal: remove it (the file is gitignored, but was visible in the review).
- [ ] 🔴 **#2 Production admin** exists with a **strong** password (created by `setup-cloud.sh`). Never run `demo-*.mjs`
  against the prod DB (the guard blocks non-local targets, but still: don't do it).
- [ ] 🔧 **Enable superuser MFA:** `https://db.<domain>/_/` → **Settings** → enable superuser 2FA (TOTP).
- [ ] 🔧 **Enable PB rate limiting:** `/_/` → **Settings** → enable rate limiting. Add a **rule for `POST /api/login`**
  (protects against password brute force — the app's own lockout only applies to the 2FA code, not the password).
- [ ] 🔧 **Recommend/set up 2FA for app admins:** each admin signs in → *Settings → My Account →
  Two-Factor Authentication → set up* (scan the QR code, store backup codes safely). Strongly recommended
  for accounts with admin rights.
- [ ] 🔧 All accounts: **strong, unique passwords** (password manager).

---

## Phase 2 — Network & TLS

- [ ] 🔧 **Firewall:** only **22/80/443** open. Do **not** open 8090/4173 (they only bind to `127.0.0.1` anyway):
  ```bash
  sudo ufw allow 22,80,443/tcp && sudo ufw enable      # (or Hetzner Cloud Firewall)
  ```
- [ ] ✅ **#3 PB loopback only** — verify that PB is **not** reachable from outside:
  ```bash
  curl -m 5 http://<public-ip>:8090     # must fail / time out
  ```
- [ ] ✅ **HTTPS + HSTS** (Caddy auto-Let's-Encrypt + `security_headers`) — verify:
  ```bash
  curl -sI https://app.<domain> | grep -i strict-transport-security   # HSTS header must be present
  ```
  And in the browser: padlock icon, valid certificate, `http://` redirects to `https://`.
- [ ] ✅ **CORS** restricted to the app domain (`--origins=https://app.<domain>` in the PB unit) — verify:
  `systemctl cat darts-pocketbase | grep origins`.

---

## Phase 3 — Caddy hardening 🔧

- [ ] 🔧 **#5 Shield the admin console `/_/`.** In `/etc/caddy/Caddyfile` (or [`Caddyfile.example`](../Caddyfile.example)),
  uncomment the `@admin path /_/*` block and enter your IP
  (`curl ifconfig.me`). No static IP? Put `basic_auth` in front or use VPN/Tailscale. The API (`/api/...`) stays open.
  ```bash
  sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
  ```
- [ ] 🔧 **#9 Enable the CSP.** Uncomment the `Content-Security-Policy` line in the `app.<domain>` block;
  **`connect-src` MUST include `https://db.<domain>`** (otherwise every API call fails).
  Then `caddy validate` + `reload` and **test in the browser** (check the DevTools console for CSP errors: login,
  API, PWA install, QR display during 2FA setup).

---

## Phase 4 — Backups 🔴

An entire club season hinges on `pocketbase/pb_data/` — backups are mandatory, not optional.

- [ ] 🔧 **Enable automatic PB backups:** `/_/` → **Settings → Backups** → enable a schedule (e.g. daily).
- [ ] 🔧 Set up an **off-site copy** (S3/Storage Box or similar) — a backup on the same server alone does not protect against
  losing the server. (PB backups can be written directly to an S3 bucket.)
- [ ] 🔧 **Test a restore once** (on a second server/locally): load the backup → the app starts with the data.
  An untested backup is not a backup.

---

## Phase 5 — Legal (mandatory when running on the internet) 🔴

- [ ] 🔴 Enter the **imprint (§ 5 DDG)** + **privacy policy (Art. 13 GDPR)**: as admin →
  *Settings → Legal*. They then appear **without signing in** on the login page.
- [ ] 🔧 If it's an older installation: make `club_config` publicly readable once (otherwise visitors who are not
  signed in won't see the texts):
  ```bash
  cd ~/dartszentrale/pocketbase && PB_URL=http://127.0.0.1:8090 PB_SU_EMAIL=<su-email> PB_SU_PASS=<su-pw> node provision.mjs
  ```

---

## Phase 6 — Final smoke test 🔧

Click through the live system (`https://app.<domain>`) once:

- [ ] Login as admin works.
- [ ] Set up 2FA (QR code is shown) → activate → log out → login asks for a code → get in with the code.
- [ ] User list: 2FA column visible; changing an account's email works (former bug #8).
- [ ] A regular user (player) can sign in and sees only their own permissions.
- [ ] Imprint/privacy links reachable on the login page (without signing in).

---

## Emergency tools (keep at hand)

All in `~/dartszentrale/pocketbase/`, run as superuser against `127.0.0.1:8090`:

| Situation | Command |
|---|---|
| App password forgotten | `USER_EMAIL=… NEW_PW=… PB_URL=http://127.0.0.1:8090 PB_SU_EMAIL=… PB_SU_PASS=… node reset-password.mjs` |
| Locked out of 2FA (phone + codes gone) — if no admin is available | `USER_EMAIL=… PB_URL=http://127.0.0.1:8090 PB_SU_EMAIL=… PB_SU_PASS=… node reset-2fa.mjs` |
| Create a board account | `BOARD_EMAIL=… BOARD_PW=… PB_URL=http://127.0.0.1:8090 PB_SU_EMAIL=… PB_SU_PASS=… node add-board-account.mjs` |
| Reset the superuser password | stop the service → `./pocketbase superuser upsert <email> "<pw>" --dir ./pb_data` → start |

> **Reset 2FA in the app:** The normal way is now in the app — *Users → Edit account →
> "Reset 2FA"*. The CLI script is only the last resort if no admin can get in anymore.

---

## Not a blocker

- **#12** The roster list is readable by every signed-in user (emails protected). **Decision 2026-07-05:
  no restriction needed at the moment** — implement only on club request (e.g. because of minors). Listed as an
  optional feature in the [ROADMAP](../ROADMAP.md) §4. Rationale: [`security-audit.md`](security-audit.md) #12.
