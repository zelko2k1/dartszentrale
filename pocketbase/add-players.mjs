// Legt 70 zusaetzliche Spieler in der lokalen PocketBase an (additiv, loescht nichts).
// Zum Befuellen von Kadern und Testen des Ligamodus.
// Aufruf:  node add-players.mjs
import PocketBase from '../app/node_modules/pocketbase/dist/pocketbase.es.mjs';

const URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const SU_EMAIL = process.env.PB_SU_EMAIL || 'admin@dartshub.local';
const SU_PASS = process.env.PB_SU_PASS || 'dartshub-admin-2026';
const COUNT = Number(process.env.COUNT || 70);

const pb = new PocketBase(URL);
pb.autoCancellation(false);

const ALPHA = 'abcdefghijklmnopqrstuvwxyz0123456789';
const uid = () => Array.from({ length: 15 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
const initials = (name) => { const p = name.trim().split(/\s+/); return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase(); };

const FIRST = [
  'Lukas', 'Daniel', 'Marco', 'Stefan', 'Tim', 'Andre', 'Kevin', 'Patrick', 'Sven', 'Florian',
  'Jens', 'Tobias', 'Maximilian', 'Felix', 'Jonas', 'Niklas', 'Leon', 'Paul', 'Finn', 'Elias',
  'Dennis', 'Christian', 'Michael', 'Thomas', 'Sebastian', 'Alexander', 'Matthias', 'Robert', 'Markus', 'Oliver',
  'Dominik', 'Fabian', 'Philipp', 'Simon', 'David', 'Erik', 'Jan', 'Nico', 'Pascal', 'Manuel',
  'Sandra', 'Petra', 'Julia', 'Lena', 'Anna', 'Laura', 'Sarah', 'Nina', 'Katrin', 'Melanie',
];
const LAST = [
  'Brandt', 'Weber', 'Hansen', 'Koehler', 'Berger', 'Voss', 'Schmidt', 'Wolf', 'Richter', 'Neumann',
  'Hofer', 'Reiter', 'Mueller', 'Fischer', 'Becker', 'Schulz', 'Hoffmann', 'Schaefer', 'Koch', 'Bauer',
  'Klein', 'Wagner', 'Schmitt', 'Lang', 'Krause', 'Werner', 'Lehmann', 'Krueger', 'Hartmann', 'Lange',
  'Schmid', 'Maier', 'Vogel', 'Friedrich', 'Keller', 'Guenther', 'Frank', 'Berg', 'Winter', 'Sommer',
  'Koester', 'Engel', 'Roth', 'Busch', 'Seidel', 'Braun', 'Kraus', 'Foerster', 'Gross', 'Walter',
];

async function main() {
  await pb.collection('_superusers').authWithPassword(SU_EMAIL, SU_PASS);
  console.log('OK Als Superuser angemeldet');

  const existing = await pb.collection('players').getFullList({ requestKey: null });
  const used = new Set(existing.map((p) => (p.name || '').toLowerCase()));
  console.log(`Vorhandene Spieler: ${existing.length}`);

  let created = 0, attempts = 0;
  while (created < COUNT && attempts < COUNT * 50) {
    attempts++;
    const first = FIRST[Math.floor(Math.random() * FIRST.length)];
    const last = LAST[Math.floor(Math.random() * LAST.length)];
    const name = `${first} ${last}`;
    if (used.has(name.toLowerCase())) continue;
    used.add(name.toLowerCase());
    await pb.collection('players').create({ id: uid(), name, short: initials(name), avi: created % 8 });
    created++;
  }

  console.log(`OK ${created} neue Spieler angelegt`);
  const total = await pb.collection('players').getFullList({ requestKey: null });
  console.log(`Spieler gesamt: ${total.length}`);
}

main().catch((e) => {
  console.error('FEHLER:', e?.response?.data ? JSON.stringify(e.response.data, null, 2) : e);
  process.exit(1);
});
