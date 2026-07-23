# DartsZentrale — Handbuch für Vereins-Admins

**🇩🇪 Deutsch | [🇬🇧 English](../manual.md)**

Dieses Handbuch erklärt, **wie ihr DartsZentrale im Alltag nutzt** — von der Anmeldung
über Spieler, Mannschaften, Ligen und den Darts Counter bis zu Board-Rechnern und
Datensicherung. Es ist bewusst nicht-technisch gehalten.

> **Du willst die App erst zum Laufen bringen?** Die **Inbetriebnahme-Anleitung** liegt im
> `docs/de/`-Ordner deines Pakets — je nach Betriebsart:
> - **lokal, ein Board** → `anleitung-lokal-windows.md` bzw. `anleitung-lokal-linux.md`
> - **Vereinsmodus im LAN** → `admin-anleitung-lan-windows.md` bzw. `admin-anleitung-lan-linux.md`
> - **Cloud** → `admin-anleitung-cloud.md` (ein Skript richtet den Server ein)
>
> Dieses Handbuch beginnt da, wo die App bereits läuft.

---

## 1. Zwei Betriebsmodi

DartsZentrale kann auf zwei Arten laufen:

| Modus | Wofür | Login? | Server nötig? |
|-------|-------|--------|---------------|
| **Lokal** | Ein Gerät am Board, schnelles Zählen, kein Verein | nein | nein |
| **Verein** | Mehrere Geräte, echte Logins, Ligen, Mannschaften, Benutzer | ja | ja (PocketBase) |

Im **lokalen Modus** sind alle Funktionen offen (ein Gerät, ein Nutzer) — Ligen,
Mannschaften und Benutzerverwaltung sind ausgeblendet. Der **Vereinsmodus** bringt
Anmeldung, Rollen und die volle Verwaltung. Dieses Handbuch beschreibt vor allem den
Vereinsmodus.

**Beim allerersten Start** fragt jedes Gerät, ob es **Lokal** oder im **Vereinsmodus**
laufen soll. Die Wahl merkt sich das Gerät; ändern kannst du sie jederzeit in
**Einstellungen → Nutzungsart** (der Modus ist gerätelokal, also nicht vereinsweit).

---

## 2. Zwei verschiedene Logins — nicht verwechseln!

Es gibt **zwei getrennte Konten-Welten**:

| | **App-Login** | **PocketBase-Admin (Superuser)** |
|---|---|---|
| Wofür | normale Nutzung der App | Server-/Datenbank-Verwaltung |
| Wo | `https://app.deinverein.de` | `https://db.deinverein.de/_/` |
| Beispiel | `vorstand@deinverein.de`, Rolle *Admin* | dein PocketBase-Superuser |

- Den **App-Admin** brauchst du jeden Tag — damit verwaltest du Verein, Spieler,
  Mannschaften, Ligen und Benutzer.
- Den **PocketBase-Superuser** brauchst du selten — für Backups, Servereinstellungen
  und als **Notfall-Schlüssel**, falls ein App-Passwort vergessen wurde (siehe §13).

---

## 3. Anmelden

1. `https://app.deinverein.de` öffnen.
2. E-Mail + Passwort eines aktiven App-Kontos eingeben → **Anmelden**.
3. Tipp: in Edge/Chrome **„Als App installieren"** (PWA) — DartsZentrale liegt dann wie ein
   Programm auf dem Desktop/Startbildschirm.

Die Sitzung bleibt bestehen, bis du dich abmeldest (Konto-Karte unten in der Seitenleiste).
**Selbst-Registrierung ist aus Sicherheitsgründen deaktiviert** — neue Konten legt
immer ein Admin an (§5).

---

## 4. Rollen & Rechte

Jedes App-Konto hat genau eine Rolle. Sie entscheidet, was sichtbar und erlaubt ist:

| Rolle | Farbe | Darf … |
|-------|-------|--------|
| **Administrator** | rot | alles: Verein, Benutzer, Einstellungen + alles darunter |
| **Kapitän** | gold | Spieler, Mannschaften, Ligen, Termine verwalten + spielen |
| **Spieler** | grün | spielen (Counter/Training), eigene Statistik & Termine sehen |
| **Betrachter** | blau | nur lesen (Spielpläne, Tabellen) |
| **Board-Rechner** | grau | Maschinen-Konto: nur spielen, nichts verwalten (siehe §11) |

