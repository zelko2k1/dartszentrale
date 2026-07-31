# Changelog

Alle nennenswerten Änderungen an DartsZentrale werden hier festgehalten.

Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

## [Unveröffentlicht]

### Hinzugefügt
- **Aussagekräftigere Spieler-Statistik.** Neu im Spieler-Detail: eine **Kopf-an-Kopf-Bilanz** je
  Gegner, **Filter** nach Spieltyp (Startpunktzahl) und Wettbewerb (Liga/Frei), eine **umschaltbare
  Formkurve** (Ø · Checkout-% · First-9 · 180er) und die Kennzahl **„Darts geworfen"**.
- **Trainings-Verlauf je Modus.** Bisher merkte sich das Training nur den Bestwert; jetzt wird jedes
  wertbare Ergebnis mitgeschrieben (die letzten 40 je Modus) und im Spieler-Detail als Karte
  **„Trainings-Verlauf"** neben dem Bestwert gezeigt. Läuft im bestehenden Datenfeld — **keine
  Schema-Änderung an PocketBase nötig**, im Vereinsmodus synchronisiert es sich wie gewohnt.
- **Vollständig englische Oberfläche.** Rund 950 bislang fest deutsche Textstellen sind übersetzt;
  ein neuer Prüfer in der CI hält das dauerhaft grün, damit künftige Bildschirme nicht wieder
  einsprachig einreißen.
- **Einheitliche Leerzustände.** Statt lieblosem „Noch keine …" jetzt Icon, Text und — wo es hilft —
  die passende Aktion gleich daneben: Dashboard-Widgets, Statistik beim Erststart, Handy-Agenda.

### Geändert
- **Der 3-Dart-Schnitt wird jetzt echt gerechnet — eure Zahlen verschieben sich gegenüber 1.0.9.**
  Bisher galt Punkte/Aufnahme, jetzt Punkte/Darts × 3. Damit zählen **effiziente Checkouts mit ein
  oder zwei Darts** endlich richtig. Zusätzlich wird der Lebenszeit-Schnitt (Ø 3-Dart, First-9)
  **nach geworfenen Darts gewichtet** statt als Mittel der Match-Mittel — eine Drei-Aufnahmen-Partie
  wiegt nicht mehr so schwer wie ein volles Match. Wirkt überall: Statistik, Spieler-Detail,
  Dashboard-Bestenliste, Mannschafts-Ø. Alte Matches ohne erfasste Dartzahl fallen sauber auf die
  bisherige Rechnung zurück.
- **Barrierefreiheit und Farben über alle sechs Themes.** Kein Farbpaar bleibt mehr unter der
  AA-Schwelle (vorher 79), der schlechteste Primärbutton stieg von 1,97:1 auf 9,47:1, und der
  Fokus-Ring ist in jedem Preset erkennbar (vorher in 8 von 10 Hell-Presets unbrauchbar). Dazu eine
  echte Überschriften-Gliederung und Live-Bereiche, die Änderungen ansagen.
- **44 Pixel Touch-Fläche sind jetzt garantiert, nicht mehr optional.** Die Regel galt an 13 von 309
  Schaltflächen; jetzt erbt sie **jedes** Bedienelement, sobald ein grober Zeiger im Spiel ist
  (Board-Tablet, Handy). An der Maus bleibt die Oberfläche so kompakt wie bisher. Ergänzend passen
  sich nun auch **Spieler-, Benutzer- und Einstellungs-Bildschirm** am Handy an — die restlichen
  Verwaltungsbildschirme taten das schon.
- **Zuschauer-TV, Handy-Fernbedienung und Board-Overlay folgen den Themes.** Diese Flächen trugen
  102 eigene Farbwerte und lagen damit außerhalb jeder Kontrastprüfung — ein Theme-Wechsel ging an
  ihnen vorbei. Jetzt nutzen sie dieselben Farb-Token wie der Rest, und der Prüfer erfasst sie mit.
- **Die Anmeldung lässt sich nicht mehr doppelt abschicken.** Bei aktivem 2FA konnte schnelles
  Doppelklicken mehrere Anmeldeversuche auslösen, ohne dass etwas sichtbar passierte. Der Knopf
  zeigt jetzt „Anmelden …" und sperrt, bis die Antwort da ist.
