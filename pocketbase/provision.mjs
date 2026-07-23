// ═══════ [ PRODUKTIV / OPS ] — für den Produktivbetrieb gedacht (Schema-Setup) ═══════
// Provisioniert das DartsZentrale-Vereinsmodus-Schema in einer lokalen PocketBase-Instanz.
// Idempotent: mehrfaches Ausführen aktualisiert vorhandene Collections, statt zu duplizieren.
// Aufruf:  node provision.mjs
import readline from 'node:readline';
import PocketBase from '../app/node_modules/pocketbase/dist/pocketbase.es.mjs';
import { assertSafePassword } from './_security-guard.mjs';

const URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const SU_EMAIL = process.env.PB_SU_EMAIL || 'admin@dartszentrale.local';
const SU_PASS = process.env.PB_SU_PASS || 'dartszentrale-admin-2026';

// Sicherheits-Guard: keine bekannten Default-Passwörter gegen ein nicht-lokales Ziel.
assertSafePassword(URL, 'Superuser-Login', SU_PASS, 'PB_SU_PASS=…');

// Kleiner Terminal-Prompt-Helfer für die interaktive Admin-Anlage (Schritt 4).
// hidden:true blendet die Eingabe aus (Passwort wird beim Tippen nicht angezeigt).
function ask(query, { hidden = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    let first = true;
    const orig = rl._writeToOutput.bind(rl);
    rl._writeToOutput = (str) => { if (first) { orig(str); first = false; } else if (str.includes('\n')) orig('\n'); };
  }
  return new Promise((resolve) => rl.question(query, (a) => { rl.close(); resolve(a); }));
}

const pb = new PocketBase(URL);
pb.autoCancellation(false);

// --- Feld-Helfer (minimale Definitionen; PB ergänzt IDs/Defaults) ---
const text = (name, opt = {}) => ({ name, type: 'text', required: false, ...opt });
const num = (name) => ({ name, type: 'number', required: false });
const bool = (name) => ({ name, type: 'bool', required: false });
const json = (name) => ({ name, type: 'json', required: false, maxSize: 2000000 });
// Bild-File-Feld (Profilfoto). PB erzeugt Thumbnails on-demand; 160x160 vordefiniert für die Listen-Anzeige.
const photo = () => ({ name: 'photo', type: 'file', required: false, maxSelect: 1, maxSize: 5242880, mimeTypes: ['image/png', 'image/jpeg', 'image/webp'], thumbs: ['160x160'] });

// --- Rules ---
// Leerer String = öffentlich (auch ohne Anmeldung). null hingegen = nur Superuser.
const PUBLIC = '';
const LOGGED_IN = '@request.auth.id != ""';
const ADMIN = '@request.auth.role = "admin"';
const ADMIN_OR_CAPTAIN = '@request.auth.role = "admin" || @request.auth.role = "captain"';
const NOT_VIEWER = '@request.auth.role != "viewer"';
// #6 (Rest): Mannschaft ändern darf Admin ODER der Kapitän GENAU SEINER Mannschaft
//   (teams.captainId == eigene users.playerId). Verhindert Roster-Editing fremder Teams.
//   captainId/playerId sind json-Skalare (eine Spieler-ID|null) → direkter Vergleich.
const TEAM_UPDATE = '@request.auth.role = "admin" || (@request.auth.role = "captain" && captainId = @request.auth.playerId)';
// #4: Ergebnisse — Ersteller wird gestempelt und kann nur SICH SELBST eintragen;
//     ändern darf Admin ODER der Ersteller (Korrektur der eigenen Eingabe).
const MATCH_CREATE = '@request.auth.id != "" && @request.body.createdBy = @request.auth.id';
const MATCH_UPDATE = '@request.auth.role = "admin" || createdBy = @request.auth.id';

