/// <reference path="../pb_data/types.d.ts" />
// Ergänzt das Match-Format der Liga (Sicherheits-/Quality-Review Bug #9):
// singlesCount/doublesCount/format wurden bisher nur von provision.mjs gesetzt und fehlten
// im reinen Migrations-Pfad (Coolify). Die App liest sie (useStore) → hier als Migration nachgezogen.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2567937140")

  collection.fields.addAt(7, new Field({
    "help": "",
    "hidden": false,
    "id": "number2784153818",
    "max": null,
    "min": null,
    "name": "singlesCount",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  collection.fields.addAt(8, new Field({
    "help": "",
    "hidden": false,
    "id": "number2686329274",
    "max": null,
    "min": null,
    "name": "doublesCount",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  collection.fields.addAt(9, new Field({
    "help": "",
    "hidden": false,
    "id": "json3736761055",
    "maxSize": 2000000,
    "name": "format",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2567937140")

  collection.fields.removeById("number2784153818")
  collection.fields.removeById("number2686329274")
  collection.fields.removeById("json3736761055")

  return app.save(collection)
})
