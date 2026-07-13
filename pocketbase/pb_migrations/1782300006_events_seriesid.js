/// <reference path="../pb_data/types.d.ts" />
// ═══════ FOLGE-MIGRATION: events.seriesId ═══════
// Ergänzt die `events`-Collection um ein Textfeld `seriesId` — verknüpft Serientermine (gleiche
// Wiederholung), damit „ganze Serie löschen" auch nach einem Reload funktioniert. Ohne das Feld würde
// PocketBase die seriesId beim Speichern verwerfen (wie zuvor bei fixtureId). In provision.mjs gespiegelt.
migrate((app) => {
  const c = app.findCollectionByNameOrId('events');
  c.fields.add(new Field({
    id: 'text_seriesid',
    name: 'seriesId',
    type: 'text',
    max: 0,
    min: 0,
    pattern: '',
    autogeneratePattern: '',
    required: false,
    presentable: false,
    primaryKey: false,
    system: false,
    hidden: false,
    help: '',
  }));
  return app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId('events');
  c.fields.removeById('text_seriesid');
  return app.save(c);
})
