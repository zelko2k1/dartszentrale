// ═══════ [ PRODUKTIV / OPS ] — Statischer Server für das gebaute Frontend (dist/) ═══════
// Ersetzt `vite preview` im Betrieb: schlank, ohne Dev-Server-/Build-Overhead, abhängigkeitsfrei
// (nur Node-Standardbibliothek), mit SPA-Fallback und PWA-tauglichen Cache-Headern.
//
// Aufruf:  node serve-dist.mjs                       → http://127.0.0.1:4173
//          HOST=0.0.0.0 PORT=4173 node serve-dist.mjs → im LAN von anderen Geräten erreichbar
//
// Voraussetzung: vorher `npm run build` (erzeugt app/dist/).
import { createServer } from 'node:http';
import { readFile, stat, mkdir, rm, rename, readdir } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const APP_DIR = fileURLToPath(new URL('.', import.meta.url));   // …/app/
const ROOT = join(APP_DIR, 'dist');                            // ausgeliefertes Frontend
const INSTALL_ROOT = join(APP_DIR, '..');                      // Projektordner (enthält app/, Skripte …)
const UPDATES_DIR = join(INSTALL_ROOT, 'updates');             // hier legt der Admin das Update-Paket ab
const TOKEN_FILE = join(INSTALL_ROOT, '.update-token');        // Freigabe-Token für Nicht-localhost (Vereinsmodus)
// tar kann .tar.gz überall (GNU-tar auf Linux, bsdtar auf macOS/Windows). Auf Windows gezielt das
// System-tar (bsdtar) ansprechen – nicht ein evtl. im PATH liegendes MSYS/GNU-tar, das Laufwerks-
// pfade wie „D:\…" als Remote-Host fehldeutet.
const TAR = process.platform === 'win32' ? join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

async function fileInfo(path) {
  try { const s = await stat(path); if (s.isFile()) return s; } catch { /* fehlt */ }
  return null;
}

