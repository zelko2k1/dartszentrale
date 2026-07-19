/// <reference path="../pb_data/types.d.ts" />
// Remote & Live (Plan docs/plan-remote.md) — serverseitige Logik, die die reinen API-Rules nicht leisten:
//   • Kopplung: remoteUser/pendingRemote einer Session setzen, OBWOHL updateRule = "nur Host" gilt
//     (die Endpunkte laufen mit App-/Superuser-Kontext und dürfen daher schreiben).
//   • Ein-Schreiber-Garantie: beim Anlegen eines live_commands-Records wird erzwungen, dass der Absender
//     der aktuell gekoppelte Remote der Session ist (echte Grenze, unabhängig vom Client).
// WICHTIG (PocketBase-JSVM): Handler laufen in einer ISOLIERTEN VM und dürfen KEINE Funktionen/Variablen
// aus dem Modul-Scope referenzieren → jede Hilfslogik ist in jeden Handler vollständig inline geschrieben
// (siehe pb_hooks/board_role_guard.pb.js für dieselbe Einschränkung).

// ── Ein-Schreiber-Garantie: nur der gekoppelte Remote darf Befehle senden ──
onRecordCreateRequest((e) => {
  const auth = e.auth;
  if (!auth) throw new ForbiddenError("Anmeldung erforderlich.");
  const createdBy = e.record.get("createdBy");
  if (createdBy !== auth.id) throw new ForbiddenError("createdBy muss der eigene Nutzer sein.");
  const sessionId = e.record.get("session");
  if (!sessionId) throw new BadRequestError("session fehlt.");
  const sess = e.app.findRecordById("live_sessions", sessionId);
  if (sess.get("status") === "ended") throw new BadRequestError("Diese Session ist beendet.");
  if (sess.get("remoteUser") !== auth.id) {
    throw new ForbiddenError("Nur der gekoppelte Anschreiber darf Befehle senden.");
  }
  e.next();
}, "live_commands");

// ── POST /api/live/claim { sessionId, code } → koppeln oder Übernahme anfragen ──
routerAdd("POST", "/api/live/claim", (e) => {
  const auth = e.auth;
  if (!auth) throw new ForbiddenError("Anmeldung erforderlich.");
  const data = new DynamicModel({ sessionId: "", code: "" });
  e.bindBody(data);
  if (!data.sessionId) throw new BadRequestError("sessionId fehlt.");
  const sess = e.app.findRecordById("live_sessions", data.sessionId);
  if (sess.get("status") === "ended") throw new BadRequestError("Diese Session ist beendet.");
  const code = String(sess.get("code") || "");
  if (!code || code !== String(data.code || "")) {
    throw new BadRequestError("Falscher oder abgelaufener Kopplungscode.");
  }
  const current = sess.get("remoteUser");
  if (!current || current === auth.id) {
    // Frei (oder man selbst) → sofort koppeln.
    sess.set("remoteUser", auth.id);
    sess.set("pendingRemote", "");
    e.app.save(sess);
    return e.json(200, { ok: true, claimed: true, pending: false });
  }
  // Belegt durch ein anderes Handy → Übernahme muss der aktuelle Anschreiber bestätigen.
  sess.set("pendingRemote", auth.id);
  e.app.save(sess);
  return e.json(200, { ok: true, claimed: false, pending: true });
}, $apis.requireAuth("users"));

// ── POST /api/live/claim/approve { sessionId } → aktueller Remote bestätigt die Übernahme ──
routerAdd("POST", "/api/live/claim/approve", (e) => {
  const auth = e.auth;
  if (!auth) throw new ForbiddenError("Anmeldung erforderlich.");
  const data = new DynamicModel({ sessionId: "" });
  e.bindBody(data);
  if (!data.sessionId) throw new BadRequestError("sessionId fehlt.");
  const sess = e.app.findRecordById("live_sessions", data.sessionId);
  if (sess.get("remoteUser") !== auth.id) {
    throw new ForbiddenError("Nur der aktuelle Anschreiber darf eine Übernahme bestätigen.");
  }
  const pending = sess.get("pendingRemote");
  if (!pending) return e.json(200, { ok: true, changed: false });
  sess.set("remoteUser", pending);
  sess.set("pendingRemote", "");
  e.app.save(sess);
  return e.json(200, { ok: true, changed: true });
}, $apis.requireAuth("users"));

// ── POST /api/live/claim/deny { sessionId } → aktueller Remote lehnt die Übernahme ab ──
routerAdd("POST", "/api/live/claim/deny", (e) => {
  const auth = e.auth;
  if (!auth) throw new ForbiddenError("Anmeldung erforderlich.");
  const data = new DynamicModel({ sessionId: "" });
  e.bindBody(data);
  if (!data.sessionId) throw new BadRequestError("sessionId fehlt.");
  const sess = e.app.findRecordById("live_sessions", data.sessionId);
  if (sess.get("remoteUser") !== auth.id) {
    throw new ForbiddenError("Nur der aktuelle Anschreiber darf eine Übernahme ablehnen.");
  }
  sess.set("pendingRemote", "");
  e.app.save(sess);
  return e.json(200, { ok: true });
}, $apis.requireAuth("users"));

// ── POST /api/live/release { sessionId } → eigenen Schreiber-/Anfrage-Platz freigeben ──
routerAdd("POST", "/api/live/release", (e) => {
  const auth = e.auth;
  if (!auth) throw new ForbiddenError("Anmeldung erforderlich.");
  const data = new DynamicModel({ sessionId: "" });
  e.bindBody(data);
  if (!data.sessionId) throw new BadRequestError("sessionId fehlt.");
  const sess = e.app.findRecordById("live_sessions", data.sessionId);
  let changed = false;
  if (sess.get("remoteUser") === auth.id) { sess.set("remoteUser", ""); changed = true; }
  if (sess.get("pendingRemote") === auth.id) { sess.set("pendingRemote", ""); changed = true; }
  if (changed) e.app.save(sess);
  return e.json(200, { ok: true });
}, $apis.requireAuth("users"));

// ── Aufräumen (alle 2 Min): beendete Sessions entfernen + abgestürzte Hosts (Lebenszeichen älter als
//    ~2 Min) aussortieren. Die zugehörigen live_commands verschwinden per cascadeDelete mit. Verhindert,
//    dass ein „eingefrorenes" Spiel eines abgestürzten Boards ewig im Zuschauer-TV hängen bleibt. ──
cronAdd("live_cleanup", "*/2 * * * *", () => {
  const cutoff = new Date(Date.now() - 120000).toISOString(); // 2 Minuten
  let stale = [];
  try { stale = $app.findRecordsByFilter("live_sessions", "status = 'ended' || (status = 'active' && heartbeat < {:c})", "", 500, 0, { c: cutoff }); } catch (_) { stale = []; }
  for (const r of stale) {
    try { $app.delete(r); } catch (_) { /* nächster Datensatz */ }
  }
});
