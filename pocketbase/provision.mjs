// Provisioniert das DartsHub-Vereinsmodus-Schema in einer lokalen PocketBase-Instanz.
// Idempotent: mehrfaches Ausführen aktualisiert vorhandene Collections, statt zu duplizieren.
// Aufruf:  node provision.mjs
import PocketBase from '../app/node_modules/pocketbase/dist/pocketbase.es.mjs';
import { assertSafePassword } from './_security-guard.mjs';

const URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const SU_EMAIL = process.env.PB_SU_EMAIL || 'admin@dartshub.local';
const SU_PASS = process.env.PB_SU_PASS || 'dartshub-admin-2026';

// Erster App-Admin (damit man sich sofort in der App anmelden kann)
const APP_ADMIN = {
  email: process.env.APP_ADMIN_EMAIL || 'chef@dartshub.local',
  password: process.env.APP_ADMIN_PASS || 'dartshub123',
  first: 'Heiko',
  last: 'Frenzel',
};

// Sicherheits-Guard: keine bekannten Default-Passwörter gegen ein nicht-lokales Ziel.
assertSafePassword(URL, 'Superuser-Login', SU_PASS, 'PB_SU_PASS=…');
assertSafePassword(URL, 'App-Admin', APP_ADMIN.password, 'APP_ADMIN_PASS=…');

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
const LOGGED_IN = '@request.auth.id != ""';
const ADMIN = '@request.auth.role = "admin"';
const ADMIN_OR_CAPTAIN = '@request.auth.role = "admin" || @request.auth.role = "captain"';
const NOT_VIEWER = '@request.auth.role != "viewer"';

// players/teams/leagues/events: lesen für alle Angemeldeten, schreiben Admin/Captain
const editorRules = {
  listRule: LOGGED_IN, viewRule: LOGGED_IN,
  createRule: ADMIN_OR_CAPTAIN, updateRule: ADMIN_OR_CAPTAIN, deleteRule: ADMIN_OR_CAPTAIN,
};

const BASE_COLLECTIONS = [
  {
    name: 'players', type: 'base', ...editorRules,
    fields: [text('name'), text('short', { max: 3 }), num('avi'), bool('locked'), photo()],
  },
  {
    // Saison-Klammer: status = 'active' (genau eine) | 'archived' (abgeschlossen, in der App nur lesbar).
    name: 'seasons', type: 'base', ...editorRules,
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
    name: 'teams', type: 'base', ...editorRules,
    // kind = 'league' (Standard) | 'cup' (Pokalmannschaft). viceCaptainIds: bis zu 2 Ersatzkapitäne.
    fields: [text('name'), text('league'), json('memberIds'), json('captainId'), json('viceCaptainIds'), text('kind'), text('seasonId')],
  },
  {
    name: 'leagues', type: 'base', ...editorRules,
    // kind = 'league' (Standard) | 'cup' (Pokal-Wettbewerb) – trennt Liga- von Pokal-Begegnungen.
    // singlesCount/doublesCount/format: Match-Format der Liga (die App liest sie, z. B. useStore).
    fields: [text('name'), text('season'), text('seasonId'), json('teams'), json('fixtures'), text('kind'), num('singlesCount'), num('doublesCount'), json('format')],
  },
  {
    name: 'events', type: 'base', ...editorRules,
    fields: [text('title'), text('date'), text('time'), text('type'), text('loc'), text('scope'), text('seasonId')],
  },
  {
    name: 'matches', type: 'base',
    listRule: LOGGED_IN, viewRule: LOGGED_IN,
    createRule: NOT_VIEWER, updateRule: ADMIN, deleteRule: ADMIN,
    fields: [
      text('date'), num('startScore'), bool('doubleOut'), bool('doubleIn'),
      text('unit'), text('mode'), num('bestOf'), num('bestOfSets'),
      text('gameLabel'), text('winnerName'), text('scoreLine'), json('perPlayer'), text('seasonId'),
    ],
  },
  {
    name: 'club_config', type: 'base',
    listRule: LOGGED_IN, viewRule: LOGGED_IN,
    createRule: ADMIN, updateRule: ADMIN, deleteRule: ADMIN,
    fields: [text('clubName'), text('clubLogo', { max: 2000000 })],
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

  // 4) Ersten App-Admin anlegen (falls noch nicht vorhanden)
  try {
    await pb.collection('users').getFirstListItem(`email="${APP_ADMIN.email}"`, { requestKey: null });
    console.log(`• App-Admin existiert bereits: ${APP_ADMIN.email}`);
  } catch {
    await pb.collection('users').create({
      email: APP_ADMIN.email,
      password: APP_ADMIN.password,
      passwordConfirm: APP_ADMIN.password,
      emailVisibility: true,
      verified: true,
      name: `${APP_ADMIN.first} ${APP_ADMIN.last}`,
      first: APP_ADMIN.first, last: APP_ADMIN.last,
      role: 'admin', active: true, avi: 0, playerId: null, position: 'Vorsitzender', last_login: '—',
    });
    console.log(`✓ App-Admin angelegt: ${APP_ADMIN.email} / ${APP_ADMIN.password}`);
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
