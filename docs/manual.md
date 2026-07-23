# DartsZentrale — Manual for Club Admins

**🇬🇧 English | [🇩🇪 Deutsch](de/handbuch.md)**

This manual explains **how to use DartsZentrale day to day** — from signing in
through players, teams, leagues and the Darts Counter to board computers and
data backups. It is deliberately non-technical.

> **Still need to get the app up and running?** The **setup guide** is in the
> `docs/` folder of your package — depending on your mode of operation:
> - **local, single board** → `guide-local-windows.md` or `guide-local-linux.md`
> - **club mode on the LAN** → `admin-guide-lan-windows.md` or `admin-guide-lan-linux.md`
> - **cloud** → `admin-guide-cloud.md` (a script sets up the server)
>
> This manual picks up where the app is already running.

---

## 1. Two Modes of Operation

DartsZentrale can run in two ways:

| Mode | What for | Login? | Server required? |
|------|----------|--------|------------------|
| **Local** | One device at the board, quick scoring, no club | no | no |
| **Club** | Multiple devices, real logins, leagues, teams, users | yes | yes (PocketBase) |

In **local mode** everything is open (one device, one user) — leagues,
teams and user management are hidden. **Club mode** adds sign-in, roles and
full administration. This manual mainly covers club mode.

**On the very first start** every device asks whether it should run **Local**
or in **club mode**. The device remembers the choice; you can change it any time
under **Settings → Usage mode** (the mode is per device, not club-wide).

---

## 2. Two Different Logins — Don't Mix Them Up!

There are **two separate account worlds**:

| | **App login** | **PocketBase admin (superuser)** |
|---|---|---|
| What for | normal use of the app | server/database administration |
| Where | `https://app.yourdomain.com` | `https://db.yourdomain.com/_/` |
| Example | `chairman@yourdomain.com`, role *Admin* | your PocketBase superuser |

- You need the **app admin** every day — it manages the club, players,
  teams, leagues and users.
- You rarely need the **PocketBase superuser** — for backups, server settings
  and as an **emergency key** if an app password was forgotten (see §13).

---

## 3. Signing In

1. Open `https://app.yourdomain.com`.
2. Enter the email + password of an active app account → **Sign in**.
3. Tip: in Edge/Chrome use **"Install as app"** (PWA) — DartsZentrale then sits on
   the desktop/home screen like a regular program.

The session persists until you sign out (account card at the bottom of the sidebar).
**Self-registration is disabled for security reasons** — new accounts are
always created by an admin (§5).

---

## 4. Roles & Permissions

Every app account has exactly one role. It determines what is visible and allowed:

| Role | Color | May … |
|------|-------|-------|
| **Administrator** | red | everything: club, users, settings + everything below |
| **Captain** | gold | manage players, teams, leagues, events + play |
| **Player** | green | play (Counter/Training), see own stats & events |
| **Viewer** | blue | read only (schedules, standings) |
| **Board computer** | gray | machine account: play only, manage nothing (see §11) |

Detailed matrix:

| Capability | Admin | Captain | Player | Viewer |
|------------|:-----:|:-------:|:------:|:------:|
| Manage users | ✓ | – | – | – |
| Club/settings (mode, name, logo) | ✓ | – | – | – |
| Manage players | ✓ | ✓ | – | – |
| Manage teams | ✓ | ✓ | – | – |
| Leagues & results | ✓ | ✓ | – | – |
| Manage events | ✓ | ✓ | – | – |
| Play (Counter/Training) | ✓ | ✓ | ✓ | – |

> Permissions are enforced **server-side** (PocketBase API rules) — the
> hidden buttons are just the UI on top of that.

> **Creating/deleting large structures is admin territory.** Captains maintain teams,
> lineups and results, but only an **admin** may **delete teams, leagues and seasons**
> or **create new leagues and seasons**. That way a single captain account
> cannot accidentally reshape the whole club's data. Additionally, every
> scored match is tied to its **creator** — only the admin or the person who
> entered it may correct it.

