/// <reference path="../pb_data/types.d.ts" />
// Ergänzt die leagues-Collection um das Spielformat: format (geordnete Blöcke, JSON) sowie die
// einfachen Zähler singlesCount/doublesCount. Ohne diese Spalten verwirft PocketBase die Felder
// beim Speichern still → die pro-Liga-Formatwahl ginge verloren.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2567937140");
  collection.fields.add(new Field({
    "hidden": false,
    "id": "json_leagueformat",
    "maxSize": 100000,
    "name": "format",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }));
  collection.fields.add(new Field({
    "hidden": false,
    "id": "number_singlescount",
    "max": null,
    "min": null,
    "name": "singlesCount",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }));
  collection.fields.add(new Field({
    "hidden": false,
    "id": "number_doublescount",
    "max": null,
    "min": null,
    "name": "doublesCount",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }));
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2567937140");
  collection.fields.removeById("json_leagueformat");
  collection.fields.removeById("number_singlescount");
  collection.fields.removeById("number_doublescount");
  return app.save(collection);
})
