import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { TEAM_KINDS, teamKind } from '../data/constants';
import { Avatar } from '../components/Avatar';
import { Modal, ModalTitle, FieldLabel, ModalFooter } from '../components/Modal';
import { SearchInput } from '../components/SearchInput';
import { compareName, matchesQuery, nameParts } from '../lib/people';
import { IconShield, IconTrophy } from '../lib/icons';
import type { TeamKind } from '../data/types';
import { useT } from '../i18n';

// Einheitliches Mannschafts-Icon je Art (Liga = Schild, Pokal = Pokal) — für Auswahl, Chips & Badges.
export const TeamKindIcon = ({ kind, size = 13 }: { kind: TeamKind; size?: number }) =>
  kind === 'cup' ? <IconTrophy size={size} /> : <IconShield size={size} />;

export function TeamModal() {
  const s = useStore();
  const tr = useT();
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
    <Modal onClose={() => s.closeTeamModal()} width={520} z={61} label={m.mode === 'edit' ? tr.modals.teamEdit : tr.modals.teamNew} style={{ maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Fester Kopf: scrollt NICHT mit, damit Suche immer erreichbar bleibt. */}
      <div style={{ flexShrink: 0 }}>
      <ModalTitle>{m.mode === 'edit' ? tr.modals.teamEdit : tr.modals.teamNew}</ModalTitle>

      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1.4 }}>
          <FieldLabel>{tr.modals.teamName}</FieldLabel>
          <input className="dh-input" value={m.name} maxLength={60} onChange={(e) => s.setTeamField('name', e.target.value)} aria-label={tr.modals.teamName} placeholder={tr.modals.teamNameEgPh} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '12px 14px', color: 'var(--text)', fontSize: 'var(--fs-body)', fontFamily: 'inherit' }} />
        </div>
        <div style={{ flex: 1 }}>
          <FieldLabel note={tr.modals.optional}>{tr.modals.leagueField}</FieldLabel>
          <input className="dh-input" value={m.league} maxLength={60} onChange={(e) => s.setTeamField('league', e.target.value)} aria-label={tr.modals.leagueField} placeholder={tr.modals.leagueNamePh} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '12px 14px', color: 'var(--text)', fontSize: 'var(--fs-body)', fontFamily: 'inherit' }} />
        </div>
      </div>

      <FieldLabel>{tr.modals.teamKindLabel}</FieldLabel>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {(Object.keys(TEAM_KINDS) as TeamKind[]).map((k) => {
          const def = TEAM_KINDS[k]; const on = m.kind === k;
          return (
            <button key={k} onClick={() => s.setTeamKind(k)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: on ? `color-mix(in srgb, ${def.color} 13%, transparent)` : 'var(--btn)', border: `1px solid ${on ? def.color : 'var(--border-2)'}`, color: on ? def.color : 'var(--text-3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 'var(--fs-sub)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <TeamKindIcon kind={k} size={15} />
              {def.label}
            </button>
          );
        })}
      </div>

      {dupSameKind && (
        <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 9, background: 'color-mix(in srgb, var(--danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 45%, transparent)', borderRadius: 'var(--radius-md)', padding: '11px 13px', marginBottom: 16 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></svg>
          <div style={{ fontSize: 'var(--fs-sub)', color: 'var(--text-2)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--danger)' }}>{tr.modals.dupName}</strong>{tr.modals.dupNameBody(TEAM_KINDS[m.kind].label, m.name.trim(), TEAM_KINDS[otherKind].label)}
          </div>
        </div>
      )}
      {!dupSameKind && otherKindExists && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: `color-mix(in srgb, ${TEAM_KINDS[otherKind].color} 9%, transparent)`, border: `1px solid color-mix(in srgb, ${TEAM_KINDS[otherKind].color} 35%, transparent)`, borderRadius: 'var(--radius-md)', padding: '10px 13px', marginBottom: 16 }}>
          <TeamKindIcon kind={otherKind} size={15} />
          <div style={{ fontSize: 'var(--fs-sub)', color: 'var(--text-3)', lineHeight: 1.45 }}>{tr.modals.otherKindOk(TEAM_KINDS[otherKind].label, TEAM_KINDS[m.kind].label)}</div>
        </div>
      )}

      {/* Führungs-Übersicht: Kapitän & Vertretung oben sichtbar, mit „×" entfernbar (Festlegen im Kader unten). */}
      {m.memberIds.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 14, padding: '11px 13px', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)' }}>
          <span style={{ fontSize: 'var(--fs-badge)', fontWeight: 800, color: 'var(--text-4)', letterSpacing: '.05em', textTransform: 'uppercase' }}>{tr.modals.leadership}</span>
          {captainPlayer ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-meta)', fontWeight: 700, color: 'var(--gold-text)', background: 'color-mix(in srgb, var(--gold) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 40%, transparent)', borderRadius: 'var(--radius-pill)', padding: '4px 6px 4px 10px' }}>
              C · {captainPlayer.name}
              <button onClick={() => s.setTeamCaptain(captainPlayer.id)} title={tr.modals.removeCaptain} aria-label={tr.modals.removeCaptain} style={{ display: 'flex', minWidth: 44, minHeight: 44, borderRadius: '50%', border: 'none', background: 'color-mix(in srgb, var(--gold) 25%, transparent)', color: 'var(--gold-text)', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-badge)', fontWeight: 800, padding: 0, fontFamily: 'inherit' }}>×</button>
            </span>
          ) : (
            <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-5)' }}>{tr.modals.noCaptain}</span>
          )}
          {vicePlayers.map((v, i) => (
            <span key={v.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-meta)', fontWeight: 700, color: 'var(--info)', background: 'color-mix(in srgb, var(--info) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--info) 40%, transparent)', borderRadius: 'var(--radius-pill)', padding: '4px 6px 4px 10px' }}>
              V{i + 1} · {v.name}
              <button onClick={() => s.toggleTeamViceCaptain(v.id)} title={tr.modals.removeVice} aria-label={tr.modals.removeVice} style={{ display: 'flex', minWidth: 44, minHeight: 44, borderRadius: '50%', border: 'none', background: 'color-mix(in srgb, var(--info) 25%, transparent)', color: 'var(--info)', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-badge)', fontWeight: 800, padding: 0, fontFamily: 'inherit' }}>×</button>
            </span>
          ))}
          <span style={{ fontSize: 'var(--fs-badge)', color: 'var(--text-5)', marginLeft: 'auto' }}>{tr.modals.setInSquad}</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <label style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-3)', fontWeight: 700 }}>{tr.modals.squadFromList}</label>
        <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-4)', fontWeight: 600 }}>{tr.modals.selectedCount(m.memberIds.length)}</span>
      </div>

      {s.players.length === 0 && (
        <div style={{ background: 'var(--btn)', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', padding: 24, textAlign: 'center', color: 'var(--text-4)', fontSize: 'var(--fs-sub)', marginBottom: 18 }}>{tr.modals.createPlayersFirst}</div>
      )}

      {s.players.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <SearchInput value={query} onChange={setQuery} placeholder={tr.players.search} width="100%" />
        </div>
      )}
      </div>

      {/* Nur die Spielerliste scrollt. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', margin: '0 -4px', padding: '2px 4px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {s.players.length > 0 && players.length === 0 && (
          <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-4)', fontSize: 'var(--fs-sub)' }}>{tr.players.noMatch(query)}</div>
        )}
        {players.map((p) => {
          const on = m.memberIds.includes(p.id); const isCap = m.captainId === p.id;
          const viceIdx = m.viceCaptainIds.indexOf(p.id); const isVice = viceIdx >= 0;
          const viceFull = m.viceCaptainIds.length >= 2;
          const memberOf = membershipsByPlayer.get(p.id) || [];
          return (
            <div key={p.id} role="button" tabIndex={0} aria-pressed={on} onClick={() => s.toggleTeamMember(p.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); s.toggleTeamMember(p.id); } }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: `1px solid ${on ? 'var(--accent)' : 'var(--border-2)'}`, background: on ? 'color-mix(in srgb, var(--accent) 9%, transparent)' : 'var(--btn)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
              <div style={{ width: 22, height: 22, borderRadius: 'var(--radius-xs)', border: `2px solid ${on ? 'var(--accent)' : 'var(--border-strong)'}`, background: on ? 'var(--accent)' : 'transparent', color: 'var(--accent-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {on && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
              </div>
              <Avatar photo={p.photo} short={p.short} avi={p.avi} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                {memberOf.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 4 }} title={tr.modals.alreadyInTitle(memberOf.map((x) => x.name).join(', '))}>
                    <span style={{ fontSize: 'var(--fs-badge)', fontWeight: 700, color: 'var(--text-5)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{tr.modals.alreadyIn}</span>
                    {memberOf.map((x) => (
                      <span key={x.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-badge)', fontWeight: 700, color: TEAM_KINDS[x.kind].color, background: `color-mix(in srgb, ${TEAM_KINDS[x.kind].color} 11%, transparent)`, border: `1px solid color-mix(in srgb, ${TEAM_KINDS[x.kind].color} 40%, transparent)`, borderRadius: 'var(--radius-xs)', padding: '1px 6px 1px 5px', whiteSpace: 'nowrap' }}>
                        <TeamKindIcon kind={x.kind} size={11} />{x.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {on && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => s.setTeamCaptain(p.id)} title={tr.modals.setCaptainTitle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 44, background: isCap ? 'color-mix(in srgb, var(--gold) 14%, transparent)' : 'var(--btn)', border: `1px solid ${isCap ? 'color-mix(in srgb, var(--gold) 50%, transparent)' : 'var(--border-2)'}`, color: isCap ? 'var(--gold)' : 'var(--text-4)', padding: '5px 10px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-badge)', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '.03em' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 6.5L21 9l-5 4.5L17.5 21 12 17.3 6.5 21 8 13.5 3 9l6.6-.5z" /></svg>
                    {tr.modals.captainBtn}
                  </button>
                  {!isCap && (
                    <button onClick={() => s.toggleTeamViceCaptain(p.id)} disabled={!isVice && viceFull} title={!isVice && viceFull ? tr.modals.maxVice : tr.modals.setViceTitle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, background: isVice ? 'color-mix(in srgb, var(--info) 14%, transparent)' : 'var(--btn)', border: `1px solid ${isVice ? 'color-mix(in srgb, var(--info) 50%, transparent)' : 'var(--border-2)'}`, color: isVice ? 'var(--info)' : 'var(--text-4)', padding: '5px 10px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-badge)', fontWeight: 800, cursor: (!isVice && viceFull) ? 'default' : 'pointer', opacity: (!isVice && viceFull) ? 0.5 : 1, fontFamily: 'inherit', letterSpacing: '.03em', whiteSpace: 'nowrap' }}>
                      {isVice ? tr.modals.viceN(viceIdx + 1) : tr.modals.vice}
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
