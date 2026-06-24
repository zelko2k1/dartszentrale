// Provisioniert das DartsHub-Vereinsmodus-Schema in einer lokalen PocketBase-Instanz.
// Idempotent: mehrfaches Ausführen aktualisiert vorhandene Collections, statt zu duplizieren.
// Aufruf:  node provision.mjs
import PocketBase from '../app/node_modules/pocketbase/dist/pocketbase.es.mjs';

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

const pb = new PocketBase(URL);
pb.autoCancellation(false);

// --- Feld-Helfer (minimale Definitionen; PB ergänzt IDs/Defaults) ---
const text = (name, opt = {}) => ({ name, type: 'text', required: false, ...opt });
const num = (name) => ({ name, type: 'number', required: false });
const bool = (name) => ({ name, type: 'bool', required: false });
const json = (name) => ({ name, type: 'json', required: false, maxSize: 2000000 });

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
    fields: [text('name'), text('short', { max: 3 }), num('avi'), bool('locked')],
  },
  {
    name: 'teams', type: 'base', ...editorRules,
    fields: [text('name'), text('league'), json('memberIds'), json('captainId')],
  },
  {
    name: 'leagues', type: 'base', ...editorRules,
    fields: [text('name'), text('season'), json('teams'), json('fixtures')],
  },
  {
    name: 'events', type: 'base', ...editorRules,
    fields: [text('title'), text('date'), text('time'), text('type'), text('loc'), text('scope')],
  },
  {
    name: 'matches', type: 'base',
    listRule: LOGGED_IN, viewRule: LOGGED_IN,
    createRule: NOT_VIEWER, updateRule: ADMIN, deleteRule: ADMIN,
    fields: [
      text('date'), num('startScore'), bool('doubleOut'), bool('doubleIn'),
      text('unit'), text('mode'), num('bestOf'), num('bestOfSets'),
      text('gameLabel'), text('winnerName'), text('scoreLine'), json('perPlayer'),
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
      await pb.collections.update(cur.id, def);
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
  const addUserFields = [
    text('first'), text('last'),
    { name: 'role', type: 'select', required: false, maxSelect: 1, values: ['admin', 'captain', 'player', 'viewer'] },
    json('playerId'), text('position'), bool('active'), num('avi'), text('last_login'),
  ].filter((f) => !have.has(f.name));
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

  console.log('\nFertig. Schema steht.');
}

main().catch((e) => {
  console.error('FEHLER:', e?.response?.data ? JSON.stringify(e.response.data, null, 2) : e);
  process.exit(1);
});