// ── Datei-basiertes Update (lokal / LAN / Cloud – überall wo serve-dist.mjs ausliefert) ──────────
// Der Admin legt ein Paket (ZIP mit dem fertigen dist-Inhalt inkl. version.json) in updates/ ab,
// klickt in den Einstellungen „Installieren" → der Server entpackt & tauscht dist/ atomar aus.
// Kein Build, kein Neustart: der nächste Request liefert die neue Version, die App lädt neu.
function execFileP(cmd, args) {
  return new Promise((resolve, reject) => execFile(cmd, args, { windowsHide: true }, (err, stdout) => err ? reject(err) : resolve(stdout)));
}
function isLocalReq(req) {
  const a = req.socket.remoteAddress || '';
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
}
async function updateAllowed(req) {
  if (isLocalReq(req)) return true;                       // am Board selbst → immer erlaubt
  let token = null;
  try { token = (await readFile(TOKEN_FILE, 'utf8')).trim(); } catch { /* keine Datei → gesperrt */ }
  return !!token && (req.headers['x-update-token'] || '') === token;
}
function parseVersion(text) { return JSON.parse(String(text).replace(/^﻿/, '')).version || null; }
async function currentVersion() {
  try { return parseVersion(await readFile(join(ROOT, 'version.json'), 'utf8')); } catch { return null; }
}
async function findPackage() {                            // neuestes .tar.gz/.tgz in updates/
  let files;
  try { files = (await readdir(UPDATES_DIR)).filter((f) => /\.(tar\.gz|tgz)$/i.test(f)); } catch { return null; }
  if (!files.length) return null;
  const withM = await Promise.all(files.map(async (f) => ({ f, m: (await stat(join(UPDATES_DIR, f))).mtimeMs })));
  withM.sort((a, b) => b.m - a.m);
  return withM[0].f;
}
async function packageVersion(file) {                     // version.json aus dem ZIP lesen (ohne komplett zu entpacken)
  try { return parseVersion(await execFileP(TAR, ['-xOf', join(UPDATES_DIR, file), 'version.json'])); } catch { return null; }
}
async function installPackage(file) {
  const zip = join(UPDATES_DIR, file);
  const tmp = join(INSTALL_ROOT, '.update-tmp');
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  await execFileP(TAR, ['-xf', zip, '-C', tmp]);          // tar entpackt .tar.gz (auto-erkannt) überall
  if (!(await fileInfo(join(tmp, 'index.html')))) { await rm(tmp, { recursive: true, force: true }); throw new Error('Paket enthält kein index.html'); }
  const old = ROOT + '.old';
  await rm(old, { recursive: true, force: true });
  await rename(ROOT, old);                                // altes dist beiseite
  try { await rename(tmp, ROOT); }                        // neues dist einschwenken
  catch (e) { await rename(old, ROOT).catch(() => {}); throw e; }
  await rm(old, { recursive: true, force: true }).catch(() => {});
}
function sendJson(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

    // ── Update-API (nur diese beiden Routen; alles andere = statische Auslieferung) ──
    if (urlPath === '/admin/update/status' || urlPath === '/admin/update/install') {
      if (!(await updateAllowed(req))) { sendJson(res, 403, { error: 'nicht erlaubt – nur am Board (127.0.0.1) oder mit gültigem Update-Token' }); return; }
      if (urlPath === '/admin/update/status' && req.method === 'GET') {
        const current = await currentVersion();
        const file = await findPackage();
        const available = file ? await packageVersion(file) : null;
        sendJson(res, 200, { current, available, file, updatesDir: UPDATES_DIR, hasUpdate: !!available && available !== current });
        return;
      }
      if (urlPath === '/admin/update/install' && req.method === 'POST') {
        const file = await findPackage();
        if (!file) { sendJson(res, 404, { ok: false, error: 'Kein Update-Paket in updates/ gefunden' }); return; }
        try { await installPackage(file); sendJson(res, 200, { ok: true, version: await currentVersion() }); }
        catch (e) { sendJson(res, 500, { ok: false, error: String((e && e.message) || e) }); }
        return;
      }
      sendJson(res, 405, { error: 'Method Not Allowed' }); return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('Method Not Allowed'); return;
    }
    let rel = normalize(urlPath).replace(/^([/\\])+/, '').replace(/^(\.\.[/\\])+/, '');
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    let file = join(ROOT, rel);
    // Kein Ausbruch aus dem dist-Ordner.
    if (file !== ROOT && !file.startsWith(ROOT + (process.platform === 'win32' ? '\\' : '/'))) {
      res.writeHead(403); res.end('Forbidden'); return;
    }

    let st = await fileInfo(file);
    // SPA-Fallback: unbekannte Route OHNE Dateiendung → index.html (Client-Routing).
    if (!st && !extname(rel)) { file = join(ROOT, 'index.html'); st = await fileInfo(file); }
    if (!st) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404 Not Found'); return; }

    const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
    // Nur die gehashten Vite-Assets dauerhaft cachen. index.html, sw.js, manifest etc.
    // revalidieren, damit Updates nach einem Reload sofort greifen (wichtig an den Brettern).
    const isHashedAsset = rel.replace(/\\/g, '/').startsWith('assets/');
    const cache = isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache';
    const headers = { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': cache };

    if (req.method === 'HEAD') { res.writeHead(200, headers); res.end(); return; }
    res.writeHead(200, headers); res.end(await readFile(file));
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('500 Internal Server Error');
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`✗ Port ${PORT} ist belegt — läuft die App schon in einem anderen Fenster?`);
  else console.error('✗ Server-Fehler:', e.message);
  process.exit(1);
});

// dist vorhanden?
if (!(await fileInfo(join(ROOT, 'index.html')))) {
  console.error(`✗ ${ROOT} fehlt oder hat kein index.html — bitte zuerst 'npm run build' ausführen.`);
  process.exit(1);
}

// updates/-Ordner sicherstellen (der Admin legt hier das Update-Paket ab; Pfad zeigt auch die App an).
await mkdir(UPDATES_DIR, { recursive: true }).catch(() => {});

server.listen(PORT, HOST, () => {
  const shown = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;
  console.log(`▶ Frontend (statisch) → http://${shown}:${PORT}`);
  if (HOST === '0.0.0.0') console.log('  (im LAN über die Server-IP erreichbar, z. B. http://<server-ip>:' + PORT + ')');
  console.log(`  Update-Ablage: ${UPDATES_DIR}`);
});
