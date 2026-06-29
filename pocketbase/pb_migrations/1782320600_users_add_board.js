/// <reference path="../pb_data/types.d.ts" />
// Ergänzt die users-Collection um Board-Rechner-Felder: isBoard (Maschinen-Konto) + boardNumber (feste Brett-Nummer).
// Board-Konten sind rechtearme Logins (Rolle player) und werden NIE mit einem Spielerprofil verknüpft.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_");
  collection.fields.add(new Field({
    "hidden": false, "id": "bool_isboard", "name": "isBoard",
    "presentable": false, "required": false, "system": false, "type": "bool",
  }));
  collection.fields.add(new Field({
    "hidden": false, "id": "number_boardnumber", "max": null, "min": null,
    "name": "boardNumber", "onlyInt": true, "presentable": false, "required": false, "system": false, "type": "number",
  }));
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_");
  collection.fields.removeById("bool_isboard");
  collection.fields.removeById("number_boardnumber");
  return app.save(collection);
})
