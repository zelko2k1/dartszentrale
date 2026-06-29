/// <reference path="../pb_data/types.d.ts" />
// Sicherheits-Audit #6 (Rest): Roster-Editing fremder Mannschaften unterbinden.
//   Bisher durfte JEDER Kapitän JEDE Mannschaft ändern (updateRule = admin|captain).
//   Neu: ändern darf Admin ODER der Kapitän GENAU SEINER Mannschaft
//        (teams.captainId == eigene users.playerId).
//   captainId (teams) und playerId (users) sind json-Skalare (eine Spieler-ID|null)
//   → direkter Gleichheitsvergleich der json-Werte.
migrate((app) => {
  const teams = app.findCollectionByNameOrId("teams");
  teams.updateRule = '@request.auth.role = "admin" || (@request.auth.role = "captain" && captainId = @request.auth.playerId)';
  app.save(teams);
}, (app) => {
  // down: vorheriger Stand – jeder Kapitän durfte jede Mannschaft ändern.
  const teams = app.findCollectionByNameOrId("teams");
  teams.updateRule = '@request.auth.role = "admin" || @request.auth.role = "captain"';
  app.save(teams);
})
