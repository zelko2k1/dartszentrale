// ---------------------------------------------------------------------------
// TOTP (RFC 6238 / RFC 4226) — SELF-CONTAINED Pure-JS-Routine für PocketBase pb_hooks.
//
// Warum embedded: Das PB-JSVM ($security) bietet HMAC-SHA256/512, sha256/512, md5 —
// ABER KEIN SHA-1 / HMAC-SHA1. TOTP braucht per Default HMAC-SHA1 (Authenticator-Apps
// ignorieren meist den Algorithmus-Parameter und nutzen immer SHA-1). Also: eigene,
// geprüfte SHA-1/HMAC-SHA1-Implementierung, nur ES5.1 (goja-kompatibel), keine Node-APIs,
// keine TypedArrays — reine Zahl-Arrays + 32-Bit-Bitops.
//
// Für den Hook: der Inhalt von makeTotp() wird 1:1 inline in den Handler kopiert
// (isolierte VM, kein Modul-Scope). Hier als Factory gekapselt, damit Node den Spike testen kann.
// ---------------------------------------------------------------------------

function makeTotp() {
  // --- SHA-1 über ein Byte-Array (Zahlen 0..255) -> 20 Byte-Array ---------
  function sha1Bytes(bytes) {
    var ml = bytes.length * 8;
    // padding: 0x80, dann 0x00 bis Länge ≡ 56 (mod 64), dann 64-bit big-endian Bitlänge
    var msg = bytes.slice();
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0x00);
    // 64-bit Länge (big-endian). ml < 2^53 -> obere 32 Bit via Division.
    var hi = Math.floor(ml / 0x100000000);
    var lo = ml >>> 0;
    msg.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
    msg.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);

    var h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;

    function rol(n, s) { return ((n << s) | (n >>> (32 - s))) >>> 0; }

    for (var i = 0; i < msg.length; i += 64) {
      var w = new Array(80);
      for (var j = 0; j < 16; j++) {
        w[j] = ((msg[i + j * 4] << 24) | (msg[i + j * 4 + 1] << 16) |
                (msg[i + j * 4 + 2] << 8) | (msg[i + j * 4 + 3])) >>> 0;
      }
      for (var t = 16; t < 80; t++) {
        w[t] = rol((w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16]) >>> 0, 1);
      }
      var a = h0, b = h1, c = h2, d = h3, e = h4;
      for (var k = 0; k < 80; k++) {
        var f, kc;
        if (k < 20)      { f = (b & c) | ((~b) & d);            kc = 0x5A827999; }
        else if (k < 40) { f = b ^ c ^ d;                       kc = 0x6ED9EBA1; }
        else if (k < 60) { f = (b & c) | (b & d) | (c & d);     kc = 0x8F1BBCDC; }
        else             { f = b ^ c ^ d;                       kc = 0xCA62C1D6; }
        var tmp = (rol(a, 5) + (f >>> 0) + e + kc + w[k]) >>> 0;
        e = d; d = c; c = rol(b, 30); b = a; a = tmp;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
    }
    var out = [];
    var hs = [h0, h1, h2, h3, h4];
    for (var x = 0; x < 5; x++) {
      out.push((hs[x] >>> 24) & 0xff, (hs[x] >>> 16) & 0xff, (hs[x] >>> 8) & 0xff, hs[x] & 0xff);
    }
    return out;
  }

  // --- HMAC-SHA1(key bytes, msg bytes) -> 20 Byte-Array --------------------
  function hmacSha1(key, msg) {
    var blockSize = 64;
    if (key.length > blockSize) key = sha1Bytes(key);
    var k = key.slice();
    while (k.length < blockSize) k.push(0x00);
    var ipad = [], opad = [];
    for (var i = 0; i < blockSize; i++) {
      ipad.push((k[i] ^ 0x36) & 0xff);
      opad.push((k[i] ^ 0x5c) & 0xff);
    }
    var inner = sha1Bytes(ipad.concat(msg));
    return sha1Bytes(opad.concat(inner));
  }

  // --- Base32-Decode (RFC 4648, ohne Padding, case-insensitiv) -> Byte-Array
  function base32Decode(s) {
    var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    s = ('' + s).toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    var bits = 0, value = 0, out = [];
    for (var i = 0; i < s.length; i++) {
      var idx = alphabet.indexOf(s.charAt(i));
      if (idx === -1) throw new Error('Ungültiges Base32-Zeichen: ' + s.charAt(i));
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        out.push((value >>> bits) & 0xff);
      }
    }
    return out;
  }

  // --- HOTP(secretBytes, counter) -> zero-padded String mit `digits` Stellen
  function hotp(keyBytes, counter, digits) {
    // 8-Byte big-endian Counter (64 Bit; hi via Division, da counter < 2^53)
    var hi = Math.floor(counter / 0x100000000);
    var lo = counter >>> 0;
    var cb = [
      (hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff,
      (lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff
    ];
    var hmac = hmacSha1(keyBytes, cb);
    var offset = hmac[19] & 0x0f;
    var bin = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) |
              ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
    var mod = Math.pow(10, digits);
    var code = (bin % mod).toString();
    while (code.length < digits) code = '0' + code;
    return code;
  }

  // --- öffentliche API ----------------------------------------------------
  return {
    base32Decode: base32Decode,
    hotp: hotp,
    // TOTP-Code für einen Zeitpunkt
    generate: function (secretB32, unixSeconds, step, digits) {
      step = step || 30; digits = digits || 6;
      var counter = Math.floor(unixSeconds / step);
      return hotp(base32Decode(secretB32), counter, digits);
    },
    // Verifikation mit ±window Schritten (Uhren-Drift). Konstante-Zeit-Vergleich.
    verify: function (secretB32, token, unixSeconds, step, digits, window) {
      step = step || 30; digits = digits || 6; window = (window == null) ? 1 : window;
      token = ('' + token).replace(/\s+/g, '');
      var key = base32Decode(secretB32);
      var counter = Math.floor(unixSeconds / step);
      var ok = false;
      for (var w = -window; w <= window; w++) {
        var cand = hotp(key, counter + w, digits);
        // konstante-Zeit-Vergleich (nicht abbrechen)
        if (cand.length === token.length) {
          var diff = 0;
          for (var i = 0; i < cand.length; i++) diff |= (cand.charCodeAt(i) ^ token.charCodeAt(i));
          if (diff === 0) ok = true;
        }
      }
      return ok;
    }
  };
}

// Export für den Node-Spike-Test; im Hook wird makeTotp()-Inhalt inline kopiert.
if (typeof module !== 'undefined' && module.exports) module.exports = makeTotp;
