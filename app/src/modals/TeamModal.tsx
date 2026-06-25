import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { TEAM_KINDS, teamKind } from '../data/constants';
import { Avatar } from '../components/Avatar';
import { Modal, ModalTitle, FieldLabel, ModalFooter } from '../components/Modal';
import { SearchInput } from '../components/SearchInput';
import { compareName, matchesQuery, nameParts } from '../lib/people';
import { IconShield, IconTrophy } from '../lib/icons';
import type { TeamKind } from '../data/types';

// Einheitliches Mannschafts-Icon je Art (Liga = Schild, Pokal = Pokal) — für Auswahl, Chips & Badges.
export const TeamKindIcon = ({ kind, size = 13 }: { kind: TeamKind; size?: number }) =>
  kind === 'cup' ? <IconTrophy size={size} /> : <IconShield size={size} />;

export function TeamModal() {
  const s = useStore();
  const m = s.teamModal;
  const order = s.settings.nameOrder ?? 'first';
  const [query, setQuery] = useState('');
  const players = useMemo(() => {
    const sorted = [...s.players].sort((a, b) => compareName(nameParts(a.name), nameParts(b.name), order));
    return sorted.filter((p) => matchesQuery(query, p.name, p.short));
  }, [s.players, order, query]);
  // Bestehende Zugehörigkeit: in welchen ANDEREN Mannschaften ist der Spieler schon? Ein Spieler kann
  // gleichzeitig in mehreren Kadern stehen (z. B. Liga- UND Pokalmannschaft) — daher eine Liste je Spieler.
  const membershipsByPlayer = useMemo(() => {
    const map = new Map<string, { name: string; kind: TeamKind }[]>();
    for (const t of s.teams) {
      if (m && t.id === m.id) continue; // die gerade bearbeitete Mannschaft nicht anzeigen (zeigt schon die Checkbox)
      const entry = { name: t.name, kind: teamKind(t) };
      for (const pid of t.memberIds) {
        const arr = map.get(pid); if (arr) arr.push(entry); else map.set(pid, [entry]);
      }
    }
    return map;
  }, [s.teams, m?.id]);
  if (!m) return null;
  // (Name, Art) muss eindeutig sein: gleicher Name nur EINMAL je Art (Liga/Pokal). Eine Pokalmannschaft
  // darf wie die Liga-Mannschaft heißen, aber keine zweite Liga- bzw. zweite Pokalmannschaft mit gleichem Namen.
  const norm = (x: string) => x.replace(/\s+/g, ' ').trim().toLowerCase();
  const nameNorm = norm(m.name);
  const sameName = nameNorm.length > 0 ? s.teams.filter((t) => t.id !== m.id && norm(t.name) === nameNorm) : [];
  const dupSameKind = sameName.some((t) => teamKind(t) === m.kind);
  const otherKindExists = sameName.some((t) => teamKind(t) !== m.kind);
  const otherKind: TeamKind = m.kind === 'league' ? 'cup' : 'league';
  const canSave = m.name.trim().length > 0 && !dupSameKind;

  // Mannschaftsführung – oben sichtbar, ohne im Kader suchen zu müssen.
  const captainPlayer = m.captainId ? s.players.find((p) => p.id === m.captainId) || null : null;
  const vicePlayers = m.viceCaptainIds.map((id) => s.players.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <Modal onClose={() => s.closeTeamModal()} width={520} z={61} style={{ maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Fester Kopf: scrollt NICHT mit, damit Suche immer erreichbar bleibt. */}
      <div style={{ flexShrink: 0 }}>
      <ModalTitle>{m.mode === 'edit' ? 'Mannschaft bearbeiten' : 'Neue Mannschaft'}</ModalTitle>

      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1.4 }}>
          <FieldLabel>Mannschaftsname</FieldLabel>
          <input className="dh-input" value={m.name} onChange={(e) => s.setTeamField('name', e.target.value)} placeholder="z. B. 1. Mannschaft" style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
        </div>
        <div style={{ flex: 1 }}>
          <FieldLabel note="(optional)">Liga</FieldLabel>
          <input className="dh-input" value={m.league} onChange={(e) => s.setTeamField('league', e.target.value)} placeholder="z. B. Verbandsliga Nord" style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
        </div>
      </div>

      <FieldLabel>Art der Mannschaft</FieldLabel>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {(Object.keys(TEAM_KINDS) as TeamKind[]).map((k) => {
          const def = TEAM_KINDS[k]; const on = m.kind === k;
          return (
            <button key={k} onClick={() => s.setTeamField('kind', k)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: on ? `color-mix(in srgb, ${def.color} 13%, transparent)` : 'var(--btn)', border: `1px solid ${on ? def.color : 'var(--border-2)'}`, color: on ? def.color : 'var(--text-3)', borderRadius: 11, padding: '10px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <TeamKindIcon kind={k} size={15} />
              {def.label}
            </button>
          );
        })}
      </div>

      {dupSameKind && (
        <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 9, background: 'rgba(224,89,75,.1)', border: '1px solid rgba(224,89,75,.45)', borderRadius: 11, padding: '11px 13px', marginBottom: 16 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#E0594B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></svg>
          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
            <strong style={{ color: '#E0594B' }}>Name bereits vergeben.</strong> Es gibt schon eine {TEAM_KINDS[m.kind].label} „{m.name.trim()}". Mit demselben Namen ist nur eine {TEAM_KINDS[otherKind].label} möglich.
          </div>
        </div>
      )}
      {!dupSameKind && otherKindExists && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: `color-mix(in srgb, ${TEAM_KINDS[otherKind].color} 9%, transparent)`, border: `1px solid color-mix(in srgb, ${TEAM_KINDS[otherKind].color} 35%, transparent)`, borderRadius: 11, padding: '10px 13px', marginBottom: 16 }}>
          <TeamKindIcon kind={otherKind} size={15} />
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.45 }}>Es gibt bereits eine {TEAM_KINDS[otherKind].label} mit diesem Namen — als {TEAM_KINDS[m.kind].label} ist das erlaubt.</div>
        </div>
      )}

      {/* Führungs-Übersicht: Kapitän & Vertretung oben sichtbar, mit „×" entfernbar (Festlegen im Kader unten). */}
      {m.memberIds.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 14, padding: '11px 13px', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-4)', letterSpacing: '.05em', textTransform: 'uppercase' }}>Führung</span>
          {captainPlayer ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#F2B829', background: 'rgba(242,184,41,.13)', border: '1px solid rgba(242,184,41,.4)', borderRadius: 999, padding: '4px 6px 4px 10px' }}>
              C · {captainPlayer.name}
              <button onClick={() => s.setTeamCaptain(captainPlayer.id)} title="Kapitän entfernen" style={{ display: 'flex', width: 16, height: 16, borderRadius: '50%', border: 'none', background: 'rgba(242,184,41,.25)', color: '#F2B829', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, padding: 0, fontFamily: 'inherit' }}>×</button>
            </span>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-5)' }}>Kein Kapitän</span>
          )}
          {vicePlayers.map((v, i) => (
            <span key={v.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#3B9EFF', background: 'rgba(59,158,255,.13)', border: '1px solid rgba(59,158,255,.4)', borderRadius: 999, padding: '4px 6px 4px 10px' }}>
              V{i + 1} · {v.name}
              <button onClick={() => s.toggleTeamViceCaptain(v.id)} title="Vertretung entfernen" style={{ display: 'flex', width: 16, height: 16, borderRadius: '50%', border: 'none', background: 'rgba(59,158,255,.25)', color: '#3B9EFF', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, padding: 0, fontFamily: 'inherit' }}>×</button>
            </span>
          ))}
          <span style={{ fontSize: 11, color: 'var(--text-5)', marginLeft: 'auto' }}>im Kader festlegen ↓</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>Kader aus Spielerliste</label>
        <span style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 600 }}>{m.memberIds.length} ausgewählt</span>
      </div>

      {s.players.length === 0 && (
        <div style={{ background: 'var(--btn)', border: '1px dashed var(--border-strong)', borderRadius: 12, padding: 24, textAlign: 'center', color: 'var(--text-4)', fontSize: 13, marginBottom: 18 }}>Lege zuerst Spieler unter „Spieler" an.</div>
      )}

      {s.players.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <SearchInput value={query} onChange={setQuery} placeholder="Spieler suchen …" width="100%" />
        </div>
      )}
      </div>

      {/* Nur die Spielerliste scrollt. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', margin: '0 -4px', padding: '2px 4px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {s.players.length > 0 && players.length === 0 && (
          <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>Kein Spieler passt zu „{query}".</div>
        )}
        {players.map((p) => {
          const on = m.memberIds.includes(p.id); const isCap = m.captainId === p.id;
          const viceIdx = m.viceCaptainIds.indexOf(p.id); const isVice = viceIdx >= 0;
          const viceFull = m.viceCaptainIds.length >= 2;
          const memberOf = membershipsByPlayer.get(p.id) || [];
          return (
            <div key={p.id} onClick={() => s.toggleTeamMember(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: `1px solid ${on ? 'var(--accent)' : 'var(--border-2)'}`, background: on ? 'color-mix(in srgb, var(--accent) 9%, transparent)' : 'var(--btn)', borderRadius: 11, cursor: 'pointer' }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${on ? 'var(--accent)' : 'var(--border-strong)'}`, background: on ? 'var(--accent)' : 'transparent', color: 'var(--accent-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {on && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
              </div>
              <Avatar photo={p.photo} short={p.short} avi={p.avi} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                {memberOf.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 4 }} title={`Bereits im Kader von: ${memberOf.map((x) => x.name).join(', ')}`}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-5)', textTransform: 'uppercase', letterSpacing: '.04em' }}>bereits in</span>
                    {memberOf.map((x) => (
                      <span key={x.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: TEAM_KINDS[x.kind].color, background: `color-mix(in srgb, ${TEAM_KINDS[x.kind].color} 11%, transparent)`, border: `1px solid color-mix(in srgb, ${TEAM_KINDS[x.kind].color} 40%, transparent)`, borderRadius: 5, padding: '1px 6px 1px 5px', whiteSpace: 'nowrap' }}>
                        <TeamKindIcon kind={x.kind} size={11} />{x.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {on && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => s.setTeamCaptain(p.id)} title="Als Kapitän festlegen" style={{ display: 'flex', alignItems: 'center', gap: 5, background: isCap ? 'rgba(242,184,41,.14)' : 'var(--btn)', border: `1px solid ${isCap ? 'rgba(242,184,41,.5)' : 'var(--border-2)'}`, color: isCap ? '#F2B829' : 'var(--text-4)', padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '.03em' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 6.5L21 9l-5 4.5L17.5 21 12 17.3 6.5 21 8 13.5 3 9l6.6-.5z" /></svg>
                    Kapitän
                  </button>
                  {!isCap && (
                    <button onClick={() => s.toggleTeamViceCaptain(p.id)} disabled={!isVice && viceFull} title={!isVice && viceFull ? 'Maximal 2 Ersatzkapitäne' : 'Als Ersatzkapitän festlegen'} style={{ background: isVice ? 'rgba(59,158,255,.14)' : 'var(--btn)', border: `1px solid ${isVice ? 'rgba(59,158,255,.5)' : 'var(--border-2)'}`, color: isVice ? '#3B9EFF' : 'var(--text-4)', padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: (!isVice && viceFull) ? 'default' : 'pointer', opacity: (!isVice && viceFull) ? 0.5 : 1, fontFamily: 'inherit', letterSpacing: '.03em', whiteSpace: 'nowrap' }}>
                      {isVice ? `Vertretung ${viceIdx + 1}` : 'Vertretung'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>

      {/* Fester Fuß mit Speichern – immer sichtbar, auch bei langer Liste. */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
        <ModalFooter
          onDelete={m.mode === 'edit' ? () => s.deleteTeam(m.id!) : undefined}
          onCancel={() => s.closeTeamModal()}
          onSave={() => s.saveTeamModal()}
          saveDisabled={!canSave}
        />
      </div>
    </Modal>
  );
}
