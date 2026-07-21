/// <reference path="../pb_data/types.d.ts" />
// Login-freier Zuschauer-TV (Plan docs/plan-remote.md, Phase 4) — serverseitige Logik:
//   • Admin verwaltet den Kanal (Kill-Switch watchEnabled + geheimen watchToken; rotierbar).
//   • Öffentlicher Endpunkt liefert NUR Boardname + Spielstand der aktiven Sessions — und NUR, wenn
//     watchEnabled=true UND der richtige Token vorliegt. Nichts Sensibles (code/host/remoteUser) verlässt
//     je den Server. Kill-Switch wirkt sofort auch auf bereits verteilte Links (Flag wird bei jedem Abruf
//     geprüft). watch_config ist abgeschottet (Rules null) → nur diese Hooks (Superuser-Kontext) lesen/schreiben.
// WICHTIG (PB-JSVM): Handler laufen isoliert → jede Hilfslogik ist inline (kein Modul-Scope-Zugriff).

// ── GET /api/live/watch/config (Admin) — Konfiguration lesen (legt Default an, falls fehlt) ──
routerAdd("GET", "/api/live/watch/config", (e) => {
  const auth = e.auth;
  if (!auth || auth.get("role") !== "admin") throw new ForbiddenError("Nur Admin.");
  let cfg;
  try { cfg = e.app.findFirstRecordByFilter("watch_config", "id != ''"); } catch { cfg = null; }
  if (!cfg) {
    cfg = new Record(e.app.findCollectionByNameOrId("watch_config"));
    cfg.set("watchEnabled", false);
    cfg.set("watchToken", $security.randomStringWithAlphabet(32, "abcdefghijklmnopqrstuvwxyz0123456789"));
    e.app.save(cfg);
  }
  return e.json(200, { enabled: cfg.getBool("watchEnabled"), token: cfg.getString("watchToken") });
}, $apis.requireAuth("users"));

// ── POST /api/live/watch/config (Admin) — { enabled?, rotate? } setzen ──
routerAdd("POST", "/api/live/watch/config", (e) => {
  const auth = e.auth;
  if (!auth || auth.get("role") !== "admin") throw new ForbiddenError("Nur Admin.");
  const body = e.requestInfo().body || {};
  let cfg;
  try { cfg = e.app.findFirstRecordByFilter("watch_config", "id != ''"); } catch { cfg = null; }
  if (!cfg) {
    cfg = new Record(e.app.findCollectionByNameOrId("watch_config"));
    cfg.set("watchToken", $security.randomStringWithAlphabet(32, "abcdefghijklmnopqrstuvwxyz0123456789"));
  }
  if ("enabled" in body) cfg.set("watchEnabled", !!body.enabled);
  if (body.rotate || !cfg.getString("watchToken")) cfg.set("watchToken", $security.randomStringWithAlphabet(32, "abcdefghijklmnopqrstuvwxyz0123456789"));
  e.app.save(cfg);
  return e.json(200, { enabled: cfg.getBool("watchEnabled"), token: cfg.getString("watchToken") });
}, $apis.requireAuth("users"));

// ── GET /api/live/public?token=… (öffentlich) — aktive Boards, nur bei aktivem Kanal + gültigem Token ──
routerAdd("GET", "/api/live/public", (e) => {
  const token = String((e.requestInfo().query || {}).token || "");
  let cfg;
  try { cfg = e.app.findFirstRecordByFilter("watch_config", "id != ''"); } catch { cfg = null; }
  if (!cfg || !cfg.getBool("watchEnabled")) throw new ForbiddenError("Öffentliches Zuschauen ist deaktiviert.");
  const real = cfg.getString("watchToken");
  if (!token || !real || token !== real) throw new ForbiddenError("Ungültiger Zuschauer-Link.");

  const sessions = e.app.findRecordsByFilter("live_sessions", "status = {:s}", "-updated", 50, 0, { s: "active" });
  const boards = [];
  for (const s of sessions) {
    let state = null;
    try { state = JSON.parse(s.getString("state") || "null"); } catch { state = null; }
    boards.push({ boardName: s.getString("boardName"), state: state });
  }
  return e.json(200, { boards: boards });
});