The **Board computer** role cannot be assigned manually; it belongs exclusively to
dedicated board accounts (§11).

---

## 5. Managing Users (Admin Only)

**Users** in the sidebar → overview of all accounts (total / active / linked to a
player) + table.

**Create a new user:** "+ User" → in the dialog:
- **First name + last name**, **email**, **login password** (min. 8 characters).
- **Position in the club** (optional, free text: e.g. "Chairman").
- Choose a **role** (§4).
- **Avatar color** and — after saving — optionally a **profile photo**.
- **Link to player** (optional): connects the account to an entry in the
  player list so statistics are attributed to the right player. An account
  can have at most one player; already linked players are hidden.
- **Team & captaincy** (new): as soon as a player is linked and the role
  *Player* or *Captain* is selected, you can assign the player directly to one or
  more **teams** (league + cup) right here. With the *Captain* role they also
  become **captain** of the selected team(s).
  > The selection represents the **complete** membership: unchecking a box
  > removes the player from that team. With the *Admin/Viewer* role the
  > team assignment is left untouched.
- **Active toggle**: deactivated accounts cannot sign in (instead of deleting them).

**Editing:** pencil in the row. Leave the password empty = unchanged. As admin you
can reset any account's password (just fill in the field again).

> **Tip:** Create **a second admin** early on — a forgotten password then
> won't lock you out.

---

## 6. Players

**Players** = the sporting list of people. It is the **single source** for squads,
lineups and statistics; login accounts are separate (an account optionally
*points to* a player).

- Card grid with avatar, name, nickname/match count, 3-dart average and wins.
- "+ Player" / pencil (admin/captain): **name**, **initials** (max. 3 characters),
  avatar color, optionally a photo.
- Click a card → **player detail** with scoring (60+/100+/140+/180),
  form curve and recent matches.

