/// <reference path="../pb_data/types.d.ts" />
// ═══════ FOLGE-MIGRATION: users.manageRule (E-Mail-Änderung durch App-Admins) ═══════
// BUG: App-Admins (keine PB-Superuser) konnten die E-Mail eines Kontos nicht ändern
// → 400 "validation_values_mismatch / Values don't match". Grund: PocketBase erlaubt das
// direkte Setzen des email-Feldes an einer Auth-Collection nur mit „manage"-Zugriff; ohne
// manageRule muss die E-Mail unverändert bleiben (bzw. über den Bestätigungs-Flow laufen).
// Fix: manageRule = Admin-Rolle → App-Admins dürfen E-Mail/Passwort/verified direkt setzen
// (deckungsgleich mit der bestehenden updateRule). Spiegelbild in provision.mjs.
migrate((app) => {
  const c = app.findCollectionByNameOrId('users');
  c.manageRule = '@request.auth.role = "admin"';
  return app.save(c);
}, (app) => {
  // Rollback: manageRule wieder entfernen (nur Superuser dürfen dann E-Mails ändern).
  const c = app.findCollectionByNameOrId('users');
  c.manageRule = null;
  return app.save(c);
})
