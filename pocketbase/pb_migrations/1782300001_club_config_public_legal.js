/// <reference path="../pb_data/types.d.ts" />
// ═══════ FOLGE-MIGRATION NACH DER BASELINE ═══════
// Macht `club_config` ÖFFENTLICH LESBAR und ergänzt die Rechtstext-Felder `impressum`
// (§ 5 DDG) und `datenschutz` (Art. 13 DSGVO). Nötig, damit die Login-Seite die Texte
// OHNE Anmeldung zeigen kann (öffentlicher Internet-Betrieb).
//
// Warum als Migration? Der Docker/Arcane-Weg nutzt KEIN provision.mjs — das Schema kommt
// ausschließlich aus pb_migrations/. Dieselbe Änderung ist in provision.mjs gespiegelt
// (schlanke Cloud + LAN). `club_config` enthält nur Anzeige-/Konfig-Werte, nichts
// Personenbezogenes; Schreiben bleibt admin-only. Siehe docs/security-audit.md.
migrate((app) => {
  const snapshot = [
    {
      "createRule": "@request.auth.role = \"admin\"",
      "deleteRule": "@request.auth.role = \"admin\"",
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "help": "",
          "hidden": false,
          "id": "text3208210256",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text270067931",
          "max": 0,
          "min": 0,
          "name": "clubName",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text2863992014",
          "max": 2000000,
          "min": 0,
          "name": "clubLogo",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text_impressum",
          "max": 50000,
          "min": 0,
          "name": "impressum",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text_datenschutz",
          "max": 50000,
          "min": 0,
          "name": "datenschutz",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "help": "",
          "hidden": false,
          "id": "json_clubsettings",
          "maxSize": 2000000,
          "name": "settings",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "json"
        }
      ],
      "id": "pbc_28618882",
      "indexes": [],
      "listRule": "",
      "name": "club_config",
      "system": false,
      "type": "base",
      "updateRule": "@request.auth.role = \"admin\"",
      "viewRule": ""
    }
  ];

  return app.importCollections(snapshot, false);
}, (app) => {
  // Rollback: Leseregeln zurück auf „nur angemeldet", Rechtstext-Felder wieder entfernen.
  const c = app.findCollectionByNameOrId("club_config");
  c.listRule = "@request.auth.id != \"\"";
  c.viewRule = "@request.auth.id != \"\"";
  c.fields.removeById("text_impressum");
  c.fields.removeById("text_datenschutz");
  return app.save(c);
})
