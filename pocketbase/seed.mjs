// Befüllt die lokale PocketBase mit realistischen DartsHub-Beispieldaten (Vereinsmodus).
// Idempotent: leert die Inhalts-Collections vorher und legt frisch an. Der App-Admin
// (chef@dartshub.local) bleibt erhalten; weitere Benutzer werden neu erzeugt.
// Aufruf:  node seed.mjs
import PocketBase from '../app/node_modules/pocketbase/dist/pocketbase.es.mjs';

const URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const SU_EMAIL = process.env.PB_SU_EMAIL || 'admin@dartshub.local';
const SU_PASS = process.env.PB_SU_PASS || 'dartshub-admin-2026';
const KEEP_ADMIN_EMAIL = process.env.APP_ADMIN_EMAIL || 'chef@dartshub.local';
const MEMBER_PW = 'dartshub123'; // Startpasswort aller angelegten Mitglieder

const pb = new PocketBase(URL);
pb.autoCancellation(false);

// --- Helfer ---
const ALPHA = 'abcdefghijklmnopqrstuvwxyz0123456789';
const uid = () => Array.from({ length: 15 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
const iso = (off) => { const d = new Date(); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); };
const initials = (name) => { const p = name.trim().split(/\s+/); return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase(); };

async function wipe(coll, filter = '') {
  const list = await pb.collection(coll).getFullList({ requestKey: null, ...(filter ? { filter } : {}) });
  for (const r of list) await pb.collection(coll).delete(r.id);
  return list.length;
}

async function main() {
  await pb.collection('_superusers').authWithPassword(SU_EMAIL, SU_PASS);
  console.log('✓ Als Superuser angemeldet\n');

  // 1) Aufräumen (Reihenfolge unkritisch, da denormalisiert)
  for (const c of ['season_snapshots', 'matches', 'events', 'leagues', 'teams', 'user_prefs', 'players', 'seasons']) {
    const n = await wipe(c);
    console.log(`  geleert: ${c} (${n})`);
  }
  const delUsers = await wipe('users', `email != "${KEEP_ADMIN_EMAIL}"`);
  console.log(`  geleert: users (${delUsers}, App-Admin behalten)\n`);

  // 1b) Aktive Saison anlegen — alle Inhalte hängen an dieser Saison (sonst blendet der Saison-Filter sie aus).
  const season = await pb.collection('seasons').create({ id: uid(), name: '2025/26', status: 'active' });
  const SID = season.id;
  console.log('✓ Aktive Saison 2025/26 angelegt');

  // 2) Spieler-Kader
  const squad = [
    ['Lukas', 'Brandt', 0], ['Daniel', 'Weber', 1], ['Marco', 'Hansen', 2],
    ['Stefan', 'Köhler', 3], ['Tim', 'Berger', 4], ['Andre', 'Voss', 5],
    ['Kevin', 'Schmidt', 6], ['Patrick', 'Wolf', 7], ['Sven', 'Richter', 1],
    ['Florian', 'Neumann', 3],
  ];
  const players = [];
  for (const [first, last, avi] of squad) {
    const name = `${first} ${last}`;
    const rec = await pb.collection('players').create({ id: uid(), name, short: initials(name), avi });
    players.push({ ...rec, first, last });
  }
  console.log(`✓ ${players.length} Spieler angelegt`);
  const P = (i) => players[i].id;

  // 3) Mannschaften
  await pb.collection('teams').create({
    id: uid(), name: '1. Mannschaft', league: 'Verbandsliga Nord', seasonId: SID,
    memberIds: [P(0), P(1), P(2), P(3), P(4), P(5)], captainId: P(0),
  });
  await pb.collection('teams').create({
    id: uid(), name: '2. Mannschaft', league: 'Kreisliga A', seasonId: SID,
    memberIds: [P(6), P(7), P(8), P(9)], captainId: P(6),
  });
  console.log('✓ 2 Mannschaften angelegt');

  // 4) Liga mit Tabelle + Spielplan
  const tm = (name, own) => ({ id: uid(), name, own: !!own });
  const adler = tm('SV Adler I', true), falken = tm('DC Falken'), phoenix = tm('DC Phoenix'),
    bulls = tm('Bulls Eye Krefeld'), rhein = tm('DSC Rheinpfeil'), steel = tm('Steel Kings');
  const lteams = [adler, falken, phoenix, bulls, rhein, steel];
  const fx = (home, away, hs, as, off, played) => ({
    id: uid(), homeId: home.id, awayId: away.id, date: iso(off),
    played: !!played, hs: played ? hs : '', as: played ? as : '',
  });
  const fixtures = [
    fx(adler, rhein, 6, 2, -28, true), fx(bulls, falken, 5, 3, -27, true),
    fx(adler, bulls, 5, 3, -21, true), fx(phoenix, adler, 5, 3, -14, true),
    fx(falken, steel, 6, 2, -13, true), fx(adler, steel, 6, 2, -7, true),
    fx(falken, adler, 4, 4, -6, true), fx(phoenix, falken, 6, 2, -6, true),
    fx(adler, falken, 0, 0, 5, false), fx(rhein, phoenix, 0, 0, 6, false),
    fx(adler, phoenix, 0, 0, 12, false), fx(steel, adler, 0, 0, 19, false),
  ];
  await pb.collection('leagues').create({ id: uid(), name: 'Verbandsliga Nord', season: '2025/26', seasonId: SID, teams: lteams, fixtures });
  console.log('✓ Liga „Verbandsliga Nord" mit Spielplan angelegt');

  // 5) Termine
  const events = [
    ['SV Adler — DC Falken', iso(5), '19:30', 'ligaspiel', 'Sportheim Adler · Heim'],
    ['Mannschaftstraining', iso(2), '19:00', 'training', 'Vereinsheim'],
    ['DC Phoenix — SV Adler', iso(12), '19:30', 'ligaspiel', 'Auswärts · Moers'],
    ['Pokal-Achtelfinale vs Phoenix', iso(16), '19:00', 'pokal', 'Sportheim Adler'],
    ['Vereinsabend', iso(23), '18:00', 'verein', 'Vereinsheim'],
    ['Doppel & Finishes', iso(1), '18:00', 'training', 'Heim-Board'],
    ['Jahreshauptversammlung', iso(30), '17:00', 'verein', 'Gaststätte Zur Post'],
  ];
  for (const [title, date, time, type, loc] of events) {
    await pb.collection('events').create({ id: uid(), title, date, time, type, loc, scope: 'verein', seasonId: SID });
  }
  console.log(`✓ ${events.length} Termine angelegt`);

  // 6) Benutzerkonten (mit echtem Login). Einige mit Spieler verknüpft.
  const accounts = [
    ['Sandra', 'Köster', 'sandra.koester@sv-adler.de', 'captain', P(0), 2, 'Mannschaftsführerin', true],
    ['Daniel', 'Weber', 'daniel.weber@sv-adler.de', 'player', P(1), 1, '', true],
    ['Marco', 'Hansen', 'marco.hansen@web.de', 'player', P(2), 5, '', true],
    ['Petra', 'Lang', 'schriftfuehrung@sv-adler.de', 'viewer', null, 4, 'Schriftführerin', true],
    ['Jens', 'Hofer', 'j.hofer@gmx.de', 'player', null, 6, '', true],
    ['Tobias', 'Reiter', 't.reiter@web.de', 'player', null, 3, 'Kassenwart', false],
  ];
  for (const [first, last, email, role, playerId, avi, position, active] of accounts) {
    await pb.collection('users').create({
      email, password: MEMBER_PW, passwordConfirm: MEMBER_PW, emailVisibility: true, verified: true,
      name: `${first} ${last}`, first, last, role, playerId, position, active, avi, last_login: '—',
    });
  }
  console.log(`✓ ${accounts.length} Benutzerkonten angelegt (Passwort: ${MEMBER_PW})`);

  // 7) Gespielte Matches mit Statistik (perPlayer denormalisiert)
  const stat = (p, legsWon, avg3, c180, c140, c100, c60, highFinish, darts) => ({
    name: p.name, short: p.short, av: p.avi, playerId: p.id, legsWon, setsWon: 0,
    avg3, c180, c60, c100, c140, highFinish, darts,
  });
  const matches = [
    {
      id: uid(), date: iso(-7), startScore: 501, doubleOut: true, doubleIn: false, unit: 'legs',
      mode: 'single', bestOf: 5, bestOfSets: 3, gameLabel: '501 · Best of 5', winnerName: players[0].name,
      scoreLine: '3:1', perPlayer: [stat(players[0], 3, 64.2, 2, 5, 8, 11, 116, 63), stat(players[3], 1, 58.7, 1, 3, 6, 9, 78, 60)],
    },
    {
      id: uid(), date: iso(-3), startScore: 501, doubleOut: true, doubleIn: false, unit: 'legs',
      mode: 'single', bestOf: 5, bestOfSets: 3, gameLabel: '501 · Best of 5', winnerName: players[1].name,
      scoreLine: '3:2', perPlayer: [stat(players[1], 3, 61.0, 1, 4, 7, 12, 96, 72), stat(players[2], 2, 60.4, 1, 4, 5, 10, 84, 69)],
    },
    {
      id: uid(), date: iso(-1), startScore: 501, doubleOut: true, doubleIn: false, unit: 'sets',
      mode: 'single', bestOf: 5, bestOfSets: 3, gameLabel: '501 · Best of 3 Sätze', winnerName: players[4].name,
      scoreLine: '2:0', perPlayer: [stat(players[4], 6, 67.8, 3, 6, 9, 14, 121, 90), stat(players[5], 2, 55.1, 0, 2, 4, 8, 62, 84)],
    },
  ];
  for (const m of matches) await pb.collection('matches').create({ ...m, seasonId: SID });
  console.log(`✓ ${matches.length} gespielte Matches angelegt`);

  // 8) Vereinsname/Logo
  let cfg;
  try { cfg = await pb.collection('club_config').getFirstListItem('', { requestKey: null }); } catch { /* none */ }
  const cfgBody = { clubName: 'SV Adler Niederrhein', clubLogo: null };
  if (cfg) await pb.collection('club_config').update(cfg.id, cfgBody);
  else await pb.collection('club_config').create(cfgBody);
  console.log('✓ Vereinskonfiguration gesetzt (SV Adler Niederrhein)');

  console.log('\nFertig. Beispieldaten stehen bereit.');
  console.log(`\nLogins zum Testen (alle Passwort „${MEMBER_PW}"):`);
  console.log(`  Admin    : ${KEEP_ADMIN_EMAIL} / dartshub123`);
  console.log('  Captain  : sandra.koester@sv-adler.de');
  console.log('  Spieler  : daniel.weber@sv-adler.de');
  console.log('  Zuschauer: schriftfuehrung@sv-adler.de (nur Lesen)');
  console.log('  Inaktiv  : t.reiter@web.de (Login gesperrt → gut zum Testen der Sperre)');
}

main().catch((e) => {
  console.error('FEHLER:', e?.response?.data ? JSON.stringify(e.response.data, null, 2) : e);
  process.exit(1);
});
