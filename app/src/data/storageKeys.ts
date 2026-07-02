// Zentrale localStorage-Schlüssel (gemeinsame Quelle für Store & LocalProvider).
// Hinweis: useStore hält aktuell noch eine eigene Kopie (identische Strings) — wird in Phase 1 konsolidiert.
export const STORAGE_KEYS = {
  settings: 'darts_settings',
  players: 'darts_players',
  matches: 'darts_matches',
  training: 'darts_training',
  trainplays: 'darts_trainplays',
  live: 'darts_live',
  events: 'darts_events',
  teams: 'darts_teams',
  users: 'darts_users',
  session: 'darts_session',
  leagues: 'darts_leagues',
  seasons: 'darts_seasons',
  seasonSnapshots: 'darts_season_snapshots',
} as const;
