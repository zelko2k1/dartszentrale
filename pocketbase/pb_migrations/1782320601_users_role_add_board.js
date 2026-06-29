/// <reference path="../pb_data/types.d.ts" />
// Ergänzt den Rollenwert 'board' im role-Select der users-Collection.
// Hintergrund: 1782320600 hat zwar isBoard/boardNumber hinzugefügt, der Wert 'board' fehlte
// aber im role-Feld. Damit schlug das Anlegen von Board-Rechner-Konten (role='board', vom
// pb_hooks/board_role_guard erzwungen) serverseitig mit "validation_invalid_value" fehl.
// Kanonische Liste identisch zu provision.mjs ROLE_VALUES.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_");
  const field = collection.fields.getByName("role");
  if (!field) return; // frische Provisionierung kennt 'board' bereits → nichts zu tun
  field.values = ["admin", "captain", "player", "viewer", "board"];
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_");
  const field = collection.fields.getByName("role");
  if (!field) return;
  field.values = ["admin", "captain", "player", "viewer"];
  app.save(collection);
})
