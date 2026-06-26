import { useState } from 'react';
import { useStore } from '../store/useStore';
import { ROLES, ROLE_ORDER } from '../data/constants';
import { Modal, ModalTitle, FieldLabel, ModalFooter } from '../components/Modal';
import { SearchInput } from '../components/SearchInput';
import { Avatar } from '../components/Avatar';
import { initials } from '../lib/format';
import { PHOTO_TYPES } from '../lib/image';
import { compareName, matchesQuery, nameParts } from '../lib/people';
import type { Role } from '../data/types';

export function UserModal() {
  const s = useStore();
  const [playerQuery, setPlayerQuery] = useState('');
  const [photoErr, setPhotoErr] = useState('');
  const m = s.userModal;
  if (!m) return null;
  const preview = (initials(`${m.first} ${m.last}`.trim()) || '?').toUpperCase();
  const isVerein = s.settings.appMode === 'verein';
  const accountPhoto = s.accounts.find((x) => x.id === m.id)?.photo;
  const canPhoto = isVerein && m.mode === 'edit' && !!m.id && !m.isBoard; // PB-Upload braucht bestehenden Datensatz
  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''; setPhotoErr('');
    if (!f || !m.id) return;
    if (!PHOTO_TYPES.includes(f.type)) { setPhotoErr('Nur PNG, JPG oder WebP.'); return; }
    void s.uploadPhoto('account', m.id, f);
  };
  // Im echten Vereinsmodus braucht ein neues Konto ein Anmeldepasswort (PocketBase-Auth).
  const needsPw = s.pbMode && m.mode === 'add';
  const canSave = `${m.first}${m.last}`.trim().length > 0 && m.email.trim().length > 0 && (!needsPw || m.password.trim().length >= 8);
  const players = s.players;
  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' };

  // Spieler-Verknüpfung: aktuelle Auswahl separat, Suche + bereits anderweitig verknüpfte ausblenden (kein Doppel-Link).
  const order = s.settings.nameOrder ?? 'first';
  const selectedPlayer = m.playerId ? players.find((p) => p.id === m.playerId) || null : null;
  const linkedElsewhere = new Set(s.accounts.filter((acc) => acc.id !== m.id && acc.playerId).map((acc) => acc.playerId as string));
  const linkable = players
    .filter((p) => p.id !== m.playerId && !linkedElsewhere.has(p.id) && matchesQuery(playerQuery, p.name, p.short))
    .sort((x, y) => compareName(nameParts(x.name), nameParts(y.name), order));
  const hiddenLinkedCount = players.filter((p) => p.id !== m.playerId && linkedElsewhere.has(p.id)).length;

  return (
    <Modal onClose={() => s.closeUserModal()} width={540} z={63} style={{ maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ModalTitle>{m.mode === 'edit' ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}</ModalTitle>

      {/* Scrollbarer Formularbereich – der Speichern-Fuß bleibt fix. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', margin: '0 -4px', padding: '2px 4px' }}>

      {m.isBoard && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)', borderRadius: 11, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--text-2)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', background: 'var(--btn)', border: '1px solid var(--border-2)', padding: '2px 8px', borderRadius: 6 }}>BOARD {m.boardNumber}</span>
          Board-Rechner-Konto · wird nicht mit einem Spieler verknüpft.
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <Avatar photo={accountPhoto} short={preview} avi={m.avi} size={58} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="dh-btn" onClick={() => s.cycleUserAvi(-1)} style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>‹</button>
            <button className="dh-btn" onClick={() => s.cycleUserAvi(1)} style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>›</button>
            <span style={{ fontSize: 12, color: 'var(--text-4)' }}>Farbe</span>
          </div>
          {canPhoto ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <label className="dh-btn" style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {accountPhoto ? 'Foto ändern' : 'Foto wählen'}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onPhoto} style={{ display: 'none' }} />
              </label>
              {accountPhoto && <button onClick={() => m.id && s.clearPhoto('account', m.id)} style={{ background: 'transparent', border: '1px solid var(--border-2)', color: 'var(--text-3)', padding: '7px 11px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Entfernen</button>}
            </div>
          ) : isVerein && m.mode === 'add' && !m.isBoard ? (
            <span style={{ fontSize: 11, color: 'var(--text-5)' }}>Foto nach dem Speichern hinzufügen</span>
          ) : null}
          {photoErr && <span style={{ fontSize: 11, color: '#E0594B', fontWeight: 600 }}>{photoErr}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <FieldLabel>Vorname</FieldLabel>
          <input className="dh-input" value={m.first} onChange={(e) => s.setUserField('first', e.target.value)} placeholder="z. B. Markus" style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <FieldLabel>Nachname</FieldLabel>
          <input className="dh-input" value={m.last} onChange={(e) => s.setUserField('last', e.target.value)} placeholder="z. B. Krüger" style={inputStyle} />
        </div>
      </div>

      <FieldLabel>E-Mail</FieldLabel>
      <input className="dh-input" type="email" value={m.email} onChange={(e) => s.setUserField('email', e.target.value)} placeholder="name@verein.de" style={{ ...inputStyle, marginBottom: 18 }} />

      {s.pbMode && (
        <>
          <FieldLabel note={m.mode === 'edit' ? '(leer = unverändert)' : '(min. 8 Zeichen)'}>Anmeldepasswort</FieldLabel>
          <input className="dh-input" type="password" value={m.password} onChange={(e) => s.setUserField('password', e.target.value)} placeholder={m.mode === 'edit' ? '••••••••' : 'Passwort für den Login vergeben'} autoComplete="new-password" style={{ ...inputStyle, marginBottom: 18 }} />
        </>
      )}

      <FieldLabel note="(optional)">Position im Verein</FieldLabel>
      <input className="dh-input" value={m.position} onChange={(e) => s.setUserField('position', e.target.value)} placeholder="z. B. 1. Vorsitzender, Kassenwart, Trainer" style={{ ...inputStyle, marginBottom: 18 }} />

      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, marginBottom: 8 }}>Rolle &amp; Rechte</label>
      {m.isBoard ? (
        // Board-Rechner-Konten haben fest die Rolle 'board' — nicht änderbar.
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: ROLES.board.bg, border: `1px solid ${ROLES.board.bd}`, borderRadius: 11, padding: '11px 13px', marginBottom: 20 }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${ROLES.board.color}`, background: ROLES.board.color, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: ROLES.board.color }}>{ROLES.board.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{ROLES.board.desc} · fest, nicht änderbar</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {ROLE_ORDER.map((role) => {
            const r = ROLES[role]; const on = m.role === role;
            return (
              <button key={role} onClick={() => s.setUserField('role', role as Role)} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', background: on ? r.bg : 'var(--btn)', border: `1px solid ${on ? r.bd : 'var(--border-2)'}`, borderRadius: 11, padding: '11px 13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${on ? r.color : 'var(--border-strong)'}`, background: on ? r.color : 'transparent', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: r.color }}>{r.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{r.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!m.isBoard && (
        <>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, marginBottom: 10 }}>Mit Spieler verknüpfen <span style={{ color: 'var(--text-5)', fontWeight: 500 }}>(optional)</span></label>
          {players.length === 0 && <div style={{ background: 'var(--btn)', border: '1px dashed var(--border-strong)', borderRadius: 12, padding: 18, textAlign: 'center', color: 'var(--text-4)', fontSize: 13, marginBottom: 20 }}>Noch keine Spieler in der Liste.</div>}

          {players.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              {/* Aktuelle Auswahl – klar sichtbar, mit „Entfernen". */}
              {selectedPlayer && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)', borderRadius: 11, padding: '9px 11px', marginBottom: 10 }}>
                  <Avatar photo={selectedPlayer.photo} short={selectedPlayer.short} avi={selectedPlayer.avi} size={28} circle />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedPlayer.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>verknüpft</div>
                  </div>
                  <button onClick={() => s.setUserField('playerId', null)} className="dh-btn" style={{ flexShrink: 0, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-3)', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Entfernen</button>
                </div>
              )}

              <SearchInput value={playerQuery} onChange={setPlayerQuery} placeholder="Spieler suchen …" width="100%" />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10, maxHeight: 240, overflowY: 'auto' }}>
                {linkable.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--text-4)', padding: '10px 4px' }}>{playerQuery ? `Kein Spieler passt zu „${playerQuery}".` : 'Keine weiteren Spieler zum Verknüpfen.'}</div>
                )}
                {linkable.map((p) => (
                  <button key={p.id} onClick={() => { s.setUserField('playerId', p.id); setPlayerQuery(''); }} className="dh-hover-border" style={{ display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '8px 11px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Avatar photo={p.photo} short={p.short} avi={p.avi} size={28} circle />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                  </button>
                ))}
              </div>

              {hiddenLinkedCount > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-5)', marginTop: 8 }}>{hiddenLinkedCount} {hiddenLinkedCount === 1 ? 'Spieler ist' : 'Spieler sind'} bereits mit einem Konto verknüpft und ausgeblendet.</div>
              )}
            </div>
          )}

          {/* Mannschaftszuordnung – nur sinnvoll für Spieler/Kapitän und wenn ein Spieler verknüpft ist.
              Mehrfachauswahl (Liga + Pokal); die Auswahl ist die vollständige Zugehörigkeit (Abwahl = entfernen). */}
          {selectedPlayer && (m.role === 'player' || m.role === 'captain') && (
            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, marginBottom: 4 }}>
                Mannschaft{m.role === 'captain' ? ' & Kapitänsamt' : ''} <span style={{ color: 'var(--text-5)', fontWeight: 500 }}>(optional)</span>
              </label>
              <div style={{ fontSize: 12, color: 'var(--text-5)', marginBottom: 10 }}>
                {m.role === 'captain'
                  ? `${selectedPlayer.name} wird Mitglied und Kapitän der gewählten Mannschaft(en).`
                  : `${selectedPlayer.name} wird Mitglied der gewählten Mannschaft(en).`}
              </div>
              {s.teams.length === 0 ? (
                <div style={{ background: 'var(--btn)', border: '1px dashed var(--border-strong)', borderRadius: 12, padding: 16, textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>Noch keine Mannschaften angelegt.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 220, overflowY: 'auto' }}>
                  {s.teams.map((t) => {
                    const on = m.teamIds.includes(t.id);
                    const cup = t.kind === 'cup';
                    return (
                      <button key={t.id} onClick={() => s.toggleUserTeam(t.id)} className="dh-hover-border" style={{ display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', background: on ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--btn)', border: `1px solid ${on ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--border-2)'}`, borderRadius: 10, padding: '9px 11px', cursor: 'pointer', fontFamily: 'inherit' }}>
                        <span style={{ width: 18, height: 18, borderRadius: 6, border: `2px solid ${on ? 'var(--accent)' : 'var(--border-strong)'}`, background: on ? 'var(--accent)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                          {t.league && <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{t.league}</div>}
                        </div>
                        {cup && <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, color: 'var(--text-4)', background: 'var(--btn)', border: '1px solid var(--border-2)', padding: '2px 7px', borderRadius: 6 }}>POKAL</span>}
                        {on && m.role === 'captain' && <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)', padding: '2px 7px', borderRadius: 6 }}>KAPITÄN</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 16px', background: 'var(--btn)', borderRadius: 12, marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{m.active ? 'Konto aktiv' : 'Konto inaktiv'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>Deaktivierte Konten können sich nicht anmelden.</div>
        </div>
        <button onClick={() => s.setUserField('active', !m.active)} style={{ position: 'relative', width: 44, height: 24, borderRadius: 999, background: m.active ? 'var(--accent)' : 'var(--border-2)', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0 }}>
          <span style={{ position: 'absolute', top: 2, left: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'transform .15s', transform: m.active ? 'translateX(20px)' : 'translateX(0)' }} />
        </button>
      </div>
      </div>

      {/* Fester Fuß mit Speichern – immer sichtbar, auch bei langer Spielerliste. */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
        <ModalFooter
          onDelete={m.mode === 'edit' ? () => s.deleteUser(m.id!) : undefined}
          onCancel={() => s.closeUserModal()}
          onSave={() => s.saveUserModal()}
          saveDisabled={!canSave}
        />
      </div>
    </Modal>
  );
}
