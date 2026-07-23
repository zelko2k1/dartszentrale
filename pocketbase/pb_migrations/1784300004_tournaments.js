/// <reference path="../pb_data/types.d.ts" />
// ═══════ FOLGE-MIGRATION: tournaments (Trainingsspiel „X01 – Jeder gegen Jeden") ═══════
// Ein Round-Robin-Turnier ist EIN Datensatz mit dem kompletten Zustand als JSON (Konfiguration,
// Teilnehmer, fertiger Spielplan + Ergebnisse je Partie). Jede Partie wird auf der Counter-Engine
// gespielt; das Ergebnis wird ins Turnier zurückgeschrieben. Über die Realtime-Subscription bleiben
// mehrere Board-Rechner synchron (Multi-Board-Parallelbetrieb).
//   Lesen/Anlegen: jedes angemeldete Mitglied (Anlegen an den Ersteller gebunden).
//   Ändern: jedes angemeldete Mitglied — Board-Konten müssen Partie-Ergebnisse schreiben können.
//   Löschen: nur der Ersteller oder ein Admin.
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
  const numField = (id, name) => ({
    "help": "", "hidden": false, "id": id, "max": null, "min": null, "name": name, "onlyInt": true,
    "presentable": false, "required": false, "system": false, "type": "number",
  });
  const jsonField = (id, name) => ({
    "help": "", "hidden": false, "id": id, "maxSize": 4000000, "name": name, "presentable": false,
    "required": false, "system": false, "type": "json",
  });
  const autodate = (id, name, onUpdate) => ({
    "hidden": false, "id": id, "name": name, "onCreate": true, "onUpdate": !!onUpdate,
    "presentable": false, "system": false, "type": "autodate",
  });

  const snapshot = [
    {
      "id": "pbc_tournament01",
      "name": "tournaments",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != \"\"",
      "viewRule": "@request.auth.id != \"\"",
      "createRule": "@request.auth.id != \"\" && @request.body.createdBy = @request.auth.id",
      "updateRule": "@request.auth.id != \"\"",
      "deleteRule": "@request.auth.id = createdBy || @request.auth.role = \"admin\"",
      "fields": [
        idField,
        textField("text_to_name", "name"),
        textField("text_to_createdat", "createdAt"),
        jsonField("json_to_config", "config"),
        numField("num_to_boards", "boardCount"),
        jsonField("json_to_parts", "participants"),
        jsonField("json_to_matches", "matches"),
        textField("text_to_status", "status"),
        textField("text_to_season", "seasonId"),
        textField("text_to_by", "createdBy"),
        autodate("autodate_to_created", "created", false),
        autodate("autodate_to_updated", "updated", true),
      ],
      "indexes": [],
    },
  ];

  return app.importCollections(snapshot, false);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("tournaments"));
})
