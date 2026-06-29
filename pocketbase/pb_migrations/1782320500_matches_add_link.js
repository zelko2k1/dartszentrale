/// <reference path="../pb_data/types.d.ts" />
// Ergänzt die matches-Collection um die optionale Liga-Verknüpfung (leagueId, fixtureId, positionId).
// Damit kann ein am Board gespieltes 501 automatisch der richtigen Aufstellungsposition zugeordnet
// werden (Spielbericht-Vorbefüllung). Das Board-Konto (player) darf matches anlegen → kein Sicherheitsabbau.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("matches");
  for (const [id, name] of [["text_link_league", "leagueId"], ["text_link_fixture", "fixtureId"], ["text_link_position", "positionId"]]) {
    collection.fields.add(new Field({
      "autogeneratePattern": "", "hidden": false, "id": id, "max": 0, "min": 0,
      "name": name, "pattern": "", "presentable": false, "primaryKey": false,
      "required": false, "system": false, "type": "text",
    }));
  }
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("matches");
  collection.fields.removeById("text_link_league");
  collection.fields.removeById("text_link_fixture");
  collection.fields.removeById("text_link_position");
  return app.save(collection);
})