// players/teams/leagues/events: lesen für alle Angemeldeten, schreiben Admin/Captain
const editorRules = {
  listRule: LOGGED_IN, viewRule: LOGGED_IN,
  createRule: ADMIN_OR_CAPTAIN, updateRule: ADMIN_OR_CAPTAIN, deleteRule: ADMIN_OR_CAPTAIN,
};
// Ausnahme für players: Trainings-Bestwerte verbucht die App nach jedem Trainingsspiel am
// Spieler-Datensatz — das läuft am BOARD-Konto bzw. unter normalen Mitgliedern, nicht als Admin.
// Darum darf jedes angemeldete Konto `players` ändern, solange AUSSCHLIESSLICH `trainingBests` im
// Änderungswunsch steht; sobald Stammdaten (name/short/avi/locked/photo) mitkommen, gilt wieder
// Admin/Kapitän. Gespiegelt in pb_migrations/1784300003_players_training_bests_rule.js.
const TRAINING_BESTS_ONLY = [
  LOGGED_IN,
  '@request.body.trainingBests:isset = true',
  '@request.body.name:isset = false',
  '@request.body.short:isset = false',
  '@request.body.avi:isset = false',
  '@request.body.locked:isset = false',
  '@request.body.photo:isset = false',
].join(' && ');

const BASE_COLLECTIONS = [
  {
    name: 'players', type: 'base', ...editorRules,
    updateRule: `${ADMIN_OR_CAPTAIN} || (${TRAINING_BESTS_ONLY})`,
    // trainingBests: persönliche Trainings-Bestwerte je Modus (json-Map modeId→{value,date}). Board-übergreifend.
    fields: [text('name'), text('short', { max: 3 }), num('avi'), bool('locked'), photo(), json('trainingBests')],
  },
  {
    // Saison-Klammer: status = 'active' (genau eine) | 'archived' (abgeschlossen, in der App nur lesbar).
    // #6: anlegen/löschen nur Admin (Kapitän darf keine ganze Saison anlegen/löschen).
    name: 'seasons', type: 'base', ...editorRules, createRule: ADMIN, deleteRule: ADMIN,
    fields: [text('name'), text('status'), text('startDate'), text('endDate'), bool('offloaded')],
  },
  {
    // Eingefrorener Abschluss-Stand einer Saison (beim „Saison abschließen" erzeugt). Schreiben nur Admin.
    name: 'season_snapshots', type: 'base',
    listRule: LOGGED_IN, viewRule: LOGGED_IN,
    createRule: ADMIN, updateRule: ADMIN, deleteRule: ADMIN,
    fields: [text('seasonId'), text('seasonName'), json('standings'), json('playerStats'), json('teamRosters'), json('meta')],
  },
  {
    // #6: löschen nur Admin; ändern nur Admin oder der eigene Kapitän (kein fremdes Roster-Editing).
    name: 'teams', type: 'base', ...editorRules, updateRule: TEAM_UPDATE, deleteRule: ADMIN,
    // kind = 'league' (Standard) | 'cup' (Pokalmannschaft). viceCaptainIds: bis zu 2 Ersatzkapitäne.
    fields: [text('name'), text('league'), json('memberIds'), json('captainId'), json('viceCaptainIds'), text('kind'), text('seasonId')],
  },
  {
    // #6: anlegen/löschen nur Admin (Liga-Strukturen sind Admin-Sache).
    name: 'leagues', type: 'base', ...editorRules, createRule: ADMIN, deleteRule: ADMIN,
    // kind = 'league' (Standard) | 'cup' (Pokal-Wettbewerb) – trennt Liga- von Pokal-Begegnungen.
    // singlesCount/doublesCount/format: Match-Format der Liga (die App liest sie, z. B. useStore).
    // nuligaUrl: nuLiga-Gruppen-URL zur Verknüpfung einer Liga mit ihrer nuLiga-Gruppe (Merge-Import).
    fields: [text('name'), text('season'), text('seasonId'), json('teams'), json('fixtures'), text('kind'), num('singlesCount'), num('doublesCount'), json('format'), text('nuligaUrl'), num('order')],
  },
  {
    name: 'events', type: 'base', ...editorRules,
    // fixtureId: verknüpft einen automatisch angelegten Termin mit seiner Begegnung (Fixture.id). Ohne dieses
    // Feld verliert PocketBase die Verknüpfung → der erneute Spielplan-Import kann Termine nicht wiedererkennen
    // und legt sie doppelt an. Deckungsgleich mit der Baseline-Migration (Docker-/Migrations-Pfad).
    fields: [text('title'), text('date'), text('time'), text('type'), text('loc'), text('scope'), text('seasonId'), text('fixtureId'), text('seriesId')],
  },
  {
    name: 'matches', type: 'base',
    listRule: LOGGED_IN, viewRule: LOGGED_IN,
    // #4: Ersteller-Stempel statt „jeder Nicht-Viewer darf beliebige Ergebnisse anlegen".
    createRule: MATCH_CREATE, updateRule: MATCH_UPDATE, deleteRule: ADMIN,
    fields: [
      text('date'), num('startScore'), bool('doubleOut'), bool('doubleIn'),
      text('unit'), text('mode'), num('bestOf'), num('bestOfSets'),
      text('gameLabel'), text('winnerName'), text('scoreLine'), json('perPlayer'), text('seasonId'), text('createdBy'),
    ],
  },
  {
    // Trainingsspiel „X01 – Jeder gegen Jeden": ein Datensatz = ein Round-Robin-Turnier (kompletter
    // Zustand als JSON — Konfiguration, Teilnehmer, Spielplan + Ergebnisse). Ändern darf JEDES angemeldete
    // Mitglied, damit Board-Konten Partie-Ergebnisse zurückschreiben können; anlegen an den Ersteller
    // gebunden; löschen nur der Ersteller oder ein Admin. Deckungsgleich mit der Migration (Docker-Pfad).
    name: 'tournaments', type: 'base',
    listRule: LOGGED_IN, viewRule: LOGGED_IN,
    createRule: MATCH_CREATE, updateRule: LOGGED_IN, deleteRule: '@request.auth.id = createdBy || @request.auth.role = "admin"',
    fields: [
      text('name'), text('createdAt'), json('config'), num('boardCount'),
      json('participants'), json('matches'), text('status'), text('seasonId'), text('createdBy'),
    ],
  },
  {
    // Öffentlich LESBAR (PUBLIC), damit die Login-Seite Vereinsname/Logo sowie die Rechtstexte
    // (Impressum §5 DDG, Datenschutz Art. 13 DSGVO) auch ohne Anmeldung zeigen kann. Enthält nur
    // Anzeige-/Konfig-Werte, nichts Personenbezogenes. Schreiben bleibt Admin-only.
    name: 'club_config', type: 'base',
    listRule: PUBLIC, viewRule: PUBLIC,
    createRule: ADMIN, updateRule: ADMIN, deleteRule: ADMIN,
    fields: [
      text('clubName'), text('clubLogo', { max: 2000000 }),
      text('impressum', { max: 50000 }), text('datenschutz', { max: 50000 }),
      json('settings'),
    ],
  },
];

