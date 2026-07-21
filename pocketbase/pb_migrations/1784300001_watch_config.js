/// <reference path="../pb_data/types.d.ts" />
// ═══════ FOLGE-MIGRATION: watch_config (login-freier Zuschauer-TV) ═══════
// Steuert den öffentlichen Zuschauer-Kanal (Plan docs/plan-remote.md, Phase 4):
//   watchEnabled = Kill-Switch (Default AUS → im Internet standardmäßig zu),
//   watchToken   = geheimer, rotierbarer Link-Token (in der Watch-URL #/watch/<token>).
// ABGESCHOTTET: alle Rules null → NUR Superuser/pb_hooks. Der Token liegt bewusst NICHT in der
// öffentlich lesbaren club_config. Zugriff nur über pb_hooks/watch_hooks.pb.js (Admin verwaltet,
// öffentlicher Endpunkt validiert Token + Flag und liefert nur Boardname + Spielstand).
// Spiegelbild in provision.mjs. Docker/Arcane nutzt NUR diese Migration.
migrate((app) => {
  const snapshot = [
    {
      "id": "pbc_watchcfg01",
      "name": "watch_config",
      "type": "base",
      "system": false,
      "createRule": null, "deleteRule": null, "listRule": null, "updateRule": null, "viewRule": null,
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}", "help": "", "hidden": false, "id": "text3208210256",
          "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false,
          "primaryKey": true, "required": true, "system": true, "type": "text",
        },
        {
          "help": "", "hidden": false, "id": "bool_watch_enabled", "name": "watchEnabled",
          "presentable": false, "required": false, "system": false, "type": "bool",
        },
        {
          "autogeneratePattern": "", "help": "", "hidden": false, "id": "text_watch_token",
          "max": 0, "min": 0, "name": "watchToken", "pattern": "", "presentable": false,
          "primaryKey": false, "required": false, "system": false, "type": "text",
        },
      ],
      "indexes": [],
    },
  ];
  return app.importCollections(snapshot, false);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("watch_config"));
})
