import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { ROLES, ROLE_ORDER } from '../data/constants';
import { IconPlus, IconEdit, IconBack } from '../lib/icons';
import { Avatar } from '../components/Avatar';
import { SearchInput } from '../components/SearchInput';
import { compareName, matchesQuery } from '../lib/people';

export function Users() {
  const s = useStore();
  const accounts = s.accounts;
  const total = accounts.length;
  const active = accounts.filter((a) => a.active).length;
  const linked = accounts.filter((a) => a.playerId).length;
  const order = s.settings.nameOrder ?? 'first';
  const [query, setQuery] = useState('');
  // 2FA-Status aller Konten laden (nur Admin/Verein; Action guardet selbst). Für die 2FA-Spalte.
  useEffect(() => { useStore.getState().loadTwoFAAdminList(); }, []);

  const playerName = (id: string | null) => { const p = s.players.find((x) => x.id === id); return p ? p.name : null; };

  const visible = useMemo(() => {
    const sorted = [...accounts].sort((a, b) => compareName(a, b, order));
    return sorted.filter((u) => matchesQuery(query, u.name, u.first, u.last, u.email, u.position));
  }, [accounts, order, query]);

  const existingBoards = accounts.filter((a) => a.isBoard).length;
  const createBoards = () => {
    const cnt = window.prompt(`Wie viele Board-Rechner insgesamt? (Board 1…N)\nVorhandene Board-Konten werden nicht doppelt angelegt.`, String(Math.max(existingBoards, 8)));
    if (cnt == null) return;
    const n = parseInt(cnt, 10);
    if (!n || n < 1) { window.alert('Bitte eine Zahl ≥ 1 eingeben.'); return; }
    const pw = window.prompt('Gemeinsames Passwort für alle Board-Konten (min. 8 Zeichen):', '');
    if (pw == null) return;
    if (pw.trim().length < 8) { window.alert('Passwort muss mindestens 8 Zeichen haben.'); return; }
    s.createBoardAccounts(n, pw.trim());
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 22 }}>
        <div>
          <button onClick={() => s.go('settings')} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 10 }}>
            <IconBack size={15} />
            Einstellungen
          </button>
          <h1 style={{ margin: 0, fontSize: 27, fontWeight: 800, letterSpacing: '-.02em' }}>Benutzer &amp; Rechte</h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-3)', maxWidth: 560 }}>Vereinskonten für die Server-Anmeldung. Ein Konto kann mit einem Spieler verknüpft sein — muss es aber nicht.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0 }}>
          <SearchInput value={query} onChange={setQuery} placeholder="Benutzer suchen …" width={220} />
          <button className="dh-btn" onClick={createBoards} title="Board-Rechner-Konten nach Schema anlegen (Board 1…N)" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '11px 16px', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            Board-Konten
          </button>
          <button className="dh-primary" onClick={() => s.openAddUser()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '11px 18px', borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            <IconPlus size={17} />
            Benutzer
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
        {[
          { v: total, label: 'Konten gesamt', color: 'var(--text)' },
          { v: active, label: 'aktiv', color: 'var(--success)' },
          { v: linked, label: 'mit Spieler verknüpft', color: '#3B9EFF' },
        ].map((t) => (
          <div key={t.label} style={{ flex: 1, minWidth: 140, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontFamily: 'var(--font-num)', fontSize: 24, fontWeight: 800, color: t.color }}>{t.v}</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 600, marginTop: 2 }}>{t.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflowX: 'auto', overflowY: 'hidden', minWidth: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.1fr 64px 92px 56px', gap: 10, padding: '13px 20px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', minWidth: 584 }}>
          <span>Benutzer</span><span>Rolle</span><span>Spielerprofil</span><span style={{ textAlign: 'center' }}>2FA</span><span style={{ textAlign: 'center' }}>Status</span><span />
        </div>
        {visible.length === 0 && (
          <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-4)', fontSize: 14 }}>
            {accounts.length === 0 ? 'Noch keine Benutzerkonten.' : `Kein Benutzer passt zu „${query}".`}
          </div>
        )}
        {visible.map((u) => {
          const r = ROLES[u.role];
          const pn = playerName(u.playerId);
          const me = u.id === s.session;
          return (
            <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.1fr 64px 92px 56px', gap: 10, alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--hairline)', opacity: u.active ? 1 : 0.55, minWidth: 584 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <Avatar photo={u.photo} short={(u.first[0] || '') + (u.last[0] || '')} avi={u.avi} size={38} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</span>
                    {u.isBoard && <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)', padding: '2px 5px', borderRadius: 5, letterSpacing: '.04em', flexShrink: 0 }}>BOARD {u.boardNumber}</span>}
                    {me && <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-3)', background: 'var(--btn)', border: '1px solid var(--border-2)', padding: '2px 5px', borderRadius: 5, letterSpacing: '.04em', flexShrink: 0 }}>DU</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                </div>
              </div>
              <div>
                <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, color: r.color, background: r.bg, border: `1px solid ${r.bd}`, padding: '4px 10px', borderRadius: 7 }}>{r.label}</span>
                {u.position && <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.position}</div>}
              </div>
              <div style={{ fontSize: 12, color: pn ? 'var(--text-2)' : 'var(--text-5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pn ? `↔ ${pn}` : 'kein Spielerprofil'}</div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                {u.isBoard
                  ? <span style={{ fontSize: 12, color: 'var(--text-5)' }}>–</span>
                  : s.twoFAUserIds.includes(u.id)
                    ? <span title="2FA aktiv" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: 'var(--success)' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)' }} />2FA</span>
                    : <span title="2FA nicht eingerichtet" style={{ fontSize: 12, color: 'var(--text-5)' }}>–</span>}
              </div>
              <button onClick={() => s.toggleUserActive(u.id)} title="Konto aktivieren / deaktivieren" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: u.active ? '#19A463' : 'var(--text-5)' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: u.active ? 'var(--success)' : 'var(--text-4)' }}>{u.active ? 'Aktiv' : 'Inaktiv'}</span>
              </button>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="dh-btn" onClick={() => s.openEditUser(u.id)} title="Bearbeiten" style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <IconEdit size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 18, padding: '4px 2px' }}>
        {ROLE_ORDER.map((role) => {
          const count = accounts.filter((a) => a.role === role).length;
          const r = ROLES[role];
          return (
            <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-3)' }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: r.color }} />
              <span style={{ fontWeight: 700 }}>{r.label}</span>
              <span style={{ color: 'var(--text-5)' }}>· {count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
