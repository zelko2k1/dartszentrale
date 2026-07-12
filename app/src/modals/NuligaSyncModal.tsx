import { useStore } from '../store/useStore';
import { Modal, ModalTitle } from '../components/Modal';

// Ergebnis-/Review-Dialog des nuLiga-Abrufs: Ladephase, Erfolg (Zähler + Konfliktliste) oder Fehler.
// Konflikte = eigene Heimspiele, bei denen nuLiga vom autoritativen (Counter/manuell) Ergebnis abweicht;
// hier pro Zeile auflösbar (eigenes behalten / nuLiga übernehmen).
function fmtDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(+d)) return '';
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function NuligaSyncModal() {
  const s = useStore();
  const sync = s.nuligaSync;
  if (!sync) return null;
  const close = () => s.closeNuligaSync();

  return (
    <Modal onClose={close} width={560} z={64} style={{ maxHeight: '88vh', overflow: 'auto' }}>
      <ModalTitle>nuLiga · {sync.leagueName}</ModalTitle>

      {sync.phase === 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 4px 26px', color: 'var(--text-3)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'dh-spin 0.9s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Spielplan wird von nuLiga geladen …</span>
        </div>
      )}

      {sync.phase === 'error' && (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'rgba(224,89,75,.1)', border: '1px solid rgba(224,89,75,.35)', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E0594B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
            <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.5 }}>{sync.error || 'Der Abruf ist fehlgeschlagen.'}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button className="dh-btn" onClick={() => s.importNuliga(sync.leagueId)} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '11px 18px', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Erneut versuchen</button>
            <button onClick={close} style={{ background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '11px 20px', borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Schließen</button>
          </div>
        </>
      )}

      {sync.phase === 'done' && sync.counts && (() => {
        const c = sync.counts;
        const conflicts = sync.conflicts || [];
        const stat = (label: string, value: number, color?: string) => (
          <div style={{ flex: '1 1 120px', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '11px 14px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-num)', color: color || 'var(--text)' }}>{value}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-4)', fontWeight: 600, marginTop: 2 }}>{label}</div>
          </div>
        );
        return (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginBottom: 16 }}>
              {sync.total ?? 0} Begegnungen von nuLiga · Stand {fmtDateTime(sync.fetchedAt)}
              {sync.championship ? ` · ${sync.championship}` : ''}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: conflicts.length ? 22 : 8 }}>
              {stat('Ergebnisse übernommen', c.resultsSet, 'var(--success)')}
              {stat('Begegnungen neu', c.fixturesNew)}
              {stat('Mannschaften neu', c.teamsNew)}
              {conflicts.length > 0 && stat('Konflikte', c.conflicts, '#E0A020')}
            </div>

            {conflicts.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-2)', marginBottom: 4 }}>Konflikte bei eigenen Heimspielen</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 12, lineHeight: 1.5 }}>
                  Hier weicht nuLiga von deinem per Counter/manuell erfassten Ergebnis ab. Dein Ergebnis wurde behalten —
                  prüfe und entscheide je Begegnung.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {conflicts.map((cf) => (
                    <div key={cf.fixtureId} style={{ border: '1px solid var(--border-2)', borderRadius: 12, padding: '11px 13px', background: 'rgba(242,184,41,.07)' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{cf.homeName} — {cf.awayName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
                        {cf.date} · eigenes <b style={{ fontFamily: 'var(--font-num)' }}>{cf.local.hs}:{cf.local.as}</b> ({cf.local.source === 'counter' ? 'Counter' : 'manuell'}) · nuLiga <b style={{ fontFamily: 'var(--font-num)' }}>{cf.nuliga.hs}:{cf.nuliga.as}</b>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => s.resolveNuligaConflict(sync.leagueId, cf.fixtureId, false)} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-2)', padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Eigenes behalten</button>
                        <button onClick={() => s.resolveNuligaConflict(sync.leagueId, cf.fixtureId, true)} style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)', border: '1px solid var(--accent)', color: 'var(--accent)', padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>nuLiga übernehmen</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {conflicts.length === 0 && c.conflicts > 0 && (
              <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, marginBottom: 8 }}>Alle Konflikte geklärt. ✓</div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={close} style={{ background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '11px 22px', borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Fertig</button>
            </div>
          </>
        );
      })()}
    </Modal>
  );
}
