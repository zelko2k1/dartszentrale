// Der Vereins-Reload (alle 4 s auf dem Turnier-Bildschirm und auf jedem wartenden Board) darf
// den Store nur anfassen, wenn sich wirklich etwas geändert hat. Vorher setzte er bei JEDEM Poll
// frische Arrays → jeder Selektor bekam eine neue Identität, jedes useMemo fiel um.
//
// Läuft in node (kein jsdom): minimaler Browser-Shim + dynamischer Store-Import, damit der Shim
// VOR dem Modul-Load greift (gleiches Muster wie applyRemoteCommand.test.ts).
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

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

let useStore: typeof import('./useStore')['useStore'];

// Minimaler Vereins-Provider: liefert einen Snapshot, den der Test kontrolliert.
function makeProvider(snapshot: () => Record<string, unknown>) {
  return {
    mode: 'verein',
    liveSupported: false,
    loadAll: async () => snapshot(),
    logout: async () => {},
    saveSettings: async () => {},
    createRecord: async () => ({}),
    updateRecord: async () => ({}),
    deleteRecord: async () => {},
  } as unknown as import('../data/provider').DataProvider;
}

const EMPTY = () => ({
  players: [], teams: [], accounts: [], leagues: [], events: [], matches: [],
  seasons: [], seasonSnapshots: [], tournaments: [], trainingPlays: [], settings: {},
});

beforeAll(async () => { ({ useStore } = await import('./useStore')); });

describe('Vereins-Reload', () => {
  beforeEach(() => {
    useStore.setState({ session: null, syncError: null });
  });

  it('schreibt beim ersten Laden', async () => {
    useStore.setState({ provider: makeProvider(EMPTY) });
    let writes = 0;
    const off = useStore.subscribe(() => { writes++; });
    await useStore.getState().reloadFromProvider();
    await new Promise((r) => setTimeout(r, 20));
    off();
    expect(writes).toBeGreaterThan(0);
  });

  it('schreibt NICHT, wenn der Server dieselben Daten liefert', async () => {
    useStore.setState({ provider: makeProvider(EMPTY) });
    await useStore.getState().reloadFromProvider();
    await new Promise((r) => setTimeout(r, 20));

    let writes = 0;
    const off = useStore.subscribe(() => { writes++; });
    for (let i = 0; i < 5; i++) {
      await useStore.getState().reloadFromProvider();
      await new Promise((r) => setTimeout(r, 20));
    }
    off();
    expect(writes).toBe(0);
  });

  it('schreibt wieder, sobald sich etwas ändert', async () => {
    let players: unknown[] = [];
    useStore.setState({ provider: makeProvider(() => ({ ...EMPTY(), players })) });
    await useStore.getState().reloadFromProvider();
    await new Promise((r) => setTimeout(r, 20));

    let writes = 0;
    const off = useStore.subscribe(() => { writes++; });
    players = [{ id: 'p1', name: 'Neu', short: 'NEU', avi: 0 }];
    await useStore.getState().reloadFromProvider();
    await new Promise((r) => setTimeout(r, 20));
    off();
    expect(writes).toBeGreaterThan(0);
    expect(useStore.getState().players.some((p) => p.id === 'p1')).toBe(true);
  });

  it('schreibt trotz gleicher Daten, wenn ein Sync-Fehler aufzuräumen ist', async () => {
    useStore.setState({ provider: makeProvider(EMPTY) });
    await useStore.getState().reloadFromProvider();
    await new Promise((r) => setTimeout(r, 20));

    useStore.setState({ syncError: 'irgendwas ging schief' });
    await useStore.getState().reloadFromProvider();
    await new Promise((r) => setTimeout(r, 20));
    expect(useStore.getState().syncError).toBe(null);
  });
});
