/// <reference path="../pb_data/types.d.ts" />
// ═══════ FOLGE-MIGRATION: live_sessions + live_commands (Remote & Live) ═══════
// Kanal für „Handy als Eingabe" + Live-Mitverfolgen (Plan docs/plan-remote.md).
//   live_sessions : der aktuelle View-State je Board — vom HOST geschrieben, von Remote/Zuschauern gelesen.
//   live_commands : Befehls-Postfach — vom gekoppelten Remote erzeugt, vom Host konsumiert (+ gelöscht).
// Ein-Schreiber-Garantie: nur der Host aktualisiert seine Session (updateRule = host); nur der aktuell
// gekoppelte Remote darf Befehle anlegen (zusätzlich serverseitig in pb_hooks/live_hooks.pb.js erzwungen).
// Die Kopplung (remoteUser/pendingRemote setzen) läuft NICHT über die REST-API, sondern über die Hooks
// (Superuser-Kontext), damit die strikte „nur Host"-Update-Regel bestehen bleibt.
// Spiegelbild in provision.mjs (Cloud/LAN-Weg). Docker/Arcane nutzt NUR diese Migration.
migrate((app) => {
  const idField = {
    "autogeneratePattern": "[a-z0-9]{15}", "help": "", "hidden": false, "id": "text3208210256",
    "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false,
    "primaryKey": true, "required": true, "system": true, "type": "text",
  };
  const textField = (id, name) => ({
    "autogeneratePattern": "", "help": "", "hidden": false, "id": id, "max": 0, "min": 0,
    "name": name, "pattern": "", "presentable": false, "primaryKey": false, "required": false,
    "system": false, "type": "text",
  });
  const relField = (id, name, collectionId, opt) => ({
    "cascadeDelete": (opt && opt.cascadeDelete) || false, "collectionId": collectionId, "help": "",
    "hidden": false, "id": id, "maxSelect": 1, "minSelect": 0, "name": name, "presentable": false,
    "required": (opt && opt.required) || false, "system": false, "type": "relation",
  });
  const numField = (id, name) => ({
    "help": "", "hidden": false, "id": id, "max": null, "min": null, "name": name, "onlyInt": true,
    "presentable": false, "required": false, "system": false, "type": "number",
  });
  const jsonField = (id, name) => ({
    "help": "", "hidden": false, "id": id, "maxSize": 2000000, "name": name, "presentable": false,
    "required": false, "system": false, "type": "json",
  });
  const autodate = (id, name, onUpdate) => ({
    "hidden": false, "id": id, "name": name, "onCreate": true, "onUpdate": !!onUpdate,
    "presentable": false, "system": false, "type": "autodate",
  });

  const snapshot = [
    {
      "id": "pbc_livesess001",
      "name": "live_sessions",
      "type": "base",
      "system": false,
      // Lesen: jedes angemeldete Mitglied (Zuschauer). Anlegen: nur für sich selbst als Host.
      // Ändern: nur der Host. Löschen: Host oder Admin (Aufräumen).
      "listRule": "@request.auth.id != \"\"",
      "viewRule": "@request.auth.id != \"\"",
      "createRule": "@request.auth.id != \"\" && @request.body.host = @request.auth.id",
      "updateRule": "@request.auth.id = host",
      "deleteRule": "@request.auth.id = host || @request.auth.role = \"admin\"",
      "fields": [
        idField,
        relField("rel_ls_host", "host", "_pb_users_auth_", { required: true, cascadeDelete: true }),
        textField("text_ls_board", "boardName"),
        textField("text_ls_code", "code"),
        relField("rel_ls_remote", "remoteUser", "_pb_users_auth_", {}),
        relField("rel_ls_pending", "pendingRemote", "_pb_users_auth_", {}),
        textField("text_ls_status", "status"),
        jsonField("json_ls_state", "state"),
        numField("num_ls_seq", "lastAppliedSeq"),
        textField("text_ls_heartbeat", "heartbeat"),
        autodate("autodate_ls_created", "created", false),
        autodate("autodate_ls_updated", "updated", true),
      ],
      "indexes": [],
    },
    {
      "id": "pbc_livecmd001",
      "name": "live_commands",
      "type": "base",
      "system": false,
      // Lesen/Löschen: nur der Host der zugehörigen Session. Anlegen: angemeldet + createdBy = man selbst
      //   (die Bindung an den aktuell gekoppelten Remote erzwingt zusätzlich pb_hooks/live_hooks.pb.js).
      // Ändern: niemand (Befehle sind unveränderlich).
      "listRule": "@request.auth.id = session.host",
      "viewRule": "@request.auth.id = session.host",
      "createRule": "@request.auth.id != \"\" && @request.body.createdBy = @request.auth.id",
      "updateRule": null,
      "deleteRule": "@request.auth.id = session.host",
      "fields": [
        idField,
        relField("rel_lc_session", "session", "pbc_livesess001", { required: true, cascadeDelete: true }),
        numField("num_lc_seq", "seq"),
        textField("text_lc_type", "type"),
        jsonField("json_lc_payload", "payload"),
        relField("rel_lc_by", "createdBy", "_pb_users_auth_", { required: true }),
        autodate("autodate_lc_created", "created", false),
      ],
      "indexes": [
        "CREATE INDEX `idx_live_commands_session` ON `live_commands` (`session`, `seq`)",
      ],
    },
  ];

  return app.importCollections(snapshot, false);
}, (app) => {
  // Rollback: erst die abhängige Befehls-Collection, dann die Session-Collection entfernen.
  app.delete(app.findCollectionByNameOrId("live_commands"));
  app.delete(app.findCollectionByNameOrId("live_sessions"));
})
