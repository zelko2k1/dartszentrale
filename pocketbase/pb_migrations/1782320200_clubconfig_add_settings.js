/// <reference path="../pb_data/types.d.ts" />
// Fügt der club_config ein JSON-Feld "settings" hinzu: die vereinsweit zentral gepflegten
// Oberflächen-/Counter-Einstellungen. Nur Admins dürfen club_config schreiben (bestehende API-Rule),
// alle angemeldeten Nutzer dürfen lesen → einheitliche Oberfläche auf allen Board-Rechnern.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_28618882");
  collection.fields.addAt(3, new Field({
    "hidden": false,
    "id": "json_clubsettings",
    "maxSize": 2000000,
    "name": "settings",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }));
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_28618882");
  collection.fields.removeById("json_clubsettings");
  return app.save(collection);
})
