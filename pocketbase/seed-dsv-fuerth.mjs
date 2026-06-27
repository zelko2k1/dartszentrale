// Importiert eine FRISCHE DartsHub-Datenbank für den Verein "DSV Fürth 86".
// Saison 2026/27 (Anfang September 2026 – Ende Juli 2027), 20 Mitglieder (als Spieler UND Benutzer),
// 2 Mannschaften (je 8 Spieler + Kapitän), 2 Ligen mit je 10 Teams und vollständigem
// Hin-/Rückrunden-Spielplan (ohne Ergebnisse, Termine über die Saison verteilt).
//
// Idempotent: leert die Inhalts-Collections vorher und legt frisch an (App-Admin bleibt).
// Aufruf:  node seed-dsv-fuerth.mjs
import PocketBase from '../app/node_modules/pocketbase/dist/pocketbase.es.mjs';

const URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const SU_EMAIL = process.env.PB_SU_EMAIL || 'admin@dartshub.local';
const SU_PASS = process.env.PB_SU_PASS || 'dartshub-admin-2026';
const KEEP_ADMIN_EMAIL = process.env.APP_ADMIN_EMAIL || 'chef@dartshub.local';
const MEMBER_PW = 'dartshub123';

const CLUB = 'DSV Fürth 86';
const DOMAIN = 'dsv-fuerth.de';
const SEASON = '2026/27';
const SEASON_START = '2026-09-04'; // erster Spieltag (Anfang September)
const SEASON_END = '2027-07-30';   // letzter Spieltag (Ende Juli)

const pb = new PocketBase(URL);
pb.autoCancellation(false);

const ALPHA = 'abcdefghijklmnopqrstuvwxyz0123456789';
const uid = () => Array.from({ length: 15 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
const initials = (name) => { const p = name.trim().split(/\s+/); return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase(); };
const slug = (s) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z]/g, '');

async function wipe(coll, filter = '') {
  const list = await pb.collection(coll).getFullList({ requestKey: null, ...(filter ? { filter } : {}) });
  for (const r of list) await pb.collection(coll).delete(r.id);
  return list.length;
}

// Round-Robin (Kreis-Methode): n-1 Runden, je n/2 Paarungen.
function roundRobin(ids) {
  const a = ids.slice();
  const n = a.length;
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) pairs.push([a[i], a[n - 1 - i]]);
    rounds.push(pairs);
    a.splice(1, 0, a.pop()); // erstes Element fix, Rest rotieren
  }
  return rounds;
}
// count Spieltags-Daten gleichmäßig zwischen START und END verteilen.
function matchdayDates(count) {
  const start = new Date(SEASON_START + 'T00:00:00Z').getTime();
  const end = new Date(SEASON_END + 'T00:00:00Z').getTime();
  const span = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, i) => new Date(start + span * i).toISOString().slice(0, 10));
}

// Vollständiger Hin-/Rückrunden-Spielplan ohne Ergebnis. Rückrunde = Hinrunde mit getauschtem Heimrecht.
function buildFixtures(lteams) {
  const rr = roundRobin(lteams.map((t) => t.id)); // n-1 Runden
  const dates = matchdayDates(rr.length * 2);
  const fx = (homeId, awayId, date) => ({ id: uid(), homeId, awayId, date, played: false, hs: '', as: '' });
  const fixtures = [];
  rr.forEach((pairs, r) => pairs.forEach(([h, a]) => fixtures.push(fx(h, a, dates[r]))));           // Hinrunde
  rr.forEach((pairs, r) => pairs.forEach(([h, a]) => fixtures.push(fx(a, h, dates[rr.length + r])))); // Rückrunde
  return fixtures;
}