async function main() {
  await pb.collection('_superusers').authWithPassword(SU_EMAIL, SU_PASS);
  console.log('✓ Als Superuser angemeldet');

  const existing = await pb.collections.getFullList({ requestKey: null });
  const byName = new Map(existing.map((c) => [c.name, c]));

  // 1) Basis-Collections anlegen/aktualisieren
  for (const def of BASE_COLLECTIONS) {
    const cur = byName.get(def.name);
    if (cur) {
      // Felder MERGEN statt ersetzen: bestehende Felder (inkl. ihrer IDs und per Migration
      // ergänzter wie events.fixtureId) behalten, nur in der Definition fehlende anhängen.
      // (Ein nacktes update(cur.id, def) würde das Schema durch def.fields ersetzen und
      //  migrationsergänzte Spalten samt Daten löschen — siehe users-Pfad weiter unten.)
      const have = new Set(cur.fields.map((f) => f.name));
      const merged = { ...def, fields: [...cur.fields, ...def.fields.filter((f) => !have.has(f.name))] };
      await pb.collections.update(cur.id, merged);
      console.log(`✓ aktualisiert: ${def.name}`);
    } else {
      const created = await pb.collections.create(def);
      byName.set(def.name, created);
      console.log(`✓ angelegt:     ${def.name}`);
    }
  }

  // 2) users (Auth) um Vereinsfelder erweitern + Rules setzen
  const users = byName.get('users') || (await pb.collections.getOne('users'));
  const have = new Set(users.fields.map((f) => f.name));
  // 'board' = Maschinen-Rolle der Board-Rechner. Fest an isBoard gekoppelt (siehe pb_hooks/board_role_guard.pb.js).
  const ROLE_VALUES = ['admin', 'captain', 'player', 'viewer', 'board'];
  const addUserFields = [
    text('first'), text('last'),
    { name: 'role', type: 'select', required: false, maxSelect: 1, values: ROLE_VALUES },
    json('playerId'), text('position'), bool('active'), num('avi'), text('last_login'),
    bool('isBoard'), { name: 'boardNumber', type: 'number', required: false, onlyInt: true }, photo(),
  ].filter((f) => !have.has(f.name));
  // Bestehendes role-Feld nachziehen, falls es 'board' noch nicht kennt.
  const existingRole = users.fields.find((f) => f.name === 'role');
  if (existingRole && !(existingRole.values || []).includes('board')) {
    existingRole.values = ROLE_VALUES;
    console.log("✓ role-Feld um Wert 'board' ergänzt");
  }
  const usersPatch = {
    fields: [...users.fields, ...addUserFields],
    listRule: LOGGED_IN, viewRule: LOGGED_IN,
    createRule: ADMIN, updateRule: ADMIN, deleteRule: ADMIN,
    // manageRule = Admin: nötig, damit App-Admins die E-Mail (managed Auth-Feld) eines Kontos
    // direkt ändern dürfen. Ohne sie blockt PocketBase E-Mail-Änderungen für Nicht-Superuser
    // (400 „values don't match"). Deckungsgleich mit updateRule. Siehe pb_migrations/…_users_manage_rule.js.
    manageRule: ADMIN,
    // Deaktivierte Konten können sich serverseitig gar nicht erst anmelden (auch nicht per Roh-API).
    authRule: 'active = true',
  };
  await pb.collections.update(users.id, usersPatch);
  console.log(`✓ users erweitert (+${addUserFields.length} Felder: ${addUserFields.map((f) => f.name).join(', ') || 'keine'})`);

  // 3) user_prefs (Relation auf users, pro Nutzer eindeutig)
  const usersId = users.id;
  const prefsDef = {
    name: 'user_prefs', type: 'base',
    listRule: '@request.auth.id = user', viewRule: '@request.auth.id = user',
    createRule: '@request.auth.id = user', updateRule: '@request.auth.id = user', deleteRule: '@request.auth.id = user',
    fields: [
      { name: 'user', type: 'relation', required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
      json('settings'), json('trainingPlays'),
    ],
    indexes: ['CREATE UNIQUE INDEX `idx_user_prefs_user` ON `user_prefs` (`user`)'],
  };
  const prefsCur = byName.get('user_prefs');
  if (prefsCur) { await pb.collections.update(prefsCur.id, prefsDef); console.log('✓ aktualisiert: user_prefs'); }
  else { await pb.collections.create(prefsDef); console.log('✓ angelegt:     user_prefs'); }

  // 3.5) user_mfa (2FA/TOTP) — ABGESCHOTTET: alle Rules null → nur Superuser/pb_hooks.
  //      Secret verlässt nie über die REST-API den Server (Plan docs/plan-2fa.md §3).
  //      Spiegelbild der Migration pb_migrations/1782300002_user_mfa.js (Docker/Arcane-Weg).
  const mfaDef = {
    name: 'user_mfa', type: 'base',
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: 'user', type: 'relation', required: true, maxSelect: 1, collectionId: usersId, cascadeDelete: true },
      text('secret', { hidden: true }),   // TOTP-Base32-Secret (nie über API lesbar)
      bool('enabled'),                     // aktiv (nach Bestätigung)
      bool('pending'),                     // im Enrollment, noch nicht bestätigt
      json('backupCodes'),                 // gehashte Einmal-Codes (+ used-Flag)
      { name: 'failedAttempts', type: 'number', required: false, onlyInt: true },
      text('lockedUntil'),                 // temporäre Sperre nach zu vielen Fehlversuchen
      text('confirmedAt'),                 // Aktivierungszeitpunkt
    ],
    indexes: ['CREATE UNIQUE INDEX `idx_user_mfa_user` ON `user_mfa` (`user`)'],
  };
  // backupCodes zusätzlich als hidden markieren (json-Helfer setzt es nicht).
  mfaDef.fields.find((f) => f.name === 'backupCodes').hidden = true;
  const mfaCur = byName.get('user_mfa');
  if (mfaCur) { await pb.collections.update(mfaCur.id, mfaDef); console.log('✓ aktualisiert: user_mfa'); }
  else { await pb.collections.create(mfaDef); console.log('✓ angelegt:     user_mfa'); }

  // 3.6) live_sessions + live_commands (Remote & Live — Plan docs/plan-remote.md)
  //      live_sessions: View-State je Board (Host schreibt, Mitglieder lesen).
  //      live_commands: Befehls-Postfach (nur gekoppelter Remote legt an, Host liest/löscht).
  //      Kopplung (remoteUser/pendingRemote) läuft über pb_hooks/live_hooks.pb.js.
  //      Spiegelbild der Migration pb_migrations/1784300000_live_collections.js (Docker/Arcane-Weg).
  const rel = (name, collectionId, opt = {}) => ({ name, type: 'relation', required: false, maxSelect: 1, minSelect: 0, collectionId, cascadeDelete: false, ...opt });
  const LIVE_SESSION_CREATE = '@request.auth.id != "" && @request.body.host = @request.auth.id';
  const sessDef = {
    name: 'live_sessions', type: 'base',
    listRule: LOGGED_IN, viewRule: LOGGED_IN,
    createRule: LIVE_SESSION_CREATE, updateRule: '@request.auth.id = host',
    deleteRule: '@request.auth.id = host || @request.auth.role = "admin"',
    fields: [
      rel('host', usersId, { required: true, cascadeDelete: true }),
      text('boardName'), text('code'),
      rel('remoteUser', usersId), rel('pendingRemote', usersId),
      text('status'), json('state'),
      { name: 'lastAppliedSeq', type: 'number', required: false, onlyInt: true },
      text('heartbeat'),
    ],
  };
  const sessCur = byName.get('live_sessions');
  let liveSessId;
  if (sessCur) { await pb.collections.update(sessCur.id, sessDef); liveSessId = sessCur.id; console.log('✓ aktualisiert: live_sessions'); }
  else { const c = await pb.collections.create(sessDef); liveSessId = c.id; byName.set('live_sessions', c); console.log('✓ angelegt:     live_sessions'); }

  const cmdDef = {
    name: 'live_commands', type: 'base',
    listRule: '@request.auth.id = session.host', viewRule: '@request.auth.id = session.host',
    createRule: '@request.auth.id != "" && @request.body.createdBy = @request.auth.id',
    updateRule: null, deleteRule: '@request.auth.id = session.host',
    fields: [
      rel('session', liveSessId, { required: true, cascadeDelete: true }),
      { name: 'seq', type: 'number', required: false, onlyInt: true },
      text('type'), json('payload'),
      rel('createdBy', usersId, { required: true }),
    ],
    indexes: ['CREATE INDEX `idx_live_commands_session` ON `live_commands` (`session`, `seq`)'],
  };
  const cmdCur = byName.get('live_commands');
  if (cmdCur) { await pb.collections.update(cmdCur.id, cmdDef); console.log('✓ aktualisiert: live_commands'); }
  else { await pb.collections.create(cmdDef); console.log('✓ angelegt:     live_commands'); }

  // 3.7) watch_config (login-freier Zuschauer-TV) — ABGESCHOTTET: alle Rules null → nur Superuser/pb_hooks.
  //      watchEnabled = Kill-Switch (Default AUS), watchToken = geheimer Link-Token. Verwaltung + öffentlicher
  //      Abruf laufen über pb_hooks/watch_hooks.pb.js. Spiegelbild der Migration 1784300001_watch_config.js.
  const watchDef = {
    name: 'watch_config', type: 'base',
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [bool('watchEnabled'), text('watchToken')],
  };
  const watchCur = byName.get('watch_config');
  if (watchCur) { await pb.collections.update(watchCur.id, watchDef); console.log('✓ aktualisiert: watch_config'); }
  else { await pb.collections.create(watchDef); console.log('✓ angelegt:     watch_config'); }

  // 4) Ersten App-Admin anlegen — NUR wenn noch gar kein Admin existiert.
  //    Kein hartcodiertes Konto mehr: E-Mail/Passwort werden interaktiv abgefragt
  //    (oder per APP_ADMIN_EMAIL/APP_ADMIN_PASS gesetzt — z. B. Cloud/CI ohne Terminal).
  const admins = await pb.collection('users')
    .getList(1, 1, { filter: 'role="admin"', requestKey: null })
    .catch(() => ({ items: [] }));
  if (admins.items.length) {
    console.log(`• App-Admin existiert bereits: ${admins.items[0].email} — kein neuer angelegt.`);
  } else {
    let email = (process.env.APP_ADMIN_EMAIL || '').trim();
    let password = process.env.APP_ADMIN_PASS || '';
    if (!email || !password) {
      // Headless (Container/CI ohne Terminal): nicht ins Leere prompten → klar abbrechen.
      if (!process.stdin.isTTY) {
        console.error('\n✗ Kein App-Admin vorhanden und keine interaktive Eingabe möglich (kein TTY, z. B. Container/CI).');
        console.error('  → Env-Variablen setzen und erneut starten:');
        console.error('    APP_ADMIN_EMAIL=… APP_ADMIN_PASS=<starkes-pw> node provision.mjs');
        console.error('  (In der Cloud wird der erste Admin üblicherweise direkt im PocketBase-Admin-UI angelegt.)\n');
        process.exit(1);
      }
      console.log('\nNoch kein App-Admin vorhanden — bitte den ersten Admin anlegen:');
      while (!email) {
        email = (await ask('  Admin-E-Mail:         ')).trim();
        if (!email) console.log('  ✗ E-Mail darf nicht leer sein.');
      }
      while (!password) {
        const p1 = await ask('  Admin-Passwort:       ', { hidden: true });
        const p2 = await ask('  Passwort wiederholen: ', { hidden: true });
        if (!p1) console.log('  ✗ Passwort darf nicht leer sein.');
        else if (p1 !== p2) console.log('  ✗ Passwörter stimmen nicht überein — bitte erneut.');
        else password = p1;
      }
    }
    // Auch interaktiv getippte Passwörter gegen die bekannten Repo-Defaults absichern.
    assertSafePassword(URL, 'App-Admin', password, 'APP_ADMIN_PASS=…');
    await pb.collection('users').create({
      email, password, passwordConfirm: password,
      emailVisibility: true, verified: true,
      name: 'Administrator', first: 'Administrator', last: '',
      role: 'admin', active: true, avi: 0, playerId: null, position: 'Administrator', last_login: '—',
    });
    console.log(`✓ App-Admin angelegt: ${email}`);
  }

  // 5) Saison-Backfill (idempotent): aktive Saison sicherstellen, Altbestand zuordnen,
  //    Match-Spielerstatistiken um playerId (per Name→Spieler) ergänzen.
  let activeSeasonId;
  const seasonsList = await pb.collection('seasons').getFullList({ requestKey: null });
  const active = seasonsList.find((s) => s.status === 'active') || seasonsList[0];
  if (active) { activeSeasonId = active.id; console.log(`• Saison vorhanden: ${active.name}`); }
  else {
    const created = await pb.collection('seasons').create({ name: '2025/26', status: 'active' });
    activeSeasonId = created.id;
    console.log('✓ Saison angelegt: 2025/26 (aktiv)');
  }

  for (const coll of ['leagues', 'teams', 'events']) {
    const rows = await pb.collection(coll).getFullList({ requestKey: null });
    let n = 0;
    for (const r of rows) if (!r.seasonId) { await pb.collection(coll).update(r.id, { seasonId: activeSeasonId }); n++; }
    if (n) console.log(`✓ seasonId nachgezogen: ${coll} (${n})`);
  }

  const playersAll = await pb.collection('players').getFullList({ requestKey: null });
  const playerByName = new Map(playersAll.map((p) => [p.name, p.id]));
  const matchesAll = await pb.collection('matches').getFullList({ requestKey: null });
  let mn = 0;
  for (const m of matchesAll) {
    const patch = {};
    if (!m.seasonId) patch.seasonId = activeSeasonId;
    const pp = Array.isArray(m.perPlayer) ? m.perPlayer : [];
    let ppChanged = false;
    const newPP = pp.map((x) => (x && x.playerId === undefined && playerByName.has(x.name)) ? (ppChanged = true, { ...x, playerId: playerByName.get(x.name) }) : x);
    if (ppChanged) patch.perPlayer = newPP;
    if (Object.keys(patch).length) { await pb.collection('matches').update(m.id, patch); mn++; }
  }
  if (mn) console.log(`✓ Matches migriert (seasonId/playerId): ${mn}`);

  console.log('\nFertig. Schema steht.');
}

main().catch((e) => {
  console.error('FEHLER:', e?.response?.data ? JSON.stringify(e.response.data, null, 2) : e);
  process.exit(1);
});
