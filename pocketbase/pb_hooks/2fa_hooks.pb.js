/// <reference path="../pb_data/types.d.ts" />
// ═══════ 2FA / TOTP — Hooks (Phase B) ═══════
// Endpunkte für Enrollment. Serverseitig, nur Vereins-/Server-Modus. Plan: docs/plan-2fa.md §4.
//   POST /api/2fa/setup   — Secret erzeugen, `pending`-Datensatz anlegen, otpauth://-URI + Secret zurück
//   POST /api/2fa/enable  — übergebenen TOTP-Code prüfen → `enabled`; Backup-Codes (einmalig zurück, gehasht)
//
// WICHTIG (PB-JSVM): Jeder Handler läuft in einer ISOLIERTEN VM — KEIN Zugriff auf Modul-Scope.
// Alle Helfer (TOTP/SHA-1/HMAC-SHA1/Base32) daher INLINE im jeweiligen Handler. PB-Globals
// ($app/$security/$apis/Record/DynamicModel/*Error) sind je VM injiziert und dürfen genutzt werden.
// Die abgeschottete Collection `user_mfa` (alle Rules null) wird nur hier über App-Kontext beschrieben.

// ---- POST /api/2fa/setup -------------------------------------------------
routerAdd('POST', '/api/2fa/setup', (e) => {
  const auth = e.auth;
  if (!auth) throw new ForbiddenError('Anmeldung erforderlich.');
  const userId = auth.id;
  const email = auth.getString('email');

  // Vorhandenen MFA-Datensatz suchen (0/1 pro Nutzer via unique-Index).
  let rec = null;
  try { rec = e.app.findFirstRecordByFilter('user_mfa', 'user = {:uid}', { uid: userId }); } catch (_) { rec = null; }
  if (rec && rec.getBool('enabled')) {
    throw new BadRequestError('2FA ist bereits aktiv. Bitte zuerst deaktivieren, um neu einzurichten.');
  }

  // Neues Base32-Secret (32 Zeichen = 160 Bit, RFC-4648-Alphabet, krypto-sicher via crypto/rand).
  const secret = $security.randomStringWithAlphabet(32, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567');

  if (!rec) {
    const col = e.app.findCollectionByNameOrId('user_mfa');
    rec = new Record(col);
    rec.set('user', userId);
  }
  rec.set('secret', secret);
  rec.set('pending', true);
  rec.set('enabled', false);
  rec.set('failedAttempts', 0);
  rec.set('lockedUntil', '');
  e.app.save(rec);

  // otpauth://-URI für QR (SHA1/6/30 = universeller Authenticator-Default).
  const issuer = 'DartsZentrale';
  const label = encodeURIComponent(issuer) + ':' + encodeURIComponent(email || userId);
  const uri = 'otpauth://totp/' + label +
    '?secret=' + secret +
    '&issuer=' + encodeURIComponent(issuer) +
    '&algorithm=SHA1&digits=6&period=30';

  return e.json(200, { secret: secret, otpauth_uri: uri, issuer: issuer, account: email });
}, $apis.requireAuth('users'));

// ---- GET /api/2fa/status — ist 2FA für den eingeloggten Nutzer aktiv? -----
// Die Collection user_mfa ist abgeschottet; die Settings-UI erfährt den Status nur hierüber.
routerAdd('GET', '/api/2fa/status', (e) => {
  const auth = e.auth;
  if (!auth) throw new ForbiddenError('Anmeldung erforderlich.');
  let enabled = false, pending = false;
  try {
    const mfa = e.app.findFirstRecordByFilter('user_mfa', 'user = {:uid}', { uid: auth.id });
    enabled = mfa.getBool('enabled');
    pending = mfa.getBool('pending');
  } catch (_) { /* kein Datensatz → 2FA aus */ }
  return e.json(200, { enabled: enabled, pending: pending });
}, $apis.requireAuth('users'));

// ---- POST /api/2fa/enable ------------------------------------------------
routerAdd('POST', '/api/2fa/enable', (e) => {
  const auth = e.auth;
  if (!auth) throw new ForbiddenError('Anmeldung erforderlich.');
  const userId = auth.id;

  const data = new DynamicModel({ code: '' });
  e.bindBody(data);
  const code = ('' + (data.code || '')).replace(/\s+/g, '');
  if (!/^[0-9]{6}$/.test(code)) throw new BadRequestError('Bitte einen 6-stelligen Code aus der Authenticator-App eingeben.');

  let rec;
  try { rec = e.app.findFirstRecordByFilter('user_mfa', 'user = {:uid}', { uid: userId }); }
  catch (_) { throw new BadRequestError('Kein 2FA-Setup gefunden. Bitte zuerst die Einrichtung starten.'); }
  if (rec.getBool('enabled')) throw new BadRequestError('2FA ist bereits aktiv.');
  const secret = rec.getString('secret');
  if (!secret) throw new BadRequestError('Kein 2FA-Setup gefunden. Bitte zuerst die Einrichtung starten.');

  // ===== INLINE TOTP-Verifikation (SHA-1 + HMAC-SHA1 + Base32; im Spike gegen RFC 6238 bewiesen) =====
  function sha1Bytes(bytes) {
    var ml = bytes.length * 8;
    var msg = bytes.slice(); msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0x00);
    var hi = Math.floor(ml / 0x100000000), lo = ml >>> 0;
    msg.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
    msg.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);
    var h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
    function rol(n, s) { return ((n << s) | (n >>> (32 - s))) >>> 0; }
    for (var i = 0; i < msg.length; i += 64) {
      var w = new Array(80);
      for (var j = 0; j < 16; j++)
        w[j] = ((msg[i + j*4] << 24) | (msg[i + j*4+1] << 16) | (msg[i + j*4+2] << 8) | (msg[i + j*4+3])) >>> 0;
      for (var t = 16; t < 80; t++) w[t] = rol((w[t-3] ^ w[t-8] ^ w[t-14] ^ w[t-16]) >>> 0, 1);
      var a = h0, b = h1, c = h2, d = h3, ee = h4;
      for (var k = 0; k < 80; k++) {
        var f, kc;
        if (k < 20) { f = (b & c) | ((~b) & d); kc = 0x5A827999; }
        else if (k < 40) { f = b ^ c ^ d; kc = 0x6ED9EBA1; }
        else if (k < 60) { f = (b & c) | (b & d) | (c & d); kc = 0x8F1BBCDC; }
        else { f = b ^ c ^ d; kc = 0xCA62C1D6; }
        var tmp = (rol(a, 5) + (f >>> 0) + ee + kc + w[k]) >>> 0;
        ee = d; d = c; c = rol(b, 30); b = a; a = tmp;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + ee) >>> 0;
    }
    var out = [], hs = [h0, h1, h2, h3, h4];
    for (var x = 0; x < 5; x++) out.push((hs[x] >>> 24) & 0xff, (hs[x] >>> 16) & 0xff, (hs[x] >>> 8) & 0xff, hs[x] & 0xff);
    return out;
  }
  function hmacSha1(key, msg) {
    var bs = 64;
    if (key.length > bs) key = sha1Bytes(key);
    var k = key.slice();
    while (k.length < bs) k.push(0x00);
    var ipad = [], opad = [];
    for (var i = 0; i < bs; i++) { ipad.push((k[i] ^ 0x36) & 0xff); opad.push((k[i] ^ 0x5c) & 0xff); }
    return sha1Bytes(opad.concat(sha1Bytes(ipad.concat(msg))));
  }
  function base32Decode(s) {
    var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    s = ('' + s).toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    var bits = 0, value = 0, out = [];
    for (var i = 0; i < s.length; i++) {
      var idx = A.indexOf(s.charAt(i));
      if (idx === -1) throw new BadRequestError('Ungültiges Secret.');
      value = (value << 5) | idx; bits += 5;
      if (bits >= 8) { bits -= 8; out.push((value >>> bits) & 0xff); }
    }
    return out;
  }
  function hotp(keyBytes, counter, digits) {
    var hi = Math.floor(counter / 0x100000000), lo = counter >>> 0;
    var cb = [(hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff,
              (lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff];
    var hmac = hmacSha1(keyBytes, cb);
    var off = hmac[19] & 0x0f;
    var bin = ((hmac[off] & 0x7f) << 24) | ((hmac[off+1] & 0xff) << 16) | ((hmac[off+2] & 0xff) << 8) | (hmac[off+3] & 0xff);
    var out = (bin % Math.pow(10, digits)).toString();
    while (out.length < digits) out = '0' + out;
    return out;
  }
  function verifyTotp(secretB32, token, unixSeconds, step, digits, windowSteps) {
    var key = base32Decode(secretB32);
    var counter = Math.floor(unixSeconds / step);
    var ok = false;
    for (var w = -windowSteps; w <= windowSteps; w++) {
      var cand = hotp(key, counter + w, digits);
      if (cand.length === token.length) {
        var diff = 0;
        for (var i = 0; i < cand.length; i++) diff |= (cand.charCodeAt(i) ^ token.charCodeAt(i));
        if (diff === 0) ok = true; // konstante Zeit: nicht abbrechen
      }
    }
    return ok;
  }
  // ===================================================================================

  const now = Math.floor(Date.now() / 1000);
  if (!verifyTotp(secret, code, now, 30, 6, 1)) {
    throw new BadRequestError('Code ungültig. Bitte den aktuellen 6-stelligen Code erneut eingeben.');
  }

  // Backup-Codes: 10× 8-stellig, gehasht (sha256) mit used-Flag gespeichert; Klartext EINMALIG zurück.
  const plain = [], stored = [];
  for (let i = 0; i < 10; i++) {
    const bc = $security.randomStringWithAlphabet(8, '0123456789');
    plain.push(bc);
    stored.push({ h: $security.sha256(bc), used: false });
  }

  rec.set('enabled', true);
  rec.set('pending', false);
  rec.set('backupCodes', stored);
  rec.set('failedAttempts', 0);
  rec.set('lockedUntil', '');
  rec.set('confirmedAt', new Date().toISOString());
  e.app.save(rec);

  return e.json(200, { enabled: true, backupCodes: plain });
}, $apis.requireAuth('users'));

// ---- POST /api/login — zentraler Login MIT 2FA-Challenge (Plan §5) --------
// Ersetzt den direkten authWithPassword-Aufruf: 2FA greift VOR der Token-Ausgabe.
//   - kein 2FA aktiv           → sofort Token (Verhalten wie bisher; opt-in)
//   - 2FA aktiv, kein Code      → { mfa_required: true }, KEIN Token
//   - 2FA aktiv, Code gültig    → Token (TOTP ODER Backup-Code)
//   - 2FA aktiv, Code ungültig  → 400 { mfa_required: true, error }, Lockout nach 5 Fehlversuchen (5 min)
// KEIN requireAuth (öffentlicher Login-Endpunkt).
routerAdd('POST', '/api/login', (e) => {
  const data = new DynamicModel({ email: '', password: '', code: '' });
  e.bindBody(data);
  const email = ('' + (data.email || '')).trim();
  const password = '' + (data.password || '');
  const code = ('' + (data.code || '')).replace(/\s+/g, '');
  if (!email || !password) throw new BadRequestError('E-Mail und Passwort sind erforderlich.');

  // 1) Nutzer + Passwort. Generische Fehlermeldung (keine User-Enumeration).
  let user;
  try { user = e.app.findAuthRecordByEmail('users', email); }
  catch (_) { throw new BadRequestError('E-Mail oder Passwort ist falsch.'); }
  if (!user.validatePassword(password)) throw new BadRequestError('E-Mail oder Passwort ist falsch.');
  // Deaktivierte Konten dürfen sich nicht anmelden (entspricht authRule active = true).
  if (user.get('active') === false) throw new BadRequestError('Dieses Konto ist deaktiviert.');

  // 2) 2FA-Status laden (abgeschottete Collection, App-Kontext).
  let mfa = null;
  try { mfa = e.app.findFirstRecordByFilter('user_mfa', 'user = {:uid}', { uid: user.id }); } catch (_) { mfa = null; }
  const mfaOn = mfa && mfa.getBool('enabled');

  // 3) Kein 2FA → sofort Token (wie bisher).
  if (!mfaOn) {
    $apis.recordAuthResponse(e, user, 'password', null);
    return;
  }

  // 4) Lockout aktiv?
  const lockedUntil = mfa.getString('lockedUntil');
  if (lockedUntil) {
    const until = Date.parse(lockedUntil);
    if (!isNaN(until) && until > Date.now()) {
      return e.json(429, { mfa_required: true, error: 'Zu viele Fehlversuche. Bitte in einigen Minuten erneut versuchen.' });
    }
  }

  // 5) 2FA aktiv, aber kein Code → Challenge anfordern (kein Token).
  if (!code) return e.json(200, { mfa_required: true });

  // ===== INLINE TOTP-Verifikation (SHA-1 + HMAC-SHA1 + Base32; im Spike gegen RFC 6238 bewiesen) =====
  function sha1Bytes(bytes) {
    var ml = bytes.length * 8;
    var msg = bytes.slice(); msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0x00);
    var hi = Math.floor(ml / 0x100000000), lo = ml >>> 0;
    msg.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
    msg.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);
    var h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
    function rol(n, s) { return ((n << s) | (n >>> (32 - s))) >>> 0; }
    for (var i = 0; i < msg.length; i += 64) {
      var w = new Array(80);
      for (var j = 0; j < 16; j++)
        w[j] = ((msg[i + j*4] << 24) | (msg[i + j*4+1] << 16) | (msg[i + j*4+2] << 8) | (msg[i + j*4+3])) >>> 0;
      for (var t = 16; t < 80; t++) w[t] = rol((w[t-3] ^ w[t-8] ^ w[t-14] ^ w[t-16]) >>> 0, 1);
      var a = h0, b = h1, c = h2, d = h3, ee = h4;
      for (var k = 0; k < 80; k++) {
        var f, kc;
        if (k < 20) { f = (b & c) | ((~b) & d); kc = 0x5A827999; }
        else if (k < 40) { f = b ^ c ^ d; kc = 0x6ED9EBA1; }
        else if (k < 60) { f = (b & c) | (b & d) | (c & d); kc = 0x8F1BBCDC; }
        else { f = b ^ c ^ d; kc = 0xCA62C1D6; }
        var tmp = (rol(a, 5) + (f >>> 0) + ee + kc + w[k]) >>> 0;
        ee = d; d = c; c = rol(b, 30); b = a; a = tmp;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + ee) >>> 0;
    }
    var out = [], hs = [h0, h1, h2, h3, h4];
    for (var x = 0; x < 5; x++) out.push((hs[x] >>> 24) & 0xff, (hs[x] >>> 16) & 0xff, (hs[x] >>> 8) & 0xff, hs[x] & 0xff);
    return out;
  }
  function hmacSha1(key, msg) {
    var bs = 64;
    if (key.length > bs) key = sha1Bytes(key);
    var k = key.slice();
    while (k.length < bs) k.push(0x00);
    var ipad = [], opad = [];
    for (var i = 0; i < bs; i++) { ipad.push((k[i] ^ 0x36) & 0xff); opad.push((k[i] ^ 0x5c) & 0xff); }
    return sha1Bytes(opad.concat(sha1Bytes(ipad.concat(msg))));
  }
  function base32Decode(s) {
    var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    s = ('' + s).toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    var bits = 0, value = 0, out = [];
    for (var i = 0; i < s.length; i++) {
      var idx = A.indexOf(s.charAt(i));
      if (idx === -1) return [];
      value = (value << 5) | idx; bits += 5;
      if (bits >= 8) { bits -= 8; out.push((value >>> bits) & 0xff); }
    }
    return out;
  }
  function hotp(keyBytes, counter, digits) {
    var hi = Math.floor(counter / 0x100000000), lo = counter >>> 0;
    var cb = [(hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff,
              (lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff];
    var hmac = hmacSha1(keyBytes, cb);
    var off = hmac[19] & 0x0f;
    var bin = ((hmac[off] & 0x7f) << 24) | ((hmac[off+1] & 0xff) << 16) | ((hmac[off+2] & 0xff) << 8) | (hmac[off+3] & 0xff);
    var out = (bin % Math.pow(10, digits)).toString();
    while (out.length < digits) out = '0' + out;
    return out;
  }
  function verifyTotp(secretB32, token, unixSeconds, step, digits, windowSteps) {
    var key = base32Decode(secretB32);
    if (!key.length) return false;
    var counter = Math.floor(unixSeconds / step);
    var ok = false;
    for (var w = -windowSteps; w <= windowSteps; w++) {
      var cand = hotp(key, counter + w, digits);
      if (cand.length === token.length) {
        var diff = 0;
        for (var i = 0; i < cand.length; i++) diff |= (cand.charCodeAt(i) ^ token.charCodeAt(i));
        if (diff === 0) ok = true; // konstante Zeit
      }
    }
    return ok;
  }
  // ===================================================================================

  const secret = mfa.getString('secret');
  const now = Math.floor(Date.now() / 1000);
  let accepted = false;
  let usedBackup = false;

  // a) TOTP (6-stellig)?
  if (/^[0-9]{6}$/.test(code) && secret && verifyTotp(secret, code, now, 30, 6, 1)) {
    accepted = true;
  } else {
    // b) Backup-Code (8-stellig)? sha256-Hash gegen gespeicherte, ungebrauchte Codes (konstante Zeit).
    // PB-JSVM liefert json-Felder als ROHE UTF-8-Bytes (byte-Array) — erst zu String dekodieren, dann parsen.
    let backup = [];
    try {
      let raw = mfa.get('backupCodes');
      if (typeof raw === 'string') {
        backup = JSON.parse(raw);
      } else if (raw && typeof raw.length === 'number' && typeof raw[0] === 'number') {
        let str = '';
        for (let i = 0; i < raw.length; i++) str += String.fromCharCode(raw[i]);
        backup = JSON.parse(str);
      } else if (Array.isArray(raw)) {
        backup = raw; // bereits geparst (Fallback)
      }
    } catch (_) { backup = []; }
    if (!Array.isArray(backup)) backup = [];
    if (backup.length && /^[0-9]{8}$/.test(code)) {
      const h = $security.sha256(code);
      for (let i = 0; i < backup.length; i++) {
        if (backup[i] && backup[i].used === false && typeof backup[i].h === 'string' && $security.equal(backup[i].h, h)) {
          backup[i].used = true;
          accepted = true;
          usedBackup = true;
          mfa.set('backupCodes', backup); // verbrauchten Code entwerten
          break;
        }
      }
    }
  }

  if (!accepted) {
    // Fehlversuch zählen; ab 5 → 5 Minuten sperren.
    const failed = (mfa.get('failedAttempts') || 0) + 1;
    mfa.set('failedAttempts', failed);
    if (failed >= 5) {
      mfa.set('lockedUntil', new Date(Date.now() + 5 * 60 * 1000).toISOString());
      mfa.set('failedAttempts', 0);
      e.app.save(mfa);
      return e.json(429, { mfa_required: true, error: 'Zu viele Fehlversuche. Bitte in einigen Minuten erneut versuchen.' });
    }
    e.app.save(mfa);
    return e.json(400, { mfa_required: true, error: 'Code ungültig. Bitte erneut versuchen.' });
  }

  // 6) Code gültig → Zähler zurücksetzen, ggf. Backup entwerten, Token ausgeben.
  mfa.set('failedAttempts', 0);
  mfa.set('lockedUntil', '');
  e.app.save(mfa);
  $apis.recordAuthResponse(e, user, usedBackup ? 'backup_code' : 'password', null);
  return;
});

// ---- POST /api/2fa/disable — 2FA deaktivieren (Re-Auth nötig) ------------
// Erfordert Bestätigung durch gültigen TOTP-/Backup-Code ODER das Konto-Passwort,
// damit ein gekapertes Session-Token 2FA nicht einfach abschalten kann (Plan §4).
// WICHTIG (PB-JSVM): Handler laufen in isolierter VM — KEIN Modul-Scope. Der Re-Auth-Helfer
// MUSS handler-lokal sein (ein Top-Level-Helfer wirft ReferenceError → generischer 400).
routerAdd('POST', '/api/2fa/disable', (e) => {
  const auth = e.auth;
  if (!auth) throw new ForbiddenError('Anmeldung erforderlich.');

  const data = new DynamicModel({ code: '', password: '' });
  e.bindBody(data);
  const code = ('' + (data.code || '')).replace(/\s+/g, '');
  const password = '' + (data.password || '');
  if (!code && !password) throw new BadRequestError('Bitte zur Bestätigung den aktuellen Code oder das Passwort angeben.');

  let mfa;
  try { mfa = e.app.findFirstRecordByFilter('user_mfa', 'user = {:uid}', { uid: auth.id }); }
  catch (_) { throw new BadRequestError('2FA ist für dieses Konto nicht aktiv.'); }
  if (!mfa.getBool('enabled')) throw new BadRequestError('2FA ist für dieses Konto nicht aktiv.');

  // ── handler-lokale Re-Auth (Passwort ODER TOTP ODER Backup) ──
  function reauth() {
    if (password && auth.validatePassword(password)) return true;
    if (!code) return false;
    function sha1Bytes(bytes){var ml=bytes.length*8;var msg=bytes.slice();msg.push(0x80);while(msg.length%64!==56)msg.push(0x00);var hi=Math.floor(ml/0x100000000),lo=ml>>>0;msg.push((hi>>>24)&0xff,(hi>>>16)&0xff,(hi>>>8)&0xff,hi&0xff);msg.push((lo>>>24)&0xff,(lo>>>16)&0xff,(lo>>>8)&0xff,lo&0xff);var h0=0x67452301,h1=0xEFCDAB89,h2=0x98BADCFE,h3=0x10325476,h4=0xC3D2E1F0;function rol(n,s){return((n<<s)|(n>>>(32-s)))>>>0;}for(var i=0;i<msg.length;i+=64){var w=new Array(80);for(var j=0;j<16;j++)w[j]=((msg[i+j*4]<<24)|(msg[i+j*4+1]<<16)|(msg[i+j*4+2]<<8)|(msg[i+j*4+3]))>>>0;for(var t=16;t<80;t++)w[t]=rol((w[t-3]^w[t-8]^w[t-14]^w[t-16])>>>0,1);var a=h0,b=h1,c=h2,d=h3,ee=h4;for(var k=0;k<80;k++){var f,kc;if(k<20){f=(b&c)|((~b)&d);kc=0x5A827999;}else if(k<40){f=b^c^d;kc=0x6ED9EBA1;}else if(k<60){f=(b&c)|(b&d)|(c&d);kc=0x8F1BBCDC;}else{f=b^c^d;kc=0xCA62C1D6;}var tmp=(rol(a,5)+(f>>>0)+ee+kc+w[k])>>>0;ee=d;d=c;c=rol(b,30);b=a;a=tmp;}h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;h4=(h4+ee)>>>0;}var out=[],hs=[h0,h1,h2,h3,h4];for(var x=0;x<5;x++)out.push((hs[x]>>>24)&0xff,(hs[x]>>>16)&0xff,(hs[x]>>>8)&0xff,hs[x]&0xff);return out;}
    function hmacSha1(key,msg){var bs=64;if(key.length>bs)key=sha1Bytes(key);var k=key.slice();while(k.length<bs)k.push(0x00);var ipad=[],opad=[];for(var i=0;i<bs;i++){ipad.push((k[i]^0x36)&0xff);opad.push((k[i]^0x5c)&0xff);}return sha1Bytes(opad.concat(sha1Bytes(ipad.concat(msg))));}
    function base32Decode(s){var A='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';s=(''+s).toUpperCase().replace(/=+$/,'').replace(/\s+/g,'');var bits=0,value=0,out=[];for(var i=0;i<s.length;i++){var idx=A.indexOf(s.charAt(i));if(idx===-1)return[];value=(value<<5)|idx;bits+=5;if(bits>=8){bits-=8;out.push((value>>>bits)&0xff);}}return out;}
    function hotp(keyBytes,counter,digits){var hi=Math.floor(counter/0x100000000),lo=counter>>>0;var cb=[(hi>>>24)&0xff,(hi>>>16)&0xff,(hi>>>8)&0xff,hi&0xff,(lo>>>24)&0xff,(lo>>>16)&0xff,(lo>>>8)&0xff,lo&0xff];var hmac=hmacSha1(keyBytes,cb);var off=hmac[19]&0x0f;var bin=((hmac[off]&0x7f)<<24)|((hmac[off+1]&0xff)<<16)|((hmac[off+2]&0xff)<<8)|(hmac[off+3]&0xff);var o=(bin%Math.pow(10,digits)).toString();while(o.length<digits)o='0'+o;return o;}
    function verifyTotp(secretB32,token){var key=base32Decode(secretB32);if(!key.length)return false;var counter=Math.floor((Date.now()/1000)/30);var ok=false;for(var w=-1;w<=1;w++){var cand=hotp(key,counter+w,6);if(cand.length===token.length){var diff=0;for(var i=0;i<cand.length;i++)diff|=(cand.charCodeAt(i)^token.charCodeAt(i));if(diff===0)ok=true;}}return ok;}
    const secret = mfa.getString('secret');
    if (/^[0-9]{6}$/.test(code) && secret && verifyTotp(secret, code)) return true;
    if (/^[0-9]{8}$/.test(code)) {
      let backup = [];
      try {
        let raw = mfa.get('backupCodes');
        if (typeof raw === 'string') backup = JSON.parse(raw);
        else if (raw && typeof raw.length === 'number' && typeof raw[0] === 'number') { let str = ''; for (let i = 0; i < raw.length; i++) str += String.fromCharCode(raw[i]); backup = JSON.parse(str); }
        else if (Array.isArray(raw)) backup = raw;
      } catch (_) { backup = []; }
      if (Array.isArray(backup)) {
        const h = $security.sha256(code);
        for (let i = 0; i < backup.length; i++) {
          if (backup[i] && backup[i].used === false && typeof backup[i].h === 'string' && $security.equal(backup[i].h, h)) return true;
        }
      }
    }
    return false;
  }

  if (!reauth()) throw new BadRequestError('Bestätigung fehlgeschlagen. Code oder Passwort ist falsch.');

  e.app.delete(mfa); // Datensatz löschen = 2FA aus (Recovery-Endzustand).
  return e.json(200, { disabled: true });
}, $apis.requireAuth('users'));

// ---- POST /api/2fa/backup/regenerate — neue Backup-Codes ----------------
// Erfordert Re-Auth (Code/Passwort). Erzeugt 10 NEUE Codes, entwertet ALLE alten.
routerAdd('POST', '/api/2fa/backup/regenerate', (e) => {
  const auth = e.auth;
  if (!auth) throw new ForbiddenError('Anmeldung erforderlich.');

  const data = new DynamicModel({ code: '', password: '' });
  e.bindBody(data);
  const code = ('' + (data.code || '')).replace(/\s+/g, '');
  const password = '' + (data.password || '');
  if (!code && !password) throw new BadRequestError('Bitte zur Bestätigung den aktuellen Code oder das Passwort angeben.');

  let mfa;
  try { mfa = e.app.findFirstRecordByFilter('user_mfa', 'user = {:uid}', { uid: auth.id }); }
  catch (_) { throw new BadRequestError('2FA ist für dieses Konto nicht aktiv.'); }
  if (!mfa.getBool('enabled')) throw new BadRequestError('2FA ist für dieses Konto nicht aktiv.');

  // ── handler-lokale Re-Auth (identisch zu disable; muss lokal sein, s. o.) ──
  function reauth() {
    if (password && auth.validatePassword(password)) return true;
    if (!code) return false;
    function sha1Bytes(bytes){var ml=bytes.length*8;var msg=bytes.slice();msg.push(0x80);while(msg.length%64!==56)msg.push(0x00);var hi=Math.floor(ml/0x100000000),lo=ml>>>0;msg.push((hi>>>24)&0xff,(hi>>>16)&0xff,(hi>>>8)&0xff,hi&0xff);msg.push((lo>>>24)&0xff,(lo>>>16)&0xff,(lo>>>8)&0xff,lo&0xff);var h0=0x67452301,h1=0xEFCDAB89,h2=0x98BADCFE,h3=0x10325476,h4=0xC3D2E1F0;function rol(n,s){return((n<<s)|(n>>>(32-s)))>>>0;}for(var i=0;i<msg.length;i+=64){var w=new Array(80);for(var j=0;j<16;j++)w[j]=((msg[i+j*4]<<24)|(msg[i+j*4+1]<<16)|(msg[i+j*4+2]<<8)|(msg[i+j*4+3]))>>>0;for(var t=16;t<80;t++)w[t]=rol((w[t-3]^w[t-8]^w[t-14]^w[t-16])>>>0,1);var a=h0,b=h1,c=h2,d=h3,ee=h4;for(var k=0;k<80;k++){var f,kc;if(k<20){f=(b&c)|((~b)&d);kc=0x5A827999;}else if(k<40){f=b^c^d;kc=0x6ED9EBA1;}else if(k<60){f=(b&c)|(b&d)|(c&d);kc=0x8F1BBCDC;}else{f=b^c^d;kc=0xCA62C1D6;}var tmp=(rol(a,5)+(f>>>0)+ee+kc+w[k])>>>0;ee=d;d=c;c=rol(b,30);b=a;a=tmp;}h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;h4=(h4+ee)>>>0;}var out=[],hs=[h0,h1,h2,h3,h4];for(var x=0;x<5;x++)out.push((hs[x]>>>24)&0xff,(hs[x]>>>16)&0xff,(hs[x]>>>8)&0xff,hs[x]&0xff);return out;}
    function hmacSha1(key,msg){var bs=64;if(key.length>bs)key=sha1Bytes(key);var k=key.slice();while(k.length<bs)k.push(0x00);var ipad=[],opad=[];for(var i=0;i<bs;i++){ipad.push((k[i]^0x36)&0xff);opad.push((k[i]^0x5c)&0xff);}return sha1Bytes(opad.concat(sha1Bytes(ipad.concat(msg))));}
    function base32Decode(s){var A='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';s=(''+s).toUpperCase().replace(/=+$/,'').replace(/\s+/g,'');var bits=0,value=0,out=[];for(var i=0;i<s.length;i++){var idx=A.indexOf(s.charAt(i));if(idx===-1)return[];value=(value<<5)|idx;bits+=5;if(bits>=8){bits-=8;out.push((value>>>bits)&0xff);}}return out;}
    function hotp(keyBytes,counter,digits){var hi=Math.floor(counter/0x100000000),lo=counter>>>0;var cb=[(hi>>>24)&0xff,(hi>>>16)&0xff,(hi>>>8)&0xff,hi&0xff,(lo>>>24)&0xff,(lo>>>16)&0xff,(lo>>>8)&0xff,lo&0xff];var hmac=hmacSha1(keyBytes,cb);var off=hmac[19]&0x0f;var bin=((hmac[off]&0x7f)<<24)|((hmac[off+1]&0xff)<<16)|((hmac[off+2]&0xff)<<8)|(hmac[off+3]&0xff);var o=(bin%Math.pow(10,digits)).toString();while(o.length<digits)o='0'+o;return o;}
    function verifyTotp(secretB32,token){var key=base32Decode(secretB32);if(!key.length)return false;var counter=Math.floor((Date.now()/1000)/30);var ok=false;for(var w=-1;w<=1;w++){var cand=hotp(key,counter+w,6);if(cand.length===token.length){var diff=0;for(var i=0;i<cand.length;i++)diff|=(cand.charCodeAt(i)^token.charCodeAt(i));if(diff===0)ok=true;}}return ok;}
    const secret = mfa.getString('secret');
    if (/^[0-9]{6}$/.test(code) && secret && verifyTotp(secret, code)) return true;
    if (/^[0-9]{8}$/.test(code)) {
      let backup = [];
      try {
        let raw = mfa.get('backupCodes');
        if (typeof raw === 'string') backup = JSON.parse(raw);
        else if (raw && typeof raw.length === 'number' && typeof raw[0] === 'number') { let str = ''; for (let i = 0; i < raw.length; i++) str += String.fromCharCode(raw[i]); backup = JSON.parse(str); }
        else if (Array.isArray(raw)) backup = raw;
      } catch (_) { backup = []; }
      if (Array.isArray(backup)) {
        const h = $security.sha256(code);
        for (let i = 0; i < backup.length; i++) {
          if (backup[i] && backup[i].used === false && typeof backup[i].h === 'string' && $security.equal(backup[i].h, h)) return true;
        }
      }
    }
    return false;
  }

  if (!reauth()) throw new BadRequestError('Bestätigung fehlgeschlagen. Code oder Passwort ist falsch.');

  // 10 neue Codes (8-stellig), sha256-gehasht; ersetzt die alten vollständig. Klartext EINMALIG zurück.
  const plain = [], stored = [];
  for (let i = 0; i < 10; i++) {
    const bc = $security.randomStringWithAlphabet(8, '0123456789');
    plain.push(bc);
    stored.push({ h: $security.sha256(bc), used: false });
  }
  mfa.set('backupCodes', stored);
  e.app.save(mfa);
  return e.json(200, { backupCodes: plain });
}, $apis.requireAuth('users'));
