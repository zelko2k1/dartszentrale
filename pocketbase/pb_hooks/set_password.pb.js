/// <reference path="../pb_data/types.d.ts" />
// Passwort setzen mit Rechten, die die normale Records-API NICHT erlaubt:
//   - Admin (role="admin") darf das Passwort JEDES Nutzers zurücksetzen.
//   - Jeder Nutzer darf SEIN EIGENES Passwort ändern (auth.id === userId).
// Läuft server-seitig mit App-Rechten → umgeht die PocketBase-Pflicht zu oldPassword/Superuser.
// WICHTIG (PB-JSVM): Handler muss SELF-CONTAINED sein (isolierte VM, kein Modul-Scope-Zugriff).
routerAdd('POST', '/api/set-password', (e) => {
  const auth = e.auth;
  if (!auth) throw new ForbiddenError('Anmeldung erforderlich.');

  const data = new DynamicModel({ userId: '', password: '' });
  e.bindBody(data);
  const userId = data.userId;
  const newPw = data.password;
  if (!userId) throw new BadRequestError('userId fehlt.');
  if (!newPw || newPw.length < 8) throw new BadRequestError('Das Passwort muss mindestens 8 Zeichen haben.');

  const isAdmin = auth.get('role') === 'admin';
  const isSelf = auth.id === userId;
  if (!isAdmin && !isSelf) throw new ForbiddenError('Keine Berechtigung, dieses Passwort zu ändern.');

  const user = e.app.findRecordById('users', userId);
  user.setPassword(newPw); // setzt zugleich einen neuen tokenKey → alte Sessions des Ziels werden ungültig
  e.app.save(user);
  return e.json(200, { ok: true });
}, $apis.requireAuth('users'));
