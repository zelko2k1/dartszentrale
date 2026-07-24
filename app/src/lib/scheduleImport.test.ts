import { describe, it, expect } from 'vitest';
import { planOwnTeams, resolveOwnTeams } from './scheduleImport';
import type { League, Team, TeamKind } from '../data/types';

// Liga mit genau einer Eigen-Zeile + einem Gegner.
const league = (name: string, ownName: string, kind?: 'cup'): League => ({
  id: name, name, season: '2026/27', seasonId: 'S1',
  teams: [{ id: `own-${ownName}`, name: ownName, own: true }, { id: `opp-${name}`, name: 'Gegner', own: false }],
  fixtures: [], ...(kind ? { kind } : {}),
});
// Roster-Mannschaft (Mannschaften-Screen).
const roster = (name: string, lg: string, kind: TeamKind = 'league'): Team => ({
  id: `r-${name}`, name, league: lg, memberIds: [], captainId: null, kind, seasonId: 'S1',
});

describe('planOwnTeams', () => {
  it('legt ohne bestehende Roster-Mannschaft automatisch an (kein Konflikt)', () => {
    const plan = planOwnTeams([league('Bezirksoberliga', 'Dartverein Demo I')], []);
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.auto.map((t) => t.name)).toEqual(['Dartverein Demo I']);
    expect(plan.auto[0]).toMatchObject({ league: 'Bezirksoberliga', kind: 'league', seasonId: 'S1' });
  });

  it('meldet Konflikt, wenn für dieselbe Liga schon eine Roster-Mannschaft mit anderem Namen existiert', () => {
    const plan = planOwnTeams(
      [league('Bezirksoberliga', 'Dartverein Demo I')],
      [roster('1. Mannschaft', 'Bezirksoberliga')],
    );
    expect(plan.auto).toHaveLength(0);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]).toMatchObject({
      key: 'league|liga|bezirksoberliga',
      leagueName: 'Bezirksoberliga',
      existingName: '1. Mannschaft',
      importedName: 'Dartverein Demo I',
    });
  });

  it('legt nichts an, wenn eine Roster-Mannschaft mit exakt gleichem Namen existiert', () => {
    const plan = planOwnTeams(
      [league('Bezirksoberliga', 'Dartverein Demo I')],
      [roster('Dartverein Demo I', 'Bezirksoberliga')],
    );
    expect(plan.auto).toHaveLength(0);
    expect(plan.conflicts).toHaveLength(0);
  });

  it('trennt Liga- und Pokalmannschaft (gleicher Name, andere Art = kein Konflikt)', () => {
    // Roster kennt nur die LIGA-Mannschaft; die Pokal-Eigen-Zeile ist eigenständig.
    const plan = planOwnTeams(
      [league('QA Pokal', 'Dartverein Demo', 'cup')],
      [roster('Dartverein Demo', 'QA Pokal', 'league')],
    );
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.auto.map((t) => t.kind)).toEqual(['cup']);
  });

  it('meldet je Liga höchstens einen Konflikt', () => {
    const lg = league('Bezirksoberliga', 'Dartverein Demo I');
    lg.teams.push({ id: 'own2', name: 'Dartverein Demo', own: true }); // zweite eigene Zeile derselben Liga
    const plan = planOwnTeams([lg], [roster('1. Mannschaft', 'Bezirksoberliga')]);
    expect(plan.conflicts).toHaveLength(1);
  });
});

describe('resolveOwnTeams', () => {
  const plan = planOwnTeams(
    [league('Bezirksoberliga', 'Dartverein Demo I'), league('QA Importliga', 'Dartverein Demo')],
    [roster('1. Mannschaft', 'Bezirksoberliga')],
  );
  // Erwartung: 1 auto (QA Importliga), 1 Konflikt (Bezirksoberliga).

  it('Default = verknüpfen: legt nur die konfliktfreie Mannschaft an', () => {
    const teams = resolveOwnTeams(plan); // keine resolutions → alle 'link'
    expect(teams.map((t) => t.name)).toEqual(['Dartverein Demo']);
  });

  it("'new' legt die Import-Mannschaft zusätzlich an", () => {
    const key = plan.conflicts[0].key;
    const teams = resolveOwnTeams(plan, { [key]: 'new' });
    expect(teams.map((t) => t.name).sort()).toEqual(['Dartverein Demo', 'Dartverein Demo I']);
  });

  it("'skip' verhält sich wie 'link' (keine neue Mannschaft aus dem Konflikt)", () => {
    const key = plan.conflicts[0].key;
    const teams = resolveOwnTeams(plan, { [key]: 'skip' });
    expect(teams.map((t) => t.name)).toEqual(['Dartverein Demo']);
  });
});
