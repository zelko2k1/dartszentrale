/// <reference path="../pb_data/types.d.ts" />
// ═══════ FOLGE-MIGRATION: leagues.order ═══════
// Ergänzt die `leagues`-Collection um ein Zahlenfeld `order` — die manuelle Sortierreihenfolge der
// Ligen (per Drag & Drop in der App gesetzt). Kleiner = weiter vorn; fehlt = ans Ende. Wird vereinsweit
// gespeichert, damit alle Geräte dieselbe Anordnung sehen. Siehe app/src/lib/useReorder.ts.
//
// Warum als Migration? Der Docker/Arcane-Weg nutzt kein provision.mjs — das Schema kommt allein aus
// pb_migrations/. Dieselbe Änderung ist in provision.mjs gespiegelt. Feld ist optional, unkritisch.
migrate((app) => {
  const c = app.findCollectionByNameOrId('leagues');
  c.fields.add(new Field({
    id: 'number_order',
    name: 'order',
    type: 'number',
    required: false,
    presentable: false,
    primaryKey: false,
    system: false,
    hidden: false,
    onlyInt: false,
    min: null,
    max: null,
  }));
  return app.save(c);
}, (app) => {
  // Rollback: Feld wieder entfernen.
  const c = app.findCollectionByNameOrId('leagues');
  c.fields.removeById('number_order');
  return app.save(c);
})
