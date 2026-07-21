// Verifiziert, dass eingehende Fernbedienungs-Befehle den ECHTEN Store mutieren (nicht nur getypt sind):
// applyRemoteCommand → bestehende Store-Aktionen → allThrows/startOffset/pendingStart ändern sich.
// Läuft in node (kein jsdom): minimaler localStorage/matchMedia-Shim + dynamischer Store-Import,
// damit der Shim VOR dem Modul-Load des Stores greift.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { LiveCommand } from '../data/provider';

// ── Browser-Globals-Shim (nur so viel, wie der Store beim Import/Lauf berührt) ──
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
const g = globalThis as unknown as Record<string, unknown>;
g.localStorage = new MemStorage();
g.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });

// dynamisch (nach dem Shim) geladen
let useStore: typeof import('../store/useStore')['useStore'];
let applyRemoteCommand: typeof import('./liveHost')['applyRemoteCommand'];
let DEFAULT_SETTINGS: typeof import('../data/seed')['DEFAULT_SETTINGS'];

beforeAll(async () => {
  ({ useStore } = await import('../store/useStore'));
  ({ applyRemoteCommand } = await import('./liveHost'));
  ({ DEFAULT_SETTINGS } = await import('../data/seed'));
});

const cmd = (type: string, payload: Record<string, unknown> = {}): LiveCommand =>
  ({ id: 'x', session: 's', seq: 1, type, payload, createdBy: 'u' });

function newGameState(over: Record<string, unknown> = {}) {
  useStore.setState({
    settings: { ...DEFAULT_SETTINGS, startScore: 501, bestOf: 5, bestOfSets: 3, unit: 'legs', doubleOut: true, outMode: 'double', doubleIn: false },
    gamePlayers: [
      { id: 'a', name: 'Alice', short: 'AL', av: 0 },
      { id: 'b', name: 'Bob', short: 'BO', av: 0 },
    ],
    allThrows: [], startOffset: 0, input: '', screen: 'counter',
    pendingStart: false, bullMode: false, spinPick: null, restEntry: false, matchSaved: false,
  } as Partial<ReturnType<typeof useStore.getState>>);
  if (Object.keys(over).length) useStore.setState(over as Partial<ReturnType<typeof useStore.getState>>);
}

describe('applyRemoteCommand → echte Store-Mutation', () => {
  beforeEach(() => newGameState());

  it('quick: legt einen Wurf an', () => {
    applyRemoteCommand(cmd('quick', { v: 100 }));
    const t = useStore.getState().allThrows;
    expect(t.length).toBe(1);
    expect(t[0].raw).toBe(100);
  });

  it('digit + enter: puffert Ziffern und wertet sie', () => {
    applyRemoteCommand(cmd('digit', { d: '6' }));
    applyRemoteCommand(cmd('digit', { d: '0' }));
    expect(useStore.getState().input).toBe('60');
    applyRemoteCommand(cmd('enter'));
    const t = useStore.getState().allThrows;
    expect(t.length).toBe(1);
    expect(t[0].raw).toBe(60);
    expect(useStore.getState().input).toBe('');
  });

  it('del + clear: bearbeiten den Eingabepuffer', () => {
    applyRemoteCommand(cmd('digit', { d: '1' }));
    applyRemoteCommand(cmd('digit', { d: '8' }));
    applyRemoteCommand(cmd('del'));
    expect(useStore.getState().input).toBe('1');
    applyRemoteCommand(cmd('clear'));
    expect(useStore.getState().input).toBe('');
  });

  it('undo: nimmt den letzten Wurf zurück', () => {
    applyRemoteCommand(cmd('quick', { v: 140 }));
    expect(useStore.getState().allThrows.length).toBe(1);
    applyRemoteCommand(cmd('undo'));
    expect(useStore.getState().allThrows.length).toBe(0);
  });

  it('starter: wählt den Anwerfer und beendet die whoBegins-Phase', () => {
    newGameState({ pendingStart: true });
    applyRemoteCommand(cmd('starter', { idx: 1 }));
    expect(useStore.getState().startOffset).toBe(1);
    expect(useStore.getState().pendingStart).toBe(false);
  });

  it('unbekannter Befehl: wird ignoriert (kein Wurf)', () => {
    applyRemoteCommand(cmd('bogus'));
    expect(useStore.getState().allThrows.length).toBe(0);
  });
});