- **Kleinere App, schnellerer Start.** Das ausgelieferte Paket schrumpft von 2,0 MB auf 1,5 MB.
- **Betreiber-Hinweis: Konto-Adressen sind Pflicht-Umgebungsvariablen.** Die Skripte unter
  `pocketbase/` haben keine eingebauten Vorgabe-Adressen mehr (auch `setup-cloud.sh` fragt ohne
  Default). Wer sie benutzt, setzt jetzt `PB_SU_EMAIL`, `USER_EMAIL` bzw. `BOARD_EMAIL` — sonst
  bricht das Skript mit einer Anleitung ab, statt still ein Konto mit falscher Adresse anzulegen.
  Am bequemsten einmalig in `pocketbase/.env.local` hinterlegen.

### Behoben
- **Der login-freie Zuschauer-TV hat noch nie funktioniert.** Der Server sortierte die laufenden
  Spiele nach einem Feld, das für diese Daten gar nicht angelegt wird — jede Abfrage mit gültigem
  Zugangslink brach ab, auch wenn überhaupt kein Spiel lief. **Wichtig beim Update:** der Fix liegt
  im Server-Teil (`pocketbase/pb_hooks/`), das reine Frontend-Update-Paket enthält ihn also **nicht**.
  Im LAN-Bundle dafür den kompletten Ordner ersetzen und `pb_data` behalten; unter Docker/Arcane neu
  bauen und ausrollen.
- **Erststart im Vereinsmodus (LAN) bricht nicht mehr stumm ab.** Konnte PocketBase beim
  Einrichten nicht starten oder die Anmeldung des Konsolenkontos nicht gelingen, endete
  `start-club-lan` ohne Meldung — der im Hintergrund gestartete Server lief weiter und belegte
  den Port, und weil `pb_data` bereits angelegt war, übersprang jeder weitere Start die
  Einrichtung: die Installation blieb ohne App-Admin zurück, ohne je wieder zu fragen. Jetzt
  wird ein belegter Port **vorher** erkannt, jeder Abbruch räumt den halbfertigen Zustand auf
  und meldet ihn im Klartext, sodass der nächste Start wieder sauber nach den Konten fragt.
- **Zu kurzes Superuser-Passwort scheitert bei der Cloud-Einrichtung sofort statt spät.**
  `setup-cloud.sh` verlangt jetzt schon bei der Eingabe die von PocketBase geforderten
  8 Zeichen und prüft das Anlegen des Superusers anhand der Ausgabe — die PocketBase-CLI
  meldet Fehler auf der Standardausgabe und liefert trotzdem den Rückgabewert 0, weshalb ein
  abgelehntes Passwort bisher erst viel später beim Schema-Schritt aufgefallen wäre.

## [1.0.9] – 2026-07-28

## [1.0.8] – 2026-07-26

## [1.0.7] – 2026-07-24

## [1.0.6] – 2026-07-24

## [1.0.5] – 2026-07-23

### Hinzugefügt
- **Neues Trainingsspiel „X01 – Jeder gegen Jeden" (Round-Robin-Turnier).** Ein X01-Turnier für
  **3–8 Spieler**, jeder gegen jeden, mit **Abschlusstabelle** (nach Siegen, dann Leg-Differenz) und
  **Highlights** (180er, Short Legs, High Finishes). Im Reiter **Training** über die goldene Kachel.
  Setup mit Startpunkten (301/501/701/1001), Auscheck-Modus, Double-In-Hinweis, Legs je Partie und
  **Board-Anzahl**. Jede Partie wird ganz normal im **Counter** gespielt; das Ergebnis fließt automatisch
  zurück ins Turnier. Bei **mehreren Boards** laufen Partien **parallel**: jeder Board-PC zeigt von selbst
  seine zugewiesene Paarung („Partie starten"), spielt sie wie ein Ligaspiel (inkl. Board-Anzeige,
  Handy-Fernbedienung, Zuschauer-TV), schaltet danach automatisch zur nächsten freien Partie weiter, und
  das Organisator-Dashboard aktualisiert sich laufend. Server-seitig über eine neue `tournaments`-Collection
  synchronisiert (Multi-Board-fähig). Ergebnisse bleiben im Turnier (nicht in der allgemeinen Statistik).

## [1.0.4] – 2026-07-23

### Hinzugefügt
- **Startmenü auf der Fernbedienung.** Läuft am Board kein Spiel, zeigt das Handy jetzt ein kompaktes
  „Neues Spiel"-Menü statt nur eines Start-Knopfes: zwei Zeilen für die Spieler (antippen → aus dem
  Vereinskader wählen, vorbelegt mit „Spieler 1/2") und eine Zeile für den Spielmodus (antippen →
  Startpunkte 301/501/701/1001, Out-Modus Double/Master/Single, Double-In, Best of Legs/Sets). „Neues
  Spiel starten" beginnt damit direkt; den Anwurf („Wer beginnt?", inkl. Ausbullen) wählt man wie
  gehabt am Handy. Damit verschwinden auch die früheren Demo-Platzhalter aus der Leerlauf-Ansicht.
