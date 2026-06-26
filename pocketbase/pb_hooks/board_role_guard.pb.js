/// <reference path="../pb_data/types.d.ts" />
// Serverseitige Invariante für Board-Rechner-Konten (die ECHTE Grenze, unabhängig vom Client):
//   isBoard === true  ⇔  role === "board"  und  playerId === null
// Greift bei jeder API-Anfrage – auch bei direkten Roh-API-Zugriffen oder einem Admin-Edit
// im PocketBase-Adminpanel. Damit kann ein Board-Konto NIE eine andere Rolle erhalten und
// die Rolle "board" NIE an ein normales Konto vergeben werden.
//
// WICHTIG (PocketBase-JSVM): Hook-Handler laufen in einer ISOLIERTEN VM und dürfen KEINE
// Funktionen/Variablen aus dem Modul-Scope referenzieren (sonst ReferenceError zur Laufzeit
// → jeder users-Write schlägt mit generischem 400 fehl). Die Logik muss daher in jeden
// Handler vollständig inline geschrieben werden.
onRecordCreateRequest((e) => {
  const isBoard = e.record.getBool("isBoard");
  const role = e.record.get("role");
  if (isBoard) {
    if (role !== "board") {
      throw new BadRequestError("Board-Rechner-Konten müssen die Rolle 'board' behalten.");
    }
    e.record.set("playerId", null); // Board-Konten werden nie mit einem Spieler verknüpft.
  } else if (role === "board") {
    throw new BadRequestError("Die Rolle 'board' ist ausschliesslich Board-Rechner-Konten (isBoard) vorbehalten.");
  }
  e.next();
}, "users");

onRecordUpdateRequest((e) => {
  const isBoard = e.record.getBool("isBoard");
  const role = e.record.get("role");
  if (isBoard) {
    if (role !== "board") {
      throw new BadRequestError("Board-Rechner-Konten müssen die Rolle 'board' behalten.");
    }
    e.record.set("playerId", null); // Board-Konten werden nie mit einem Spieler verknüpft.
  } else if (role === "board") {
    throw new BadRequestError("Die Rolle 'board' ist ausschliesslich Board-Rechner-Konten (isBoard) vorbehalten.");
  }
  e.next();
}, "users");
