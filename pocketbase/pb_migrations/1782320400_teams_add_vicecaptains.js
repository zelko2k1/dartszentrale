/// <reference path="../pb_data/types.d.ts" />
// Ergänzt die teams-Collection um viceCaptainIds (bis zu 2 Ersatzkapitäne, JSON-Array von Player.id).
// Ohne diese Spalte würde PocketBase das Feld beim Speichern still verwerfen.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1568971955");
  collection.fields.add(new Field({
    "hidden": false,
    "id": "json_vicecaptains",
    "maxSize": 2000000,
    "name": "viceCaptainIds",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }));
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1568971955");
  collection.fields.removeById("json_vicecaptains");
  return app.save(collection);
})
