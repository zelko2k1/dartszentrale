/// <reference path="../pb_data/types.d.ts" />
// ═══════ nuLiga-Import — Fetch/Parse-Proxy (Hook) ═══════
// Server-seitiger Abruf der nuLiga-Gruppenseite (CORS: der Browser darf nuLiga nicht direkt holen).
//   POST /api/nuliga/fetch  { url }  → { championship, group, sourceUrl, fetchedAt, fixtures[] }  (nur Admin)
// Der Hook ist bewusst DÜNN: er holt die Meetings-Seite und parst den `result-set`-Block in geparste
// Begegnungen. Merge + Vorrang/Konflikt-Logik laufen im FRONTEND (app/src/lib/nuligaImport.ts), damit die
// bestehende, getestete Liga-Logik (Tabelle rechnen, Aufstellungen, Kalender) wiederverwendet wird.
// Plan/Struktur: docs/plan-nuliga-import.md (Revision 2026-07-12) + spikes/nuliga/README.md.
//
// WICHTIG (PB-JSVM): Jeder Handler läuft in einer ISOLIERTEN VM — kein Modul-Scope. Alle Helfer daher
// INLINE im Handler. PB-Globals ($http/$apis/toString/*Error) sind je VM injiziert.
routerAdd('POST', '/api/nuliga/fetch', (e) => {
  const auth = e.auth;
  if (!auth) throw new ForbiddenError('Anmeldung erforderlich.');
  if (auth.get('role') !== 'admin') throw new ForbiddenError('Nur Admins dürfen nuLiga abrufen.');

  const data = new DynamicModel({ url: '' });
  e.bindBody(data);
  const rawUrl = ('' + (data.url || '')).trim();
  if (!rawUrl) throw new BadRequestError('Es wurde keine nuLiga-URL übergeben.');

  // ── URL prüfen (SSRF-Schutz: nur nuLiga-Hosts) und kanonische Meetings-URL bauen ──
  const hostMatch = rawUrl.match(/^https?:\/\/([^/]+)(\/[^?#]*)/i);
  if (!hostMatch) throw new BadRequestError('Ungültige URL.');
  const host = hostMatch[1].toLowerCase();
  if (!/(^|\.)liga\.nu$/.test(host)) throw new BadRequestError('Nur nuLiga-Adressen (…liga.nu) sind erlaubt.');
  const baseMatch = rawUrl.match(/^(https?:\/\/[^/]+\/.*\/)groupPage/i);
  if (!baseMatch) throw new BadRequestError('Das ist keine nuLiga-Gruppenseite (groupPage). Bitte die Spielplan-/Tabellenseite der Gruppe verwenden.');
  const champM = rawUrl.match(/[?&]championship=([^&#]+)/i);
  const groupM = rawUrl.match(/[?&]group=([^&#]+)/i);
  if (!champM || !groupM) throw new BadRequestError('In der URL fehlen championship und/oder group. Bitte die vollständige Gruppen-URL einfügen.');
  const champEnc = champM[1];           // verbatim (bereits url-enkodiert, z. B. MFr+2025%2F26)
  const groupEnc = groupM[1];
  let championship = ''; try { championship = decodeURIComponent(champEnc.replace(/\+/g, ' ')); } catch (_) { championship = champEnc; }
  const sourceUrl = baseMatch[1] + 'groupPage?championship=' + champEnc + '&group=' + groupEnc +
    '&displayTyp=gesamt&displayDetail=meetings';

  // ── Abruf (höflicher User-Agent, Timeout, 1 Retry) ──
  const UA = 'DartsZentrale/1.0 (+Vereins-Selbstabruf; nuLiga-Import)';
  function fetchOnce() {
    return $http.send({ url: sourceUrl, method: 'GET', headers: { 'User-Agent': UA }, timeout: 15 });
  }
  let res;
  try { res = fetchOnce(); if (res.statusCode !== 200) throw new Error('HTTP ' + res.statusCode); }
  catch (err1) {
    try { res = fetchOnce(); } catch (err2) { throw new BadRequestError('nuLiga ist nicht erreichbar: ' + err2); }
  }
  if (!res || res.statusCode !== 200) throw new BadRequestError('nuLiga antwortete mit HTTP ' + (res ? res.statusCode : '—') + '.');
  const html = toString(res.body);
  if (!html || html.indexOf('result-set') < 0) {
    throw new BadRequestError('Die nuLiga-Seite enthält keinen Spielplan (result-set). URL/Gruppe prüfen.');
  }

  // ── Parser (inline) — verifiziert gegen spikes/nuliga/README.md ──
  function decodeEntities(s) {
    if (!s) return '';
    return s
      .replace(/&nbsp;/g, ' ').replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü')
      .replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö').replace(/&Uuml;/g, 'Ü').replace(/&szlig;/g, 'ß')
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&#(\d+);/g, function (_m, n) { try { return String.fromCharCode(parseInt(n, 10)); } catch (_) { return ''; } });
  }
  function textOf(cell) { return decodeEntities(('' + cell).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(); }
  function venueOf(cell) { const m = ('' + cell).match(/title="([^"]*)"/i); return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : ''; }
  function isoDate(de) { const m = ('' + de).match(/(\d{2})\.(\d{2})\.(\d{4})/); return m ? (m[3] + '-' + m[2] + '-' + m[1]) : ''; }
  function hhmm(s) { const m = ('' + s).match(/(\d{1,2}):(\d{2})/); if (!m) return ''; const h = m[1].length < 2 ? '0' + m[1] : m[1]; return h + ':' + m[2]; }
  // Pokal-Runden (nuLiga liefert sie englisch als Abschnitts-Überschrift) → deutsche Bezeichnung.
  function germanRound(s) {
    const t = ('' + s).replace(/\s+/g, ' ').trim();
    const map = { 'Final': 'Finale', 'Semifinal': 'Halbfinale', 'Quarterfinal': 'Viertelfinale', 'Round of 16': 'Achtelfinale', 'Round of 32': 'Runde der letzten 32' };
    if (map[t]) return map[t];
    let m = t.match(/^(\d+)\.\s*Round$/i); if (m) return m[1] + '. Runde';
    m = t.match(/^Freilose\s+(\d+)\.\s*Round$/i); if (m) return 'Freilose ' + m[1] + '. Runde';
    return t;
  }

  const tblM = html.match(/<table[^>]*class="result-set"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tblM) throw new BadRequestError('Spielplan-Tabelle nicht gefunden.');
  const table = tblM[1];

  // Spaltenindizes aus der Kopfzeile ableiten (colspan berücksichtigt): Liga = Heim/Gast/Spiele 4/5/6,
  // Pokal (mit Zusatzspalten Runde+Nr.) = 6/7/8. Datum/Zeit/Spiellokal liegen in beiden Layouts bei 1/2/3.
  function headerCols(tableHtml) {
    const idx = { home: 4, away: 5, result: 6 }; // Fallback = Liga-Layout
    const rows = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    let headRow = null;
    for (let i = 0; i < rows.length; i++) { if (/Heimmannschaft/i.test(rows[i])) { headRow = rows[i]; break; } }
    if (!headRow) return idx;
    const thRe = /<th([^>]*)>([\s\S]*?)<\/th>/gi;
    let m, phys = 0;
    while ((m = thRe.exec(headRow)) !== null) {
      const cs = m[1].match(/colspan\s*=\s*"?(\d+)"?/i);
      const span = cs ? parseInt(cs[1], 10) : 1;
      const label = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (label === 'Heimmannschaft') idx.home = phys;
      else if (label === 'Gastmannschaft') idx.away = phys;
      else if (label === 'Spiele') idx.result = phys;
      phys += span;
    }
    return idx;
  }
  const col = headerCols(table);

  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const fixtures = [];
  let lastDate = '';
  let currentRound = ''; // Pokal: aktuelle Runde (aus der Abschnitts-Überschrift, wird fortgeschrieben)
  let tr;
  while ((tr = trRe.exec(table)) !== null) {
    const row = tr[1];
    if (/<th[\s>]/i.test(row)) continue; // Kopf- bzw. Spalten-Header-Zeile
    const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi);
    if (!cells) continue;
    // Runden-Abschnittstitel (Pokal): eine Zelle (colspan) mit <h2>Runde</h2>.
    if (cells.length === 1) { const t = textOf(cells[0]); if (t) currentRound = germanRound(t); continue; }
    if (cells.length <= col.result) continue; // zu kurz (Freilos o. Ä.)
    const dateRaw = textOf(cells[1]);
    const date = isoDate(dateRaw) || lastDate;
    if (isoDate(dateRaw)) lastDate = isoDate(dateRaw);
    const time = hhmm(textOf(cells[2]));
    const loc = cells.length > 3 ? venueOf(cells[3]) : '';
    const home = textOf(cells[col.home]);
    const away = textOf(cells[col.away]);
    if (!home || !away) continue; // Freilos/unvollständig
    const resTxt = textOf(cells[col.result]);
    const rm = resTxt.match(/(\d+)\s*:\s*(\d+)/);
    const played = !!rm;
    fixtures.push({
      date: date,
      time: time,
      loc: loc,
      round: currentRound,
      home: home,
      away: away,
      hs: played ? parseInt(rm[1], 10) : null,
      as: played ? parseInt(rm[2], 10) : null,
      played: played,
    });
  }

  return e.json(200, {
    championship: championship,
    group: groupEnc,
    sourceUrl: sourceUrl,
    fetchedAt: new Date().toISOString(),
    count: fixtures.length,
    fixtures: fixtures,
  });
}, $apis.requireAuth('users'));