Detaillierte Matrix:

| Fähigkeit | Admin | Kapitän | Spieler | Betrachter |
|-----------|:-----:|:-------:|:-------:|:----------:|
| Benutzer verwalten | ✓ | – | – | – |
| Verein/Einstellungen (Modus, Name, Logo) | ✓ | – | – | – |
| Spieler verwalten | ✓ | ✓ | – | – |
| Mannschaften verwalten | ✓ | ✓ | – | – |
| Ligen & Ergebnisse | ✓ | ✓ | – | – |
| Termine verwalten | ✓ | ✓ | – | – |
| Spielen (Counter/Training) | ✓ | ✓ | ✓ | – |

> Die Rechte werden **serverseitig** durchgesetzt (PocketBase-API-Regeln) — die
> ausgeblendeten Knöpfe sind nur die Oberfläche dazu.

> **Anlegen/Löschen großer Strukturen ist Admin-Sache.** Kapitäne pflegen Mannschaften,
> Aufstellungen und Ergebnisse, aber **Mannschaften, Ligen und Saisons löschen** sowie
> **Ligen und Saisons neu anlegen** darf nur ein **Admin**. So kann ein einzelnes
> Kapitänskonto nicht versehentlich den ganzen Vereinsbestand verändern. Außerdem ist jedes
> gezählte Spiel an seinen **Ersteller** gebunden — korrigieren darf es der Admin oder wer
> es eingetragen hat.

Die Rolle **Board-Rechner** lässt sich nicht von Hand vergeben; sie gehört fest zu
dedizierten Board-Konten (§11).

---

## 5. Benutzer verwalten (nur Admin)

**Benutzer** in der Seitenleiste → Übersicht aller Konten (gesamt / aktiv / mit Spieler
verknüpft) + Tabelle.