async function main() {
  await pb.collection('_superusers').authWithPassword(SU_EMAIL, SU_PASS);
  console.log('✓ Als Superuser angemeldet\n');

  for (const c of ['season_snapshots', 'matches', 'events', 'leagues', 'teams', 'user_prefs', 'players', 'seasons']) {
    const n = await wipe(c);
    console.log(`  geleert: ${c} (${n})`);
  }
  const delUsers = await wipe('users', `email != "${KEEP_ADMIN_EMAIL}"`);
  console.log(`  geleert: users (${delUsers}, App-Admin behalten)\n`);

  // App-Admin sicherstellen (idempotent): auf frischer DB existiert er noch nicht,
  // der wipe oben behält ihn nur. Hier anlegen bzw. Rolle/Passwort geradeziehen.
  const found = await pb.collection('users').getList(1, 1, { filter: `email="${KEEP_ADMIN_EMAIL}"` });
  if (found.items.length) {
    await pb.collection('users').update(found.items[0].id, { password: MEMBER_PW, passwordConfirm: MEMBER_PW, role: 'admin', active: true, verified: true });
    console.log(`✓ App-Admin aktualisiert: ${KEEP_ADMIN_EMAIL} / ${MEMBER_PW}`);
  } else {
    await pb.collection('users').create({
      email: KEEP_ADMIN_EMAIL, password: MEMBER_PW, passwordConfirm: MEMBER_PW,
      emailVisibility: true, verified: true, active: true,
      name: 'Vereins-Admin', first: 'Vereins', last: 'Admin', role: 'admin', last_login: '—',
    });
    console.log(`✓ App-Admin angelegt: ${KEEP_ADMIN_EMAIL} / ${MEMBER_PW}`);
  }

  // 1) Saison 2026/27 (Anfang Sept – Ende Juli)
  const season = await pb.collection('seasons').create({ id: uid(), name: SEASON, status: 'active', startDate: SEASON_START, endDate: SEASON_END });
  const SID = season.id;
  console.log(`✓ Saison ${SEASON} (${SEASON_START} – ${SEASON_END}) angelegt`);

  // 2) 20 Mitglieder → Spieler + Benutzerkonto
  const NAMES = [
    ['Michael', 'Bauer'], ['Thomas', 'Wagner'], ['Andreas', 'Becker'], ['Stefan', 'Hoffmann'],
    ['Christian', 'Schäfer'], ['Markus', 'Koch'], ['Tobias', 'Richter'], ['Florian', 'Klein'],
    ['Sebastian', 'Wolf'], ['Daniel', 'Schröder'], ['Matthias', 'Neumann'], ['Alexander', 'Schwarz'],
    ['Patrick', 'Zimmermann'], ['Dominik', 'Braun'], ['Julian', 'Krüger'], ['Fabian', 'Hartmann'],
    ['Lukas', 'Lange'], ['Simon', 'Werner'], ['Philipp', 'Krause'], ['Niklas', 'Maier'],
  ];
  const CAPTAINS = new Set([0, 8]); // Kapitän 1. bzw. 2. Mannschaft
  const players = [];
  for (let i = 0; i < NAMES.length; i++) {
    const [first, last] = NAMES[i];
    const name = `${first} ${last}`;
    const player = await pb.collection('players').create({ id: uid(), name, short: initials(name), avi: i % 8 });
    const role = CAPTAINS.has(i) ? 'captain' : 'player';
    await pb.collection('users').create({
      email: `${slug(first)}.${slug(last)}@${DOMAIN}`, password: MEMBER_PW, passwordConfirm: MEMBER_PW,
      emailVisibility: true, verified: true, name, first, last, role, playerId: player.id,
      position: CAPTAINS.has(i) ? 'Mannschaftsführer' : '', active: true, avi: i % 8, last_login: '—',
    });
    players.push(player);
  }
  console.log(`✓ ${players.length} Mitglieder als Spieler + Benutzer angelegt (Passwort: ${MEMBER_PW})`);
  const P = (i) => players[i].id;

  // 3) 2 Mannschaften (je 8 Spieler + Kapitän)
  await pb.collection('teams').create({
    id: uid(), name: '1. Mannschaft', league: 'Bezirksoberliga Mittelfranken', kind: 'league', seasonId: SID,
    memberIds: [0, 1, 2, 3, 4, 5, 6, 7].map(P), captainId: P(0), viceCaptainIds: [],
  });
  await pb.collection('teams').create({
    id: uid(), name: '2. Mannschaft', league: 'Bezirksliga Mittelfranken', kind: 'league', seasonId: SID,
    memberIds: [8, 9, 10, 11, 12, 13, 14, 15].map(P), captainId: P(8), viceCaptainIds: [],
  });
  console.log('✓ 2 Mannschaften angelegt (je 8 Spieler + Kapitän); 4 Mitglieder ohne Mannschaft');

  // 4) 2 Ligen mit je 10 Teams + vollständigem Hin-/Rückrunden-Spielplan (ohne Ergebnis)
  const tm = (name, own) => ({ id: uid(), name, own: !!own });
  const OPP1 = ['DC Falken Nürnberg', 'Bulls Eye Erlangen', 'DSC Schwabach', 'Adler Zirndorf', 'Steel Kings Fürth', 'DC Phoenix Ansbach', 'Red Dragons Roth', 'Checkout Crew Cadolzburg', '180 Club Stein'];
  const OPP2 = OPP1.map((n) => n + ' II');
  const league1Teams = [tm('DSV Fürth 86 I', true), ...OPP1.map((n) => tm(n))];
  const league2Teams = [tm('DSV Fürth 86 II', true), ...OPP2.map((n) => tm(n))];
  const ligen = [
    { name: 'Bezirksoberliga Mittelfranken', teams: league1Teams, fixtures: buildFixtures(league1Teams) },
    { name: 'Bezirksliga Mittelfranken', teams: league2Teams, fixtures: buildFixtures(league2Teams) },
  ];
  for (const lg of ligen) {
    await pb.collection('leagues').create({ id: uid(), name: lg.name, season: SEASON, seasonId: SID, kind: 'league', teams: lg.teams, fixtures: lg.fixtures });
  }
  const perLeague = (league1Teams.length - 1) * league1Teams.length; // 90 bei 10 Teams
  console.log(`✓ 2 Ligen à 10 Teams angelegt, je ${perLeague} Begegnungen (Hin-/Rückrunde, ohne Ergebnis)`);

  // 4b) Spieltage der EIGENEN Mannschaften als Kalender-Termine (Ligaspiel), verknüpft per fixtureId
  let spieltage = 0;
  for (const lg of ligen) {
    const own = lg.teams.find((t) => t.own); if (!own) continue;
    const nameById = Object.fromEntries(lg.teams.map((t) => [t.id, t.name]));
    for (const fx of lg.fixtures) {
      if (fx.homeId !== own.id && fx.awayId !== own.id) continue;
      const ownIsHome = fx.homeId === own.id;
      await pb.collection('events').create({
        id: uid(), scope: 'verein', title: `${nameById[fx.homeId]} – ${nameById[fx.awayId]}`,
        date: fx.date, time: '', type: 'ligaspiel', loc: ownIsHome ? 'Heim' : 'Auswärts', seasonId: SID, fixtureId: fx.id,
      });
      spieltage++;
    }
  }
  console.log(`✓ ${spieltage} Spieltage der eigenen Mannschaften in den Kalender eingetragen`);

  // 5) Ein paar Vereinstermine über die Saison
  const events = [
    ['Saisonstart & Auslosung', SEASON_START, '19:00', 'verein', 'Vereinsheim'],
    ['Mannschaftstraining', '2026-09-11', '19:00', 'training', 'Vereinsheim'],
    ['Weihnachtsfeier', '2026-12-18', '18:00', 'verein', 'Gaststätte'],
    ['Jahreshauptversammlung', '2027-03-12', '19:00', 'verein', 'Vereinsheim'],
  ];
  for (const [title, date, time, type, loc] of events) {
    await pb.collection('events').create({ id: uid(), title, date, time, type, loc, scope: 'verein', seasonId: SID });
  }
  console.log(`✓ ${events.length} Vereinstermine angelegt`);

  // 6) Vereinsname
  let cfg; try { cfg = await pb.collection('club_config').getFirstListItem('', { requestKey: null }); } catch { /* none */ }
  const cfgBody = { clubName: CLUB, clubLogo: null };
  if (cfg) await pb.collection('club_config').update(cfg.id, cfgBody); else await pb.collection('club_config').create(cfgBody);
  console.log(`✓ Vereinsname gesetzt: ${CLUB}`);

  console.log('\nFertig. Datenbank für „DSV Fürth 86" steht bereit.');
  console.log(`\nLogins (alle Passwort „${MEMBER_PW}"):`);
  console.log(`  Admin            : ${KEEP_ADMIN_EMAIL} / dartshub123`);
  console.log(`  Kapitän 1. Mann. : ${slug(NAMES[0][0])}.${slug(NAMES[0][1])}@${DOMAIN}`);
  console.log(`  Kapitän 2. Mann. : ${slug(NAMES[8][0])}.${slug(NAMES[8][1])}@${DOMAIN}`);
  console.log(`  Spieler (Beispiel): ${slug(NAMES[1][0])}.${slug(NAMES[1][1])}@${DOMAIN}`);
}

main().catch((e) => {
  console.error('FEHLER:', e?.response?.data ? JSON.stringify(e.response.data, null, 2) : e);
  process.exit(1);
});
