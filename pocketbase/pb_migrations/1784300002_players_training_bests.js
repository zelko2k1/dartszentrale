/// <reference path="../pb_data/types.d.ts" />
// ═══════ FOLGE-MIGRATION: players.trainingBests ═══════
// Ergänzt die `players`-Collection um ein json-Feld `trainingBests` — die persönlichen
// Trainings-Bestwerte je Spielmodus (Map modeId→{value,date}). Da der Wert am Spieler-Datensatz
// hängt, ist der Bestwert im Verein board-übergreifend derselbe (statt pro Board/Gerät).
//
// Warum als Migration? Der Docker/Arcane-Weg nutzt kein provision.mjs — das Schema kommt allein aus
// pb_migrations/. Dieselbe Änderung ist in provision.mjs gespiegelt. Feld ist optional, kein Default,
// unkritisch (nur persönliche Übungswerte).
migrate((app) => {
  const c = app.findCollectionByNameOrId('players');
  c.fields.add(new Field({
    id: 'json_trainingbests',
    name: 'trainingBests',
    type: 'json',
    maxSize: 2000000,
    required: false,
    presentable: false,
    system: false,
    hidden: false,
  }));
  return app.save(c);
}, (app) => {
  // Rollback: Feld wieder entfernen.
  const c = app.findCollectionByNameOrId('players');
  c.fields.removeById('json_trainingbests');
  return app.save(c);
})
