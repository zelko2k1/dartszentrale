/// <reference path="../pb_data/types.d.ts" />
// ═══════ FOLGE-MIGRATION: players.updateRule — Trainings-Bestwerte dürfen alle speichern ═══════
// Problem: Die App verbucht persönliche Trainings-Bestwerte am Spieler-Datensatz
// (recordTrainingResult → PATCH players/<id> {trainingBests}). Schreiben auf `players` war aber
// Admin/Kapitän vorbehalten — am BOARD-Rechner (role=board) und für normale Mitglieder schlug das
// fehl ("Änderung konnte nicht gespeichert werden"), also genau dort, wo trainiert wird.
//
// Lösung: Jedes angemeldete Konto darf `players` aktualisieren, aber NUR wenn im Änderungswunsch
// ausschließlich `trainingBests` steht. Sobald name/short/avi/locked/photo mitgeschickt werden,
// greift wieder die alte Beschränkung auf Admin/Kapitän. Die Stammdaten bleiben also geschützt.
//
// Abwägung (bewusst): Angemeldete Mitglieder können damit auch fremde Trainings-Bestwerte
// überschreiben. Im Vereinsnetz vertretbar — wer anschreiben darf, trägt ohnehin Ergebnisse ein;
// es sind Übungswerte, keine Ligaergebnisse. Stammdaten/Fotos bleiben unberührt.
//
// Warum als Migration? Der Docker/Arcane-Weg nutzt kein provision.mjs — das Schema kommt allein aus
// pb_migrations/. Dieselbe Regel ist in provision.mjs gespiegelt.
const ADMIN_OR_CAPTAIN = '@request.auth.role = "admin" || @request.auth.role = "captain"';
// Nur-trainingBests-Änderung: angemeldet, trainingBests dabei, kein anderes Feld im Body.
const TRAINING_BESTS_ONLY = [
  '@request.auth.id != ""',
  '@request.body.trainingBests:isset = true',
  '@request.body.name:isset = false',
  '@request.body.short:isset = false',
  '@request.body.avi:isset = false',
  '@request.body.locked:isset = false',
  '@request.body.photo:isset = false',
].join(' && ');

migrate((app) => {
  const c = app.findCollectionByNameOrId('players');
  c.updateRule = `${ADMIN_OR_CAPTAIN} || (${TRAINING_BESTS_ONLY})`;
  return app.save(c);
}, (app) => {
  // Rollback: zurück auf „nur Admin/Kapitän".
  const c = app.findCollectionByNameOrId('players');
  c.updateRule = ADMIN_OR_CAPTAIN;
  return app.save(c);
})