**Neuen Benutzer anlegen:** „+ Benutzer" → im Dialog:
- **Vorname + Nachname**, **E-Mail**, **Anmeldepasswort** (mind. 8 Zeichen).
- **Position im Verein** (optional, Freitext: z. B. „1. Vorsitzender").
- **Rolle** wählen (§4).
- **Avatar-Farbe** und – nach dem Speichern – optional ein **Profilfoto**.
- **Mit Spieler verknüpfen** (optional): verbindet das Konto mit einem Eintrag aus der
  Spielerliste, damit Statistiken dem richtigen Spieler zugeordnet werden. Ein Konto
  kann höchstens einen Spieler haben; bereits verknüpfte Spieler werden ausgeblendet.
- **Mannschaft & Kapitänsamt** (neu): Sobald ein Spieler verknüpft ist und die Rolle
  *Spieler* oder *Kapitän* gewählt wurde, kannst du den Spieler hier direkt einer oder
  mehreren **Mannschaften** (Liga + Pokal) zuordnen. Bei Rolle *Kapitän* wird er
  zugleich **Kapitän** der gewählten Mannschaft(en).
  > Die Auswahl ist die **vollständige** Zugehörigkeit: nimmst du den Haken weg, wird
  > der Spieler aus dieser Mannschaft entfernt. Bei Rolle *Admin/Betrachter* wird die
  > Mannschaftszuordnung nicht angefasst.
- **Aktiv-Schalter**: deaktivierte Konten können sich nicht anmelden (statt zu löschen).

**Bearbeiten:** Stift in der Zeile. Passwort leer lassen = unverändert. Als Admin kannst
du das Passwort jedes Kontos zurücksetzen (das Feld einfach neu ausfüllen).

> **Tipp:** Leg dir früh **einen zweiten Admin** an — dann sperrt dich ein vergessenes
> Passwort nicht aus.

---

## 6. Spieler

**Spieler** = die sportliche Personenliste. Sie ist die **einzige Quelle** für Kader,
Aufstellungen und Statistiken; Login-Konten sind davon getrennt (ein Konto *verweist*
optional auf einen Spieler).

- Kartenraster mit Avatar, Name, Nickname/Spielanzahl, Ø 3-Dart und Siegen.
- „+ Spieler" / Stift (Admin/Kapitän): **Name**, **Kürzel** (max. 3 Zeichen),
  Avatar-Farbe, optional Foto.
- Klick auf eine Karte → **Spieler-Detail** mit Scoring (60+/100+/140+/180),
  Form-Verlauf und letzten Spielen.

Nicht jeder Spieler braucht ein Login-Konto (z. B. Jugend-/Gastspieler), und nicht jedes
Konto braucht ein Spielerprofil (z. B. Vorstand ohne Spielbetrieb).

---

## 7. Mannschaften

**Mannschaften** = Vereinsteams, deren Kader aus der Spielerliste gebildet wird.

- Es gibt **Liga-Mannschaften** (grün) und **Pokalmannschaften** (gold). Ein Spieler
  darf gleichzeitig in **einer Liga- und einer Pokalmannschaft** stehen.
- „+ Mannschaft" / „Bearbeiten": **Name**, **Liga** (Freitext), **Art** (Liga/Pokal),
  **Kader** per Häkchen aus der Spielerliste, **Kapitän** (Stern) und bis zu **zwei
  Ersatzkapitäne**.
- Pro Mannschaft: links der **Kader** (Kapitän mit „C"-Badge, Ø 3-Dart), rechts die
  **Aufstellung** für den nächsten Spieltag.

> Kader lassen sich **auch beim Benutzer anlegen** befüllen (§5) — beide Wege schreiben
> dieselbe Mannschaft.

---

## 8. Ligen

**Ligen** verwalten Spielpläne und berechnen die Tabelle.

- „+ Liga": **Name**, **Saison**, Teilnehmer-Mannschaften (eigene per „Eigene"-Toggle
  markieren) und das **Spielformat** (Vorlagen: **Bayernliga** = 8 Einzel + 4 Doppel,
  **Landesliga** = 6 Einzel · 3 Doppel · 6 Einzel).
- **Tabelle** (berechnet): `Sp · S · U · N · Diff · Pkt`. Punkte **2/1/0**
  (Sieg/Unentschieden/Niederlage), Sortierung Punkte → Legdifferenz → erzielte Legs →
  Name. Eigene Mannschaft grün hervorgehoben, Top 2 grün, Letzter rot.
- **Begegnungen:** „+ Begegnung" → Heim/Gast, Datum. Ergebnis über das **Ergebnis-Modal**
  (Leg-Stand `Heim : Gast`); die Tabelle rechnet sofort neu.
- **Aufstellung** je eigener Begegnung frei zusammenstellen (Einzel/Doppel in realer
  Reihenfolge, plus geordnete Ersatzliste).

### Spielplan importieren (CSV)

Statt jede Begegnung von Hand anzulegen, lässt sich ein **Verbands-Spielplan als CSV**
einlesen (Ligen → **„Spielplan importieren"**). Aus jeder **Staffel** wird eine Liga, eure
Mannschaften werden markiert und eure Begegnungen zusätzlich als **Kalender-Termine** angelegt.
Erneuter Import aktualisiert nur Ergebnisse — nichts wird doppelt angelegt. Über **„Vorlage
herunterladen"** gibt es eine ausgefüllte Beispieldatei zum Nachbauen (reiner Handbetrieb).

**Eure Mannschaften werden automatisch erkannt** — auf zwei Wegen:

- **BDV-/nuLiga-Export** (mit Vereinsnummer-Spalten): der am häufigsten vorkommende Verein gilt
  als eurer — das greift auch bei **Fantasienamen** (z. B. „Manuka" im Pokal).
- **Einfache/manuelle CSV** (ohne Vereinsnummern): Abgleich über den **Vereinsnamen aus den
  Einstellungen** (§12). Darum den Vereinsnamen dort korrekt pflegen und die Teamnamen so
  wählen, dass sie ihn enthalten (z. B. „DC Beispiel", „DC Beispiel II").

**Pokal:** Enthält der **Staffel-** oder **Saisonname** „Pokal" oder „Cup", wird der Wettbewerb
als **K.-o.** angelegt (keine Tabelle, nur Begegnungen). **Mannschaftsnamen:** die 1. Mannschaft
**ohne Zusatz**, ab der 2. mit „II"/„III" … — genau wie bei nuLiga.

**Spaltennamen** (Groß-/Kleinschreibung, Leer- und Sonderzeichen egal; je Zweck zählt der
**erste** gefundene Treffer):

| Zweck | Pflicht | Erlaubte Spaltennamen |
|---|:---:|---|
| Datum (+ Uhrzeit) | ✓ | `Termin`, `Datum`, `Date`, `Spieltermin` |
| Heimmannschaft | ✓ | `HeimMannschaftName`, `HeimMannschaft`, `Heim`, `Home`, `Heimteam` |
| Gastmannschaft | ✓ | `GastMannschaftName`, `GastMannschaft`, `Gast`, `Away`, `Gegner`, `Gastteam` |
| Liga / Staffel | – | `Staffel` (sonst `Liga` / `League` / `Gruppe`, sonst `Meisterschaft`) |
| Saison | – | `Saison`, `Season` |
| Ergebnis Heim | – | `ToreHeim`, `HeimLegs`, `HeimTore`, `HeimPunkte`, `HS`, `HeimScore` |
| Ergebnis Gast | – | `ToreGast`, `GastLegs`, `GastTore`, `GastPunkte`, `AS`, `GastScore` |
| Uhrzeit | – | `Uhrzeit`, `Zeit`, `Time`, `Anwurf`, `Beginn` (sonst aus `Termin`) |
| Spielort | – | `Ort`, `Spielort`, `Location`, `Halle`, `Spielstätte`, `SpiellokalName`, `Spiellokal` |
| Eigenen Verein erkennen (BDV) | – | `HeimVereinNr` / `GastVereinNr` (+ `…VereinName`, `…MannschaftNr`) |

> **Ergebnis leer = geplant.** Leere Tore-Felder (oder `0:0`) gelten als noch nicht gespielt;
> Zeilen mit `spielfrei` / `Freilos` werden übersprungen. Trennzeichen `;`, `,` oder Tab; Umlaute
> (ANSI/Windows-1252 **oder** UTF-8) erkennt der Import automatisch.

**Aus nuLiga aktualisieren:** Nutzt euer Verband nuLiga, könnt ihr an einer Liga die
**nuLiga-Gruppen-URL** hinterlegen (Liga bearbeiten). Der Button **„Aus nuLiga aktualisieren"**
holt dann fremde Begegnungen und Auswärtsergebnisse automatisch — **eure Heim-Ergebnisse aus
Counter/manuell behalten Vorrang** (Abweichungen zeigt die App als Konflikt zum Auflösen).

---

## 9. Kalender & Termine

**Kalender** = Monatsansicht + Terminliste. Termin-Typen sind farbcodiert: **Training,
Ligaspiel, Verein, Competition, Pokal, Sonstiges**. Termine anlegen darf, wer
„Termine verwalten" darf (Admin/Kapitän): **Titel, Datum, Uhrzeit, Typ, Ort**.

---

## 10. Darts Counter (Spiel zählen)

**Darts Counter** zählt X01-Spiele (Einzel oder Mannschaft).

1. **Setup:** Startscore (301/501/701/1001), **Auscheck-Modus** (Single / Double / Master
   Out), **Best of Legs** oder **Sätze**, Spieler/Teams wählen, „Wer beginnt?" (auch
   Ausbullen). *(„Double In" ist nur ein Hinweis — bei reiner Punkteingabe nicht automatisch
   geprüft.)*
2. **Spielen:** große Score-Anzeige; Eingabe per **Tablet-Tastenfeld** oder am PC per
   **Tastatur** (F1–F8 = Schnellscores). Checkout-Vorschläge werden eingeblendet.
3. Abgeschlossene Spiele werden gespeichert und fließen in die **Statistiken** ein.

Spielen dürfen Admin, Kapitän, Spieler und Board-Konten — **Betrachter nicht**.

---

## 11. Board-/Kiosk-Modus (für die Bretter)

Damit an den Brettern keine echten Admin-/Spieler-Logins hängen, gibt es **dedizierte
Board-Konten** (rechtearm, Rolle *Board-Rechner* — dürfen nur Spiele anlegen + lesen).

**Einrichten (einmalig, technisch):**
```
PB_URL=https://db.deinverein.de PB_SU_EMAIL=… PB_SU_PASS=… \
BOARD_EMAIL=board1@deinverein.de BOARD_PW=<starkes-pw> \
node pocketbase/add-board-account.mjs
```

**So verhält sich ein Board-PC:** Meldet er sich mit einem Board-Konto an, startet die
App automatisch im **gesperrten Kiosk-Modus** — nur die Tabs **Spiel / Training /
Einstellungen**, keine Verwaltung.

- Tab wechseln: **Alt+S** (Spiel) · **Alt+T** (Training) · **Alt+E** (Einstellungen)
- Kiosk verlassen: **Alt+V** → ein **Kapitän oder Admin** meldet sich kurz an. Über den
  Button **„Zurück zum Board"** wird wieder gesperrt.

> Ein Board-Konto kann den Kiosk **nicht selbst** verlassen — das ist Absicht.
> Board-Passwörter regelmäßig wechseln (Skript erneut ausführen) und nie an den Brettern
> notieren.

**Board startet von selbst (optional):** Damit ein Board-PC beim Einschalten direkt spielbereit ist,
liegen in den Vereins-Paketen Autostart-Skripte, die den Browser im **Vollbild-Kiosk** auf die
App-Adresse öffnen — `board-kiosk-chrome` / `board-kiosk-firefox` (Windows als `.bat`, Linux als `.sh`).
Einmal pro Board-PC ausführen (das Skript fragt die App-Adresse). Zusammen mit der **dauerhaften
Board-Anmeldung** (nur Board-Konten bleiben über einen Neustart eingeloggt — Admin-/Spieler-Logins
**nicht**) heißt das: **einschalten → sofort spielbereit**, ohne erneutes Anmelden. Kiosk verlassen:
Alt+F4.

### Handy als Fernbedienung

Läuft ein Board im Kiosk-Modus, lässt es sich von einem **Handy** steuern — praktisch, wenn Maus/
Tastatur am Board ausfallen, oder einfach als bequeme Bedienung vom Sitzplatz.

- Am Board **Einstellungen** öffnen (Kiosk-Tab): Das Panel **„Handy als Fernbedienung koppeln"** zeigt
  einen **QR-Code** und einen kurzen **Kopplungscode**.
- Ein Vereinsmitglied **scannt den QR** oder öffnet **`<board-adresse>/#/remote`** am Handy und **tippt
  den Code** → das Handy wird zum **Anschreiber**: Zifferntastatur, Schnellscores, Undo und Navigation.
  Dabei meldet man sich mit einem **Vereinskonto** an (nur ein Vereinskonto darf ein Board steuern).
- **Startmenü:** Läuft gerade kein Spiel, zeigt das Handy ein kompaktes **„Neues Spiel"-Menü** — Spieler
  aus dem Kader wählen und den **Spielmodus** einstellen (Startpunkte 301/501/701/1001, Out-Modus, Best
  of), dann **„Spiel starten"**. Den Anwurf („Wer beginnt?", inkl. Ausbullen) wählt man ebenfalls am
  Handy. Ein Spiel muss also **nicht** erst am Board gestartet werden.
- **Finish-Dart-Abfrage:** Fällt ein Checkout mit mehrdeutiger Dartzahl, erscheint „Mit welchem Dart
  beendet?" (1/2/3) auch am Handy — so lässt sich ein Spiel ganz ohne Board-Tastatur sauber abschließen.
- Immer nur **ein** Handy steuert ein Board. Will ein zweites übernehmen, muss das **aktuelle** Handy
  bestätigen. (Der QR bleibt gültig, auch wenn das Board zwischendurch neu geladen hat.)
- Die ganze Funktion an-/ausschalten unter **Einstellungen → Board-Rechner → „Handy als Fernbedienung"**
  (vereinsweit, standardmäßig an). Nur im Board-/Vereinsmodus.

### Öffentlicher Zuschauer-TV (ohne Anmeldung)

Für einen Bildschirm im Nebenraum gibt es einen **login-freien** Zuschauer-Link, der das/die laufende(n)
Spiel(e) zeigt — ein Board im Vollbild, mehrere als Kacheln.

- Einschalten unter **Einstellungen → Board-Rechner → „Öffentlicher Zuschauer-TV"** (**standardmäßig
  aus** — bewusst, damit im Internet nichts öffentlich ist, solange du es nicht aktivierst). Du bekommst
  einen **geheimen Link + QR** für den TV/Nebenraum-Bildschirm.
