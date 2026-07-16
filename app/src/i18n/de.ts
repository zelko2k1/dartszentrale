// ═══════ Sprachpaket DEUTSCH — Quelle der Wahrheit ═══════
// Jeder neue UI-Text kommt ZUERST hier hinein. en.ts muss exakt dieselben Schlüssel liefern —
// TypeScript erzwingt das über den Dict-Typ (siehe index.ts): fehlt dort ein Schlüssel, bricht der Build.
// Konvention: Schlüssel nach Bereich gruppiert (nav, sidebar, dashboard, …), Texte 1:1 wie bisher im Code.
// Dynamische Texte (mit Zahl/Name) sind Funktionen — so bleibt die Wortstellung pro Sprache frei.
export const de = {
  common: {
    today: 'Heute',
    tomorrow: 'Morgen',
    /** Suffix hinter Uhrzeiten („19:30 Uhr“) — im Englischen leer. */
    oclock: ' Uhr',
    season: 'Saison',
    archive: 'Archiv',
    training: 'Training',
  },

  // Datums-/Zeitformatierung (Reihenfolge wie Date.getDay() / Date.getMonth()).
  format: {
    wdLong: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
    wdShort: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    monLong: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    monShort: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
    /** Dreibuchstabige Großform für Datums-Kacheln (Dashboard/Termine). */
    mon3: ['JAN', 'FEB', 'MRZ', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'],
    night: 'Gute Nacht',
    morning: 'Guten Morgen',
    day: 'Guten Tag',
    evening: 'Guten Abend',
    /** Locale für toLocaleDateString/-TimeString. */
    dateLocale: 'de-DE',
  },

  nav: {
    dashboard: 'Dashboard',
    counter: 'Darts Counter',
    training: 'Trainingsspiele',
    calendar: 'Kalender',
    leagues: 'Ligen',
    teams: 'Mannschaften',
    players: 'Spieler',
    stats: 'Statistiken',
    users: 'Benutzer',
    settings: 'Einstellungen',
  },

  sidebar: {
    clubLogoAlt: 'Vereinslogo',
    chooseSeason: 'Saison wählen',
    archivedReadOnly: 'Archiviert · nur Lesezugriff',
    loggedInAccount: 'Angemeldetes Konto',
    logout: 'Abmelden',
  },

  dashboard: {
    clubFallback: 'Verein',
    clubOverview: 'Vereinsübersicht',
    // Kennzahlen-Kacheln (Admin)
    players: 'Spieler',
    teams: 'Mannschaften',
    competitions: 'Wettbewerbe',
    accounts: 'Konten',
    manageArrow: 'verwalten →',
    leagueCupArrow: 'Liga & Pokal →',
    usersRightsArrow: 'Benutzer & Rechte →',
    // Schnellanlage (Admin)
    quickCreate: 'Schnellanlage',
    qcPlayerSub: 'Zur Spielerliste',
    qcUser: 'Benutzer',
    qcUserSub: 'Konto & Rolle',
    qcTeam: 'Mannschaft',
    qcTeamSub: 'Kader anlegen',
    qcComp: 'Wettbewerb',
    qcCompSub: 'Liga oder Pokal',
    qcEvent: 'Termin',
    qcEventSub: 'Im Vereinskalender',
    // Verwaltung (Admin)
    adminSection: 'Verwaltung',
    usersRights: 'Benutzer & Rechte',
    leaguesCups: 'Ligen & Pokale',
    settingsSub: 'Verein, Board-Konten & mehr',
    inListCount: (n: number) => `${n} in der Liste`,
    accountsCount: (n: number) => `${n} Konten`,
    squadsCount: (n: number) => `${n} Kader`,
    competitionsCount: (n: number) => `${n} Wettbewerbe`,
    // Begegnungen & Ergebnisse
    yourUpcoming: 'Deine nächsten Begegnungen',
    upcoming: 'Nächste Begegnungen',
    noUpcoming: 'Keine anstehenden Begegnungen.',
    /** Präfix vor dem Gegnernamen: Heimspiel („gegen X“) bzw. Auswärtsspiel („bei X“). */
    versusPrefix: 'gegen ',
    awayPrefix: 'bei ',
    linedUpSuffix: ' · aufgestellt',
    lineupView: 'Aufstellung',
    lineupDo: 'Aufstellen',
    recentResults: 'Letzte Ergebnisse',
    noResults: 'Noch keine Ergebnisse.',
    // Meine Statistik
    myStats: 'Meine Statistik',
    avg3Dart: 'Ø 3-DART',
    games: 'Spiele',
    winLoss: 'S–N',
    count180: '180er',
    highFinish: 'High Finish',
    // Tabellen
    tablesPerComp: 'Tabellen je Wettbewerb',
    noTeamsYet: 'Noch keine Mannschaften.',
    toLeagues: 'Zu den Ligen →',
    // Termine-Leiste
    events: 'Termine',
    week: 'Woche',
    month: 'Monat',
    all: 'Alle',
    openCalendar: 'Kalender öffnen →',
    noEventsInRange: 'Keine Termine in diesem Zeitraum.',
    // Lokales Dashboard
    quickstart: 'Schnellstart',
    x01Match: 'X01 Match',
    nextEvents: 'Nächste Termine',
    noUpcomingEvents: 'Keine anstehenden Termine.',
    recentlyPlayed: 'Zuletzt gespielt',
    noGamesYet: 'Noch keine Spiele gespielt.',
    trainingStats: 'Trainings-Statistik',
    noTrainingYet: 'Noch keine Trainingsspiele gespielt.',
    allTraining: 'Alle Trainingsspiele →',
    leaderboard: 'Spieler-Bestenliste · Ø 3-Dart',
    noPlayers: 'Keine Spieler angelegt.',
  },

  settings: {
    language: 'Sprache / Language',
    languageSub: 'Sprache der Oberfläche · gilt nur für dieses Gerät',
  },

  calendar: {
    title: 'Kalender',
    /** Plural regelt jede Sprache selbst — deshalb eine Funktion. */
    eventsThisMonth: (n: number) => (n === 1 ? '1 Termin diesen Monat' : `${n} Termine diesen Monat`),
    prevMonth: 'Voriger Monat',
    nextMonth: 'Nächster Monat',
    addEvent: 'Termin',
    moreCount: (n: number) => `+${n} weitere`,
  },

  login: {
    management: 'Vereinsverwaltung',
    signIn: 'Anmelden',
    signInSub: 'Mit deinem Vereinskonto anmelden',
    email: 'E-Mail',
    password: 'Passwort',
    code: 'Bestätigungscode',
    codeHint: 'Code aus deiner Authenticator-App. Kein Zugriff? Gib stattdessen einen deiner 8-stelligen Backup-Codes ein.',
    confirm: 'Bestätigen',
    demoAccounts: 'Demo-Konten',
    demoHint: 'Demo-Modus — Passwort beliebig, oder Demo-Konto wählen.',
    impressum: 'Impressum',
    impressumTitle: 'Impressum',
    datenschutz: 'Datenschutz',
    datenschutzTitle: 'Datenschutzerklärung',
    close: 'Schließen',
  },
};
