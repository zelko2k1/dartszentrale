import { useStore } from '../store/useStore';
import { Modal, ModalTitle, FieldLabel, ModalFooter } from '../components/Modal';
import { LEAGUE_FORMAT_PRESETS, TEAM_KINDS } from '../data/constants';
import { TeamKindIcon } from './TeamModal';
import type { TeamKind } from '../data/types';

export function LeagueModal() {
  const s = useStore();
  const m = s.leagueModal;
  if (!m) return null;
  const canSave = m.name.trim().length > 0;

  const fmtKey = JSON.stringify(m.format);
  const activePreset = m.format == null ? 'custom'
    : (Object.keys(LEAGUE_FORMAT_PRESETS).find((k) => JSON.stringify(LEAGUE_FORMAT_PRESETS[k].segments) === fmtKey) || 'preset');
  const presetBtn = (key: string, label: string, sub: string) => {
    const on = activePreset === key;
    return (
      <button key={key} onClick={() => s.setLeagueFormatPreset(key as 'BZ' | 'BL' | 'LL' | 'custom')} style={{ flex: 1, minWidth: 140, textAlign: 'left', background: on ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--btn)', border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border-2)'}`, borderRadius: 11, padding: '10px 13px', cursor: 'pointer', fontFamily: 'inherit' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: on ? 'var(--accent)' : 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{sub}</div>
      </button>
    );
  };

  return (
    <Modal onClose={() => s.closeLeagueModal()} width={540} z={62} style={{ maxHeight: '88vh', overflow: 'auto' }}>
      <ModalTitle>{m.mode === 'edit' ? 'Liga bearbeiten' : 'Neue Liga'}</ModalTitle>

      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1.6 }}>
          <FieldLabel>Liganame</FieldLabel>
          <input className="dh-input" value={m.name} onChange={(e) => s.setLeagueField('name', e.target.value)} placeholder="z. B. Verbandsliga Nord" style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
        </div>
        <div style={{ flex: 1 }}>
          <FieldLabel>Saison</FieldLabel>
          <input className="dh-input" value={m.season} onChange={(e) => s.setLeagueField('season', e.target.value)} placeholder="2025/26" style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
        </div>
      </div>

      <FieldLabel>Art des Wettbewerbs</FieldLabel>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {(['league', 'cup'] as TeamKind[]).map((k) => {
          const def = TEAM_KINDS[k]; const on = m.kind === k;
          return (
            <button key={k} onClick={() => s.setLeagueField('kind', k)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: on ? `color-mix(in srgb, ${def.color} 13%, transparent)` : 'var(--btn)', border: `1px solid ${on ? def.color : 'var(--border-2)'}`, color: on ? def.color : 'var(--text-3)', borderRadius: 11, padding: '10px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <TeamKindIcon kind={k} size={15} />
              {k === 'cup' ? 'Pokal' : 'Liga'}
            </button>
          );
        })}
      </div>

      <FieldLabel>Spielformat</FieldLabel>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {presetBtn('BZ', LEAGUE_FORMAT_PRESETS.BZ.label, LEAGUE_FORMAT_PRESETS.BZ.short)}
        {presetBtn('BL', LEAGUE_FORMAT_PRESETS.BL.label, LEAGUE_FORMAT_PRESETS.BL.short)}
        {presetBtn('LL', LEAGUE_FORMAT_PRESETS.LL.label, LEAGUE_FORMAT_PRESETS.LL.short)}
        {presetBtn('custom', 'Eigenes', 'Einzel/Doppel frei wählen')}
      </div>

      {m.format == null ? (
        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <FieldLabel note="pro Begegnung">Einzel</FieldLabel>
            <input className="dh-input" type="number" min={0} max={12} value={m.singlesCount} onChange={(e) => s.setLeagueCount('singlesCount', parseInt(e.target.value, 10) || 0)} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel note="pro Begegnung">Doppel</FieldLabel>
            <input className="dh-input" type="number" min={0} max={12} value={m.doublesCount} onChange={(e) => s.setLeagueCount('doublesCount', parseInt(e.target.value, 10) || 0)} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 18, lineHeight: 1.5 }}>
          Ablauf: {m.format.map((seg) => `${seg.count} ${seg.kind === 'singles' ? 'Einzel' : 'Doppel'}`).join(' → ')}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>Mannschaften in der Liga</label>
        <span style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 600 }}>{m.teams.length}</span>
      </div>
      {m.teams.length === 0 && <div style={{ background: 'var(--btn)', border: '1px dashed var(--border-strong)', borderRadius: 12, padding: 18, textAlign: 'center', color: 'var(--text-4)', fontSize: 13, marginBottom: 12 }}>Füge die teilnehmenden Mannschaften hinzu — auch gegnerische Vereine.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {m.teams.map((t) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input className="dh-input" value={t.name} onChange={(e) => s.setLeagueTeamName(t.id, e.target.value)} placeholder="Mannschaftsname" style={{ flex: 1, boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
            <button onClick={() => s.toggleLeagueTeamOwn(t.id)} title="Eigene Mannschaft" style={{ display: 'flex', alignItems: 'center', gap: 6, background: t.own ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--btn)', border: `1px solid ${t.own ? 'var(--accent)' : 'var(--border-2)'}`, color: t.own ? 'var(--accent)' : 'var(--text-4)', padding: '9px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              Eigene
            </button>
            <button className="dh-btn" onClick={() => s.removeLeagueTeam(t.id)} title="Entfernen" style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
            </button>
          </div>
        ))}
      </div>
      <button onClick={() => s.addLeagueTeam()} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'transparent', border: '1px dashed var(--border-strong)', color: 'var(--text-3)', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 22 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        Mannschaft hinzufügen
      </button>

      <ModalFooter
        onDelete={m.mode === 'edit' ? () => { if (window.confirm(`Liga „${m.name}" mit komplettem Spielplan und allen zugehörigen Spieltag-Terminen wirklich löschen? Das lässt sich nicht rückgängig machen.`)) s.deleteLeague(m.id!); } : undefined}
        onCancel={() => s.closeLeagueModal()}
        onSave={() => s.saveLeagueModal()}
        saveDisabled={!canSave}
      />
    </Modal>
  );
}
