// Zentrale localStorage-Schlüssel (gemeinsame Quelle für Store & LocalProvider).
// Hinweis: useStore hält aktuell noch eine eigene Kopie (identische Strings) — wird in Phase 1 konsolidiert.
export const STORAGE_KEYS = {
  settings: 'dartshub_settings',
  players: 'dartshub_players',
  matches: 'dartshub_matches',
  training: 'dartshub_training',
  trainplays: 'dartshub_trainplays',
  live: 'dartshub_live',
  events: 'dartshub_events',
  teams: 'dartshub_teams',
  users: 'dartshub_users',
  session: 'dartshub_session',
  leagues: 'dartshub_leagues',
  seasons: 'dartshub_seasons',
} as const;