- **Finish-Dart-Abfrage auch am Handy.** Fällt ein Checkout, bei dem die Dartzahl mehrdeutig ist
  („Mit welchem Dart beendet?"), erschien die Abfrage bisher nur am Board — ohne Tastatur am Board
  ließ sich das Spiel vom Handy nicht sauber abschließen. Jetzt erscheint sie auch auf der
  Fernbedienung (1/2/3, unterhalb der möglichen Mindestzahl gesperrt, „Zurück" nimmt zurück).

### Geändert
- **Angemeldet bleiben nur noch Board-Konten.** Über einen Rechner-Neustart hinweg bleibt jetzt nur
  ein **Board-Konto** eingeloggt (Kiosk-Rechner sollen sofort weiterlaufen). Alle anderen Konten
  (Admin, Kapitän, Spieler …) müssen sich nach jedem App-Start neu anmelden — so bleibt ein
  Admin-Login auf einem geteilten Board-PC nicht ungewollt „hängen". Nur im Vereinsmodus relevant.
- **Fernbedienung, kleinere Verbesserungen:** „Neues Spiel starten" heißt im Startmenü jetzt kurz
  „Spiel starten"; die Knöpfe „Neues Spiel" und „Abbruch" während des Spiels sind größer und besser
  lesbar. Der Knopf „Zum Dashboard" nach Spielende heißt überall nur noch „Dashboard".
- **Anwurf-Auswahl „Zufall" entfernt.** Bei zwei Spielern brachte das Auslosen des Anwurfs keinen
  Mehrwert (man wählt ohnehin direkt Spieler 1/2 oder Ausbullen) — die Option ist am Board und auf der
  Fernbedienung entfallen.
- Das **„Neues Spiel starten?"-Overlay** ist jetzt vollständig per Tastatur bedienbar (wie „Spiel
  abbrechen?"): ← → wechseln die Auswahl, Enter bestätigt die markierte Schaltfläche, Esc = weiterspielen.
  Der Fokus steht anfangs auf „Weiterspielen", damit ein versehentliches Enter das Spiel nicht verwirft.
- Im „Wer beginnt?"-Overlay am Board waren die **Spielernamen schwer lesbar** (dunkle Schrift auf
  dunklem Knopf) — sie erscheinen jetzt in heller Schrift wie die übrigen Knöpfe.
- Die **Saison-Auswahl in der Spieler-Statistik** erscheint nur noch im Vereinsmodus — im lokalen
  Einzelboard-Betrieb gibt es keine Saisons.
- **Fernbedienung am Handy:** Die Bedienoberfläche passt sich jetzt auf jedes Handy ein — sie füllt
  genau den Bildschirm, ohne zu scrollen. Vorher rutschten „Enter" und „Undo" auf kleineren Geräten
  unter den sichtbaren Bereich. Neu außerdem: Querformat als Zwei-Spalten-Ansicht (Stand links,
  Tastenfeld rechts), Druck-Feedback und kurze Vibration beim Tippen, kein versehentliches Zoomen
  oder Textmarkieren mehr, Rand-Freihaltung für Geräte mit Kamera-Aussparung, Wurf-Anzeige und
  Checkout-Vorschlag in einer Zeile, kompakte Spielerliste ab drei Spielern (der Spieler am Wurf
  bleibt immer sichtbar).
- Der Update-Hinweis („Neue Version verfügbar") erscheint nicht mehr auf Fernbedienung und
  Zuschauer-TV — er schwebte dort über den Tasten.
- **Fernbedienung koppeln:** Ein Handy, das den QR-Code scannt (oder `…/#/remote` öffnet), fragt nicht
  mehr erst „Lokal oder Vereinsmodus?". Die Fernbedienung gibt es ohnehin nur im Vereinsmodus — das
  Handy landet jetzt direkt auf dem Vereins-Login. Die Anmeldung bleibt (nur ein Vereinskonto darf ein
  Board steuern); nur der überflüssige Zwischenschritt entfällt.

### Behoben
- **Undo-Tastenkürzel-Standard auf deutschen Tastaturen.** Das Rückgängig-Kürzel war auf **Alt+Z**
  vorbelegt — Kürzel binden aber an die physische Taste, und auf einer QWERTZ-Tastatur liegt „Z" dort,
  wo QWERTY sein „Y" hat. Die „Z"-Taste löste das Undo also nicht aus. Die Vorbelegung ist jetzt
  **Alt+U** („Undo") — auf allen Layouts an derselben Stelle. Das Kürzel bleibt frei wählbar
  (Einstellungen → Tastenkürzel); ein bestehender Verein stellt es dort einmalig auf Alt+U um.
- **Trainings-Bestwerte im Vereinsmodus** ließen sich nicht speichern — nach jedem Trainingsspiel
  erschien „Änderung konnte nicht gespeichert werden". Ursache: Der Bestwert wird am Spieler-Datensatz
  verbucht, Schreibrechte auf Spieler hatten aber nur Admin und Kapitän — am **Board-Rechner**, also
  genau dort, wo trainiert wird, schlug es immer fehl. Jetzt darf jedes angemeldete Konto Bestwerte
  speichern, **aber nur diese**: Name, Kürzel, Foto und Sperre bleiben Admin/Kapitän vorbehalten.
  ⚠ **Erfordert ein Server-Update** (neue Migration) — im lokalen Einzelboard-Modus trat der Fehler
  nicht auf.
- **Standardspieler „Spieler 1/2" im Vereinsmodus:** Ein Trainingsspiel mit den beiden immer
  vorhandenen Standardspielern meldete „Änderung konnte nicht gespeichert werden". Diese Spieler
  gibt es nur gerätelokal (kein Datensatz auf dem Server), der Bestwert wurde aber trotzdem an den
  Server geschickt und lief ins Leere. Ihre Bestwerte werden jetzt korrekt nur lokal geführt; die
  Meldung bleibt aus. Betrifft ebenso das Bearbeiten dieser beiden Spieler.
- **Fernbedienung: „Neues Spiel starten" wirkte im Leerlauf nicht.** Lief am Board gerade kein Spiel,
  zeigte das Handy zwar den Knopf „Neues Spiel starten", ein Tippen schickte das Board aber nur zur
  Spieler-Auswahl — es startete kein Spiel, und das Handy blieb im Leerlauf hängen. Jetzt beginnt der
  Knopf direkt ein Spiel mit der aktuellen Aufstellung; das Board fragt „Wer beginnt?", was am Handy
  ausgewählt und dann gespielt werden kann. Ganz ohne das Board anzufassen.
- **Fernbedienung: veralteter QR-Code („Session nicht gefunden").** Lud die Board-App neu (App-Update,
  Neustart, manuelles Aktualisieren), zeigte ein zuvor erstellter QR-Code ins Leere — das Handy meldete
  „Session nicht gefunden". Der QR enthält den Kopplungscode aber ohnehin; das Handy sucht bei veralteter
  ID jetzt automatisch die aktuell aktive Sitzung zu diesem Code und verbindet sich damit. Der QR bleibt
  also gültig, auch wenn sich das Board zwischendurch neu geladen hat.

## [1.0.3] – 2026-07-21

### Hinzugefügt
- **Remote & Live:** Ein Smartphone lässt sich per QR-Code (oder manueller Code-Eingabe) als
  **Fernbedienung** an ein Board koppeln — Score-Eingabe **und** Navigation vom Handy (Notfall bei
  defekter Maus/Tastatur oder einfach als bequeme Bedienung). Genau ein „Anschreiber" pro Board;
  Übernahme durch ein anderes Handy muss bestätigt werden. Koppeln auch über die Einstellungen.
- **Login-freier Zuschauer-TV:** ein dauerhafter, geheimer Link (`#/watch/<token>`) zeigt auf einem
  Bildschirm im Nebenraum das laufende Spiel (mehrere Boards als Kachel-Übersicht, sonst Vollbild).
  Vereinsweit ein-/ausschaltbar (**Standard aus** im Internet-Betrieb), Token rotierbar, zeigt nur
  Boardname + Spielstand. Beides nur im Vereins-/Board-Modus (PocketBase als Kanal).
  Plan/Details: [`docs/plan-remote.md`](docs/plan-remote.md).
- **Counter – Match-Statistik:** einklappbare Match-Statistik im Sieg-Overlay, eigene Statistik-Box
  (Darts/Short Legs statt „140+"), Kennzahl **Ø Darts/CO** und eine Finish-Dart-Abfrage (1/2/3) für
  eine korrekte Checkout-Quote. Das Sieg-Overlay zeigt die Ausmache (High Finish / Short Leg).
- **Counter – Live-Feier** bei Short Leg (≤ 19 Darts) und High Finish (≥ 100).
- **Tastenkürzel:** Übersicht aller Kürzel, Befehlspalette auf **Alt+K**, Undo/Abbrechen auf **Alt+Z/Alt+X**
  (alle drei in den Einstellungen konfigurierbar), zusätzlich Ctrl+Z / Ctrl+X. Header-Hinweise nur am Desktop.
- **Liga:** acht **Spielformat-Vorlagen** zur schnellen Auswahl.
- **Import:** englische CSV-Vorlage und zweisprachige Spalten-Erkennung.
- **Erststart:** Browser-Sprache wird übernommen (Deutsch → DE, sonst EN).
- **Kalender/Dashboard:** Hinweis auf den nächsten Termin, wenn der gewählte Zeitraum leer ist.

## [1.0.2] – 2026-07-16

### Geändert
- **Mobile-Layout:** Kein horizontales Scrollen mehr am Smartphone —
  Statistik-Bestenliste als Karten je Spieler, Kalender als Agenda-Liste,
  Ligatabelle mit kompakten Spalten (ohne Legs/Differenz). Verwaltungs-Tabellen
  (z. B. Benutzer) bleiben am Handy bewusst scrollbare Tabellen.

### Behoben
- Terminart „Competition" hieß im deutschen UI englisch — jetzt „Wettbewerb".

## [1.0.1] – 2026-07-16

### Behoben
- **Counter:** Bei Rest 2 oder 3 war der **3-Dart-Checkout** fälschlich gesperrt
  (z. B. Miss, Miss, D1) und solche Aufnahmen fehlten in der Checkout-Quote —
  die Auscheck-Prüfung berücksichtigt jetzt Finishes mit weniger Darts als verfügbar.

### Hinzugefügt
- **Browser-Demo** auf GitHub Pages: App ohne Installation im Lokal-Modus ausprobieren.
- **Automatische Tests** für die Spiellogik (Checkout-Regeln aller drei Out-Modi,
  Checkout-Tabelle, Leg-/Satz-Wertung, Bust-Regel, Ligatabelle) — laufen in der neuen **CI**
  (Lint + Tests + Build bei jedem Push/Pull-Request).
- **Release-Automation:** Ein Git-Tag `v*` baut die Verteil-Bundles und veröffentlicht das Release.

### Geändert
- **Alles englischsprachig als Primärfassung** (App war es schon): Skripte in `scripts/`
  (Namen + Inhalte), alle Anleitungen in `docs/` mit deutschen Fassungen in `docs/de/`,
  Verteil-Bundles heißen jetzt `01-single-board` / `02-club-lan` / `03-club-cloud`,
  Release-Notes zweisprachig.

## [1.0.0] – 2026-07-14

Erste öffentliche Version. Läuft im echten Vereinsbetrieb.

### Hinzugefügt
- **Am Board zählen** (n01-Stil) mit Checkout-Vorschlägen, Aufschrieb-Ansicht, Live-Statistik
  und einstellbarem Zoom für große Leseabstände.
- **Trainingsspiele**: Cricket, Around the Clock, Bob's 27 u. a. mit Regel-Dialog, Rangliste,
  Rückgängig und Revanche.
- **Ligabetrieb**: Spielplan-Import (inkl. **nuLiga**, Liga **und** Pokal), automatische Tabelle,
  Ergebniseintrag; Board-Modus mit „Nächstes Spiel"-Overlay und Datumsfenster.
- **Mannschaften & Aufstellungen** verwalten und direkt „an die Boards senden".
- **Kalender** mit Serienterminen, Batch-Löschen alter Termine und Saison-Abschluss.
- **Statistiken** je Spieler: Ø 3-Dart, 180er, Checkout-Quote, First-9, Short Legs, Rekorde,
  Saison-Filter und CSV-Export.
- **Benutzerkonten mit Rollen** (admin / captain / player / viewer / board) und optionaler
  **2-Faktor-Anmeldung (TOTP)** samt Einrichtungs-Assistent und Admin-Reset.
- **Zwei Betriebsmodi**: lokal (ein Board, ohne Login, `localStorage`) und Verein (PocketBase-Backend
  mit Realtime-Sync über mehrere Geräte).
- **Drei Verteil-Bundles** zum Herunterladen: lokal, Verein-LAN (Single-Binary, App + Datenbank),
  Verein-Cloud — plus dateibasiertes In-App-Update.
- Konfigurierbares **Impressum & Datenschutz** und automatisches Backup für den Eigenbetrieb.

[Unveröffentlicht]: https://github.com/zelko2k1/dartszentrale/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/zelko2k1/dartszentrale/releases/tag/v1.0.2
[1.0.1]: https://github.com/zelko2k1/dartszentrale/releases/tag/v1.0.1
[1.0.0]: https://github.com/zelko2k1/dartszentrale/releases/tag/v1.0.0
