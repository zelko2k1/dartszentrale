/// <reference path="../pb_data/types.d.ts" />
// Härtung der Schreibrechte (Sicherheits-Audit #4 + #6):
//  #4 matches: Ersteller wird gestempelt (createdBy) und kann nur SICH SELBST eintragen;
//     nur Admin ODER der Ersteller darf ändern → keine fremden/forgierten Ergebnisse.
//  #6 seasons/leagues: anlegen+löschen nur Admin; teams: löschen nur Admin
//     (Kapitän kann keine fremden Saisons/Ligen/Mannschaften mehr anlegen/löschen).
migrate((app) => {
  const matches = app.findCollectionByNameOrId("matches");
  // 1) Feld zuerst anlegen + speichern, damit die Regel es danach auflösen kann.
  matches.fields.add(new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text1900000001",
    "max": 0,
    "min": 0,
    "name": "createdBy",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }));
  app.save(matches);
  // 2) Jetzt die Regeln setzen (referenzieren das existierende Feld createdBy).
  matches.createRule = '@request.auth.id != "" && @request.body.createdBy = @request.auth.id';
  matches.updateRule = '@request.auth.role = "admin" || createdBy = @request.auth.id';
  app.save(matches);

  const seasons = app.findCollectionByNameOrId("seasons");
  seasons.createRule = '@request.auth.role = "admin"';
  seasons.deleteRule = '@request.auth.role = "admin"';
  app.save(seasons);

  const leagues = app.findCollectionByNameOrId("leagues");
  leagues.createRule = '@request.auth.role = "admin"';
  leagues.deleteRule = '@request.auth.role = "admin"';
  app.save(leagues);

  const teams = app.findCollectionByNameOrId("teams");
  teams.deleteRule = '@request.auth.role = "admin"';
  app.save(teams);
}, (app) => {
  // down: vorherigen Stand wiederherstellen
  const matches = app.findCollectionByNameOrId("matches");
  matches.fields.removeById("text1900000001");
  matches.createRule = '@request.auth.role != "viewer"';
  matches.updateRule = '@request.auth.role = "admin"';
  app.save(matches);

  const captainOrAdmin = '@request.auth.role = "admin" || @request.auth.role = "captain"';
  const seasons = app.findCollectionByNameOrId("seasons");
  seasons.createRule = captainOrAdmin;
  seasons.deleteRule = captainOrAdmin;
  app.save(seasons);

  const leagues = app.findCollectionByNameOrId("leagues");
  leagues.createRule = captainOrAdmin;
  leagues.deleteRule = captainOrAdmin;
  app.save(leagues);

  const teams = app.findCollectionByNameOrId("teams");
  teams.deleteRule = captainOrAdmin;
  app.save(teams);
})
