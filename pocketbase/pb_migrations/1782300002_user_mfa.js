/// <reference path="../pb_data/types.d.ts" />
// ═══════ FOLGE-MIGRATION: user_mfa (2FA/TOTP, Phase B) ═══════
// ABGESCHOTTETE Collection für TOTP-2FA. ALLE API-Rules = null → NUR Superuser (und damit
// die pb_hooks, die mit App-/Superuser-Kontext laufen) dürfen lesen/schreiben. Das Secret
// verlässt somit NIE über die REST-API den Server (Plan docs/plan-2fa.md §3).
// 1:1 zu users via unique-Index auf `user`; cascadeDelete → Konto weg = 2FA-Datensatz weg.
// Spiegelbild in provision.mjs (Cloud/LAN-Weg). Docker/Coolify nutzt NUR diese Migration.
migrate((app) => {
  const snapshot = [
    {
      // Alle Rules null = ausschließlich Superuser/Hooks. Kein List/View/Create/Update/Delete für Nutzer.
      "createRule": null,
      "deleteRule": null,
      "listRule": null,
      "updateRule": null,
      "viewRule": null,
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
          "cascadeDelete": true,
          "collectionId": "_pb_users_auth_",
          "help": "",
          "hidden": false,
          "id": "relation_user_mfa",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "user",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": true,
          "id": "text_mfa_secret",
          "max": 0,
          "min": 0,
          "name": "secret",
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
          "id": "bool_mfa_enabled",
          "name": "enabled",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "help": "",
          "hidden": false,
          "id": "bool_mfa_pending",
          "name": "pending",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "help": "",
          "hidden": true,
          "id": "json_mfa_backupcodes",
          "maxSize": 2000000,
          "name": "backupCodes",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "json"
        },
        {
          "help": "",
          "hidden": false,
          "id": "number_mfa_failed",
          "max": null,
          "min": null,
          "name": "failedAttempts",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text_mfa_lockeduntil",
          "max": 0,
          "min": 0,
          "name": "lockedUntil",
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
          "id": "text_mfa_confirmedat",
          "max": 0,
          "min": 0,
          "name": "confirmedAt",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        }
      ],
      "id": "pbc_usermfa0001",
      "indexes": [
        "CREATE UNIQUE INDEX `idx_user_mfa_user` ON `user_mfa` (`user`)"
      ],
      "name": "user_mfa",
      "system": false,
      "type": "base"
    }
  ];

  return app.importCollections(snapshot, false);
}, (app) => {
  // Rollback: Collection wieder entfernen.
  const c = app.findCollectionByNameOrId("user_mfa");
  return app.delete(c);
})