- Der Link zeigt **nur** Boardname und Spielstand — keine persönlichen Daten, und der Kopplungscode
  eines Boards wird nie preisgegeben.
- **„Neu generieren"** rotiert den Link (alte Links sind sofort ungültig). Den Schalter auszuschalten
  ist ein sofortiger Not-Aus. Im Internet HTTPS verwenden.

---

## 12. Einstellungen

Die Einstellungen sind in Reiter gegliedert (u. a. **Nutzungsart · Eingabe & Tasten ·
Darstellung · Hilfen & Anzeige · Listen · Daten**):

- **Nutzungsart:** zwischen **Lokal** und **Vereinsmodus** umschalten (gerätelokal; dieselbe
  Wahl wie beim Erst-Start, §1). **Vereinsname** und **Logo** pflegt hier der Admin. Der
  **Vereinsname** dient zugleich der **Erkennung eurer Mannschaften beim CSV-Import** (§8) —
  darum von Anfang an korrekt setzen.
- **Darstellung:** Akzentfarbe, Theme (Midnight/Charcoal/Slate), Schrift (Inter,
  Archivo, Rubik, Oswald, Space Grotesk), Hell/Dunkel und **Größen** — Score-Schrift sowie
  **Statistik-, Spielername- und Leg-Anzeige-Größe** (wirken direkt im Counter, pro Gerät).