Not every player needs a login account (e.g. youth/guest players), and not every
account needs a player profile (e.g. board members who don't play).

---

## 7. Teams

**Teams** = club teams whose squads are drawn from the player list.

- There are **league teams** (green) and **cup teams** (gold). A player
  may be in **one league team and one cup team** at the same time.
- "+ Team" / "Edit": **name**, **league** (free text), **type** (league/cup),
  **squad** via checkboxes from the player list, **captain** (star) and up to **two
  vice-captains**.
- Per team: the **squad** on the left (captain with "C" badge, 3-dart average), the
  **lineup** for the next match day on the right.

> Squads can **also be filled when creating a user** (§5) — both paths write to
> the same team.

---

## 8. Leagues

**Leagues** manage schedules and calculate the standings.

- "+ League": **name**, **season**, participating teams (mark your own with the
  "Own" toggle) and the **match format** (templates: **Bayernliga** = 8 singles + 4 doubles,
  **Landesliga** = 6 singles · 3 doubles · 6 singles).
- **Standings** (calculated): `P · W · D · L · Diff · Pts`. Points **2/1/0**
  (win/draw/loss), sorted by points → leg difference → legs won →
  name. Your own team highlighted in green, top 2 green, last place red.
- **Fixtures:** "+ Fixture" → home/away, date. Enter results via the **result modal**
  (leg score `Home : Away`); the standings recalculate immediately.
- Compose the **lineup** freely for each of your own fixtures (singles/doubles in
  actual playing order, plus an ordered substitute list).

### Importing a Schedule (CSV)

Instead of creating every fixture by hand, you can import an **association schedule
as CSV** (Leagues → **"Import schedule"**). Each **division** becomes a league, your
teams are marked and your fixtures are additionally created as **calendar events**.
Re-importing only updates results — nothing is created twice. **"Download
template"** provides a filled-in example file to model yours on (pure manual operation).

**Your teams are detected automatically** — in two ways:

- **BDV/nuLiga export** (with club-number columns): the most frequently occurring club is
  considered yours — this also works with **fantasy names** (e.g. "Manuka" in the cup).
- **Simple/manual CSV** (without club numbers): matched against the **club name from
  Settings** (§12). So keep the club name correct there and choose team names
  that contain it (e.g. "DC Beispiel", "DC Beispiel II").

**Cup:** If the **division** or **season name** contains "Pokal" or "Cup", the competition
is created as **knockout** (no standings, fixtures only). **Team names:** the first team
**without a suffix**, from the second onward with "II"/"III" … — exactly as in nuLiga.

**Column names** (case, spaces and special characters don't matter; per purpose the
**first** match found wins):

| Purpose | Required | Accepted column names |
|---|:---:|---|
| Date (+ time) | ✓ | `Termin`, `Datum`, `Date`, `Spieltermin` |
| Home team | ✓ | `HeimMannschaftName`, `HeimMannschaft`, `Heim`, `Home`, `Heimteam` |
| Away team | ✓ | `GastMannschaftName`, `GastMannschaft`, `Gast`, `Away`, `Gegner`, `Gastteam` |
| League / division | – | `Staffel` (else `Liga` / `League` / `Gruppe`, else `Meisterschaft`) |
| Season | – | `Saison`, `Season` |
| Home result | – | `ToreHeim`, `HeimLegs`, `HeimTore`, `HeimPunkte`, `HS`, `HeimScore` |
| Away result | – | `ToreGast`, `GastLegs`, `GastTore`, `GastPunkte`, `AS`, `GastScore` |
| Time | – | `Uhrzeit`, `Zeit`, `Time`, `Anwurf`, `Beginn` (else from `Termin`) |
| Venue | – | `Ort`, `Spielort`, `Location`, `Halle`, `Spielstätte`, `SpiellokalName`, `Spiellokal` |
| Detect own club (BDV) | – | `HeimVereinNr` / `GastVereinNr` (+ `…VereinName`, `…MannschaftNr`) |

> **Empty result = scheduled.** Empty score fields (or `0:0`) count as not yet played;
> rows with `spielfrei` / `Freilos` (bye) are skipped. Separators `;`, `,` or tab; umlauts
> (ANSI/Windows-1252 **or** UTF-8) are detected automatically by the import.

**Update from nuLiga:** If your association uses nuLiga, you can store the
**nuLiga group URL** on a league (edit the league). The **"Update from nuLiga"** button
then fetches other clubs' fixtures and your away results automatically — **your home
results from the Counter/manual entry take precedence** (the app shows discrepancies
as conflicts to resolve).

---

## 9. Calendar & Events

**Calendar** = month view + event list. Event types are color-coded: **Training,
League match, Club, Competition, Cup, Other**. Anyone who may
"manage events" (admin/captain) can create events: **title, date, time, type, venue**.

---

## 10. Darts Counter (Scoring a Match)

**Darts Counter** scores X01 matches (singles or team).

1. **Setup:** starting score (301/501/701/1001), **checkout mode** (Single / Double / Master
   Out), **best of legs** or **sets**, pick players/teams, "Who starts?" (including
   bull-off). *("Double In" is a hint only — not automatically enforced with pure
   score entry.)*
2. **Playing:** large score display; input via the **tablet keypad** or on a PC via the
   **keyboard** (F1–F8 = quick scores). Checkout suggestions are shown.
3. Finished matches are saved and feed into the **statistics**.

Admins, captains, players and board accounts may play — **viewers may not**.

---

## 11. Board/Kiosk Mode (for the Boards)

So no real admin/player logins hang around at the boards, there are **dedicated
board accounts** (minimal permissions, role *Board computer* — may only create
matches + read).

**Setup (one-time, technical):**
```
PB_URL=https://db.yourdomain.com PB_SU_EMAIL=… PB_SU_PASS=… \
BOARD_EMAIL=board1@yourdomain.com BOARD_PW=<strong-pw> \
node pocketbase/add-board-account.mjs
```

**How a board PC behaves:** When it signs in with a board account, the app
automatically starts in **locked kiosk mode** — only the tabs **Game / Training /
Settings**, no administration.

- Switch tabs: **Alt+S** (Game) · **Alt+T** (Training) · **Alt+E** (Settings)
- Leave the kiosk: **Alt+V** → a **captain or admin** signs in briefly. The
  **"Back to board"** button locks it again.

> A board account **cannot** leave the kiosk on its own — that's intentional.
> Rotate board passwords regularly (run the script again) and never write them
> down at the boards.

**Board starts on its own (optional):** so a board PC is ready to play the moment
it powers on, the club packages include autostart scripts that open the browser in
**full-screen kiosk** on the app address — `board-kiosk-chrome` / `board-kiosk-firefox`
(Windows `.bat`, Linux `.sh`). Run once per board PC (it asks for the app address).
Together with the **persistent board login** (only board accounts stay signed in
across a restart — admin/player logins do **not**) this means: **power on → ready to
play**, no signing in again. Leave the kiosk with Alt+F4.

### Phone as a Remote Control

When a board runs in kiosk mode, it can be controlled from a **phone** — handy if
a board's mouse/keyboard fails, or simply because standing at the PC is awkward.

- On the board, open **Settings → Einstellungen** (kiosk tab): a **"Handy als
  Fernbedienung koppeln"** panel shows a **QR code** and a short **pairing code**.
- A club member either **scans the QR**, or opens **`<board-address>/#/remote`** on
  the phone and **types the code** → the phone becomes the **scorer**: number pad,
  quick scores, undo, and match navigation. Sign in with a **club account** (only a
  club account may control a board).
- **Start menu:** when no game is running, the phone shows a compact **"new game"
  menu** — pick players from the roster and set the **game mode** (starting score,
  out mode, best of), then **"Start game"**. The throw-off ("who starts?", incl.
  bull-off) is chosen on the phone too. So a game does **not** have to be started at
  the board first.
- **Finish-dart prompt:** when a checkout has an ambiguous dart count, "finished with
  which dart?" (1/2/3) appears on the phone as well — so a game can be closed cleanly
  without a keyboard at the board.
- Only **one** phone controls a board at a time. If a second phone wants to take
  over, the **current** phone must confirm. (The QR stays valid even if the board
  reloaded in the meantime.)
- Toggle the whole feature under **Settings → Board computers → "Handy als
  Fernbedienung"** (club-wide, on by default). Board/club mode only.

### Public Live TV (watch without a login)

For a screen in the next room, there's a **login-free** watch link that shows the
current match(es) — one board full-screen, several as tiles.

- Turn it on under **Settings → Board computers → "Öffentlicher Zuschauer-TV"**
  (**off by default** — deliberately, so nothing is public on the internet unless
  you enable it). You get a **secret link + QR** to open on the TV/next-room screen.
- The link shows **only** board name and score — no personal data, and the pairing
  code that controls a board is never exposed.
- **"Neu generieren"** rotates the link (old links stop working immediately).
  Turning the switch off is an instant kill-switch. Use HTTPS on the internet.

---

## 12. X01 Tournament ("Round Robin")

A **training game** for a whole club night: an X01 tournament in **round-robin** format
(everyone vs everyone) for **3 to 8 players**, with a **final table**. Found in the **Training**
tab at the very top — the golden tile **"X01 – Jeder gegen Jeden"** (X01 Round Robin).

**Creating a tournament (setup):**

1. Give it a **name** (e.g. "Club night").
2. Pick the **players**: **3–8**.
3. Set the **game mode**: start score **301/501/701/1001**, **checkout mode** (Single / Double /
   Master Out), **Double In** (hint only), **legs per match** (Best of 1/3/5/7).
4. **Boards**: how many boards play at the same time (up to ⌊players ÷ 2⌋).
5. **"Start tournament"** generates the full **schedule** automatically (everyone vs everyone,
   split into rounds).

**The tournament dashboard** shows three things side by side:

- **Schedule** by rounds — each match with a "Play" button, live score, or result.
- **Table** — sorted by **wins**, then leg difference (2 points per win).
- **Highlights** — **180s**, **short legs** and **high finishes** across all matches.

A match is played in the normal **Darts Counter** (checkout suggestions, stats, etc.); afterwards
you return to the tournament automatically, the result is **recorded**, and the table updates.
Once all matches are played, the dashboard crowns the **winner** 🏆.

**Multiple boards at once (club mode):** With more than one board and enough **board PCs** ready
(see *Board/Kiosk Mode*), matches run **in parallel**:

- Each board PC shows its **assigned next match** by itself ("Start match") — the boards
  automatically get **different** pairings with no shared player.
- The match appears at the board like a league match (and on the **phone remote** / **spectator TV**).
- When it ends, the board advances to the **next** free match on its own, and the organiser's
  dashboard **updates live** — no reload needed.

> Tournament results stay **inside the tournament** (like the other training games) and do **not**
> feed the general match statistics. Reach past/running tournaments via the golden tile → **"Turniere"**.

---

## 13. Settings

The settings are organized into tabs (including **Usage mode · Input & Keys ·
Appearance · Aids & Display · Lists · Data**):

- **Usage mode:** switch between **Local** and **club mode** (per device; the same
  choice as at first start, §1). The admin maintains the **club name** and **logo** here.
  The **club name** also serves to **detect your teams during CSV import** (§8) —
  so set it correctly from the beginning.
- **Appearance:** accent color, theme (Midnight/Charcoal/Slate), font (Inter,
  Archivo, Rubik, Oswald, Space Grotesk), light/dark and **sizes** — score font as well as
  **statistics, player name and leg display size** (take effect directly in the Counter,
  per device).
- **Input & Keys:** quick-score keys (F1–F8), device type (PC/tablet).
- **Name sorting** (under "Lists"): sort people lists by **first** or **last name**.

> Some settings are **per device** (app mode, light/dark, sizes, device type,
> board/kiosk, name sorting, server address) — every PC/tablet/board keeps them for
> itself. Club-wide things (name, logo), on the other hand, apply everywhere.

---

## 14. Operations: Backups, Passwords, Updates

As a self-hoster you're also the operator. Keep an eye on three things regularly:

**Backups.** In PocketBase (`https://db.yourdomain.com/_/`) → **Settings → Backups**
enable automatic backups (ideally off-site, e.g. Hetzner Storage Box / S3) and
**test a restore occasionally**. All data lives in the `pb_data` volume.

**Forgotten password.** The **PocketBase superuser** is the emergency key:
1. Easiest way: open `…/_/` as superuser → collection **`users`** → open the account
   → set a new password.
2. Via script (sets the password + reactivates the account):
   ```
   PB_URL=https://db.yourdomain.com PB_SU_EMAIL=… PB_SU_PASS=… \
   USER_EMAIL=chairman@yourdomain.com NEW_PW="new-pw-min-8" \
   node pocketbase/reset-password.mjs
   ```
3. **Forgot the superuser password itself?** Reset it on the server via CLI:
   `./pocketbase superuser upsert <su-email> "<new-pw>" --dir ./pb_data`, then use way 1.

> Keep the **superuser password safe** (password manager) — it is your
> only way back in if you lock yourself out of the app.

**Updates.** Deploy the new app version and run the matching update script:
`update-club-lan.*` (LAN club package, swaps `pb_public/`, no restart), `update-server.sh`
(cloud, rebuilds + restarts the services) or `update-local.*` (local). Update the
PocketBase version deliberately (pin a fixed version instead of `:latest`).

---

## 15. Small FAQ

**I can't see "Leagues/Teams/Users".** You're in **local mode** or don't have
the required role. Check the mode in Settings; administration requires admin
(users/club) or admin/captain (players/teams/leagues).

**A member can't sign in.** The account may be **inactive** (§5) or the password is
wrong — reset it as admin in the user dialog.

**Statistics stay empty.** Make sure the account is **linked to a player**
and matches were played via the **Counter** (not just training).

**The board shows no administration.** Correct — board accounts are locked by design
(§11). Unlock with **Alt+V** and a captain/admin login.
