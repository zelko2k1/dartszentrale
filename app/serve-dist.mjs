// ═══════ [ PRODUKTIV / OPS ] — Statischer Server für das gebaute Frontend (dist/) ═══════
// Ersetzt `vite preview` im Betrieb: schlank, ohne Dev-Server-/Build-Overhead, abhängigkeitsfrei
// (nur Node-Standardbibliothek), mit SPA-Fallback und PWA-tauglichen Cache-Headern.
//
// Aufruf:  node serve-dist.mjs                       → http://127.0.0.1:4173
//          HOST=0.0.0.0 PORT=4173 node serve-dist.mjs → im LAN von anderen Geräten erreichbar
//
// Voraussetzung: vorher `npm run build` (erzeugt app/dist/).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
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

const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('Method Not Allowed'); return;
    }
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
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

server.listen(PORT, HOST, () => {
  const shown = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;
  console.log(`▶ Frontend (statisch) → http://${shown}:${PORT}`);
  if (HOST === '0.0.0.0') console.log('  (im LAN über die Server-IP erreichbar, z. B. http://<server-ip>:' + PORT + ')');
});