- **Eingabe & Tasten:** Schnellscore-Tasten (F1–F8), Geräteart (PC/Tablet).
- **Namens-Sortierung** (unter „Listen"): Personenlisten nach **Vor-** oder **Nachname**.

> Manche Einstellungen sind **gerätelokal** (App-Modus, Hell/Dunkel, Größen, Geräteart,
> Board-/Kiosk, Namens-Sortierung, Serveradresse) — jeder PC/Tablet/Board hält sie für
> sich. Vereinsweite Dinge (Name, Logo) gelten dagegen überall gleich.

---

## 13. Betrieb: Backups, Passwörter, Updates

Als Self-Hoster bist du auch der Betreiber. Drei Dinge regelmäßig im Blick behalten:

**Backups.** In PocketBase (`https://db.deinverein.de/_/`) → **Settings → Backups**
automatische Sicherungen aktivieren (ideal extern, z. B. Hetzner Storage Box / S3) und
**gelegentlich einen Restore testen**. Alle Daten liegen im Volume `pb_data`.

**Passwort vergessen.** Der **PocketBase-Superuser** ist der Notfall-Schlüssel:
1. Einfachster Weg: `…/_/` als Superuser öffnen → Collection **`users`** → Konto öffnen
   → neues Passwort setzen.
2. Per Skript (setzt Passwort + reaktiviert das Konto):
   ```
   PB_URL=https://db.deinverein.de PB_SU_EMAIL=… PB_SU_PASS=… \
   USER_EMAIL=vorstand@deinverein.de NEW_PW="neues-pw-min-8" \
   node pocketbase/reset-password.mjs
   ```
3. **Superuser-Passwort selbst vergessen?** Auf dem Server per CLI neu setzen:
   `./pocketbase superuser upsert <su-email> "<neues-pw>" --dir ./pb_data`, dann Weg 1.

> Bewahre das **Superuser-Passwort sicher** auf (Passwort-Manager) — es ist dein
> einziger Rückweg, wenn du dich aus der App aussperrst.

**Updates.** Neue App-Version einspielen und das passende Update-Skript ausführen:
`update-club-lan.*` (LAN-Vereinspaket, tauscht `pb_public/`, kein Neustart), `update-server.sh`
(Cloud, baut neu + startet die Dienste) oder `update-local.*` (lokal). PocketBase-Version
kontrolliert aktualisieren (feste Version statt `:latest`).

---

## 14. Kleine FAQ

**Ich sehe „Ligen/Mannschaften/Benutzer" nicht.** Du bist im **lokalen Modus** oder hast
nicht die nötige Rolle. Modus in den Einstellungen prüfen; Verwaltung brauchen Admin
(Benutzer/Verein) bzw. Admin/Kapitän (Spieler/Teams/Ligen).

**Ein Mitglied kann sich nicht anmelden.** Konto evtl. **inaktiv** (§5) oder falsches
Passwort — als Admin im Benutzer-Dialog zurücksetzen.

**Statistiken bleiben leer.** Stelle sicher, dass das Konto **mit einem Spieler
verknüpft** ist und über den **Counter** gespielt wurde (nicht nur Training).

**Board zeigt keine Verwaltung.** Korrekt — Board-Konten sind absichtlich gesperrt
(§11). Mit **Alt+V** und Kapitän-/Admin-Login entsperren.
