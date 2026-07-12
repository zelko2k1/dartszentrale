/// <reference path="../pb_data/types.d.ts" />
// ═══════ FOLGE-MIGRATION: leagues.nuligaUrl ═══════
// Ergänzt die `leagues`-Collection um ein Textfeld `nuligaUrl` — die nuLiga-Gruppen-URL
// (Meetings-/Gruppenseite), die eine App-Liga mit ihrer nuLiga-Gruppe verknüpft. Ist die URL
// gesetzt, bietet die App an der Liga „Aus nuLiga aktualisieren" an (server-seitiger Abruf über
// pb_hooks/nuliga.pb.js, Merge im Frontend). Siehe docs/plan-nuliga-import.md (Revision 2026-07-12).
//
// Warum als Migration? Der Docker/Arcane-Weg nutzt kein provision.mjs — das Schema kommt allein aus
// pb_migrations/. Dieselbe Änderung ist in provision.mjs gespiegelt. Feld ist optional, kein Default,
// unkritisch (nur eine öffentliche URL).
migrate((app) => {
  const c = app.findCollectionByNameOrId('leagues');
  c.fields.add(new Field({
    id: 'text_nuligaurl',
    name: 'nuligaUrl',
    type: 'text',
    max: 500,
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
  // Rollback: Feld wieder entfernen.
  const c = app.findCollectionByNameOrId('leagues');
  c.fields.removeById('text_nuligaurl');
  return app.save(c);
})
