// Spike-Test: beweist Korrektheit der embedded TOTP-Routine.
//  (1) RFC 6238 Appendix-B Testvektoren (SHA-1, 8-stellig)
//  (2) Kreuzvergleich gegen Node crypto (HMAC-SHA1) mit Zufalls-Secret, 6-stellig
//  (3) verify()-Fenster (±1 Schritt) + Ablehnung falscher Codes
const crypto = require('crypto');
const makeTotp = require('./totp.js');
const totp = makeTotp();

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = got === want;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${got} want=${want}`);
  ok ? pass++ : fail++;
}

// --- (1) RFC 6238 Appendix B: Secret ASCII "12345678901234567890" (20 Byte) ---
// Base32 davon:
const RFC_SECRET_ASCII = '12345678901234567890';
const rfcB32 = base32EncodeAscii(RFC_SECRET_ASCII);
console.log('RFC-Secret Base32 =', rfcB32);
const vectors = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  [20000000000, '65353130'],
];
for (const [t, want] of vectors) {
  check(`RFC6238 t=${t} (8-stellig)`, totp.generate(rfcB32, t, 30, 8), want);
}

// --- (2) Kreuzvergleich gegen Node crypto, Zufalls-Secret, 6-stellig ---
for (let n = 0; n < 200; n++) {
  const raw = crypto.randomBytes(20);
  const b32 = base32Encode(raw);
  const t = 1000000000 + n * 137;
  const mine = totp.generate(b32, t, 30, 6);
  const ref = nodeTotp(raw, t, 30, 6);
  if (mine !== ref) { check(`crossref n=${n} t=${t}`, mine, ref); }
}
check('crossref 200x gegen Node crypto', fail === 0 ? 'alle-gleich' : 'ABWEICHUNG', 'alle-gleich');

// --- (3) verify(): Fenster + Ablehnung ---
{
  const raw = crypto.randomBytes(20);
  const b32 = base32Encode(raw);
  const t = 1700000000;
  const codeNow = nodeTotp(raw, t, 30, 6);
  const codePrev = nodeTotp(raw, t - 30, 30, 6);
  const codeNext = nodeTotp(raw, t + 30, 30, 6);
  check('verify aktueller Code', totp.verify(b32, codeNow, t, 30, 6, 1), true);
  check('verify Code -1 Schritt (Drift)', totp.verify(b32, codePrev, t, 30, 6, 1), true);
  check('verify Code +1 Schritt (Drift)', totp.verify(b32, codeNext, t, 30, 6, 1), true);
  check('verify falscher Code -> abgelehnt', totp.verify(b32, '000000', t, 30, 6, 1), codeNow === '000000');
  check('verify Code -2 Schritte -> abgelehnt', totp.verify(b32, nodeTotp(raw, t - 60, 30, 6), t, 30, 6, 1),
        nodeTotp(raw, t - 60, 30, 6) === codeNow || nodeTotp(raw, t - 60, 30, 6) === codePrev || nodeTotp(raw, t - 60, 30, 6) === codeNext);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);

// ---------- Referenz-Helfer (nur für den Test, nicht für den Hook) ----------
function nodeTotp(rawKey, unixSeconds, step, digits) {
  const counter = Math.floor(unixSeconds / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', rawKey).update(buf).digest();
  const offset = hmac[19] & 0x0f;
  const bin = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) |
              ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return (bin % Math.pow(10, digits)).toString().padStart(digits, '0');
}
function base32Encode(buf) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0, out = '';
  for (const b of buf) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}
function base32EncodeAscii(str) {
  return base32Encode(Buffer.from(str, 'ascii'));
}
