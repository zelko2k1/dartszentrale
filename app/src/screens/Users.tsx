import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { ROLES, ROLE_ORDER } from '../data/constants';
import { IconPlus, IconEdit, IconBack } from '../lib/icons';
import { Avatar } from '../components/Avatar';
import { SearchInput } from '../components/SearchInput';
import { compareName, matchesQuery } from '../lib/people';
import { useT } from '../i18n';

export function Users() {
  const s = useStore();
  const tr = useT();
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
    const cnt = window.prompt(tr.users.boardPromptCount, String(Math.max(existingBoards, 8)));
    if (cnt == null) return;
    const n = parseInt(cnt, 10);
    if (!n || n < 1) { window.alert(tr.users.alertNumber); return; }
    const pw = window.prompt(tr.users.boardPromptPw, '');
    if (pw == null) return;
    if (pw.trim().length < 8) { window.alert(tr.users.alertPwLen); return; }
    s.createBoardAccounts(n, pw.trim());
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 22 }}>
        <div>
          <button onClick={() => s.go('settings')} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 'var(--fs-sub)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 10 }}>
            <IconBack size={15} />
            {tr.nav.settings}
          </button>
          <h1 style={{ margin: 0, fontSize: 'var(--fs-page)', fontWeight: 800, letterSpacing: '-.02em' }}>{tr.dashboard.usersRights}</h1>
          <p style={{ margin: '6px 0 0', fontSize: 'var(--fs-body)', color: 'var(--text-3)', maxWidth: 560 }}>{tr.users.subtitle}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0 }}>
          <SearchInput value={query} onChange={setQuery} placeholder={tr.users.search} width={220} />
          <button className="dh-btn" onClick={createBoards} title={tr.users.boardAccountsTitle} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '11px 16px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            {tr.users.boardAccounts}
          </button>
          <button className="dh-primary" onClick={() => s.openAddUser()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: '11px 18px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-body)', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            <IconPlus size={17} />
            {tr.users.addUser}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
        {[
          { v: total, label: tr.users.totalAccounts, color: 'var(--text)' },
          { v: active, label: tr.users.activeCount, color: 'var(--success)' },
          { v: linked, label: tr.users.linkedWithPlayer, color: 'var(--info)' },
        ].map((t) => (
          <div key={t.label} style={{ flex: 1, minWidth: 140, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 18px' }}>
            <div style={{ fontFamily: 'var(--font-num)', fontSize: 'var(--fs-heading)', fontWeight: 800, color: t.color }}>{t.v}</div>
            <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-4)', fontWeight: 600, marginTop: 2 }}>{t.label}</div>
          </div>
        ))}
      </div>

      <div role="table" aria-label={tr.dashboard.usersRights} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflowX: 'auto', overflowY: 'hidden', minWidth: 0 }}>
        <div role="row" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.1fr 64px 92px 56px', gap: 10, padding: '13px 20px', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-badge)', color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', minWidth: 584 }}>
          <span role="columnheader">{tr.users.thUser}</span><span role="columnheader">{tr.users.thRole}</span><span role="columnheader">{tr.users.thPlayerProfile}</span><span role="columnheader" style={{ textAlign: 'center' }}>2FA</span><span role="columnheader" style={{ textAlign: 'center' }}>{tr.users.thStatus}</span><span role="columnheader" />
        </div>
        {visible.length === 0 && (
          <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-4)', fontSize: 'var(--fs-body)' }}>
            {accounts.length === 0 ? tr.users.emptyAccounts : tr.users.noMatch(query)}
          </div>
        )}
        {visible.map((u) => {
          const r = ROLES[u.role];
          const pn = playerName(u.playerId);
          const me = u.id === s.session;
          return (
            <div key={u.id} role="row" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.1fr 64px 92px 56px', gap: 10, alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--hairline)', opacity: u.active ? 1 : 0.55, minWidth: 584 }}>
              <div role="cell" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <Avatar photo={u.photo} short={(u.first[0] || '') + (u.last[0] || '')} avi={u.avi} size={38} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</span>
                    {u.isBoard && <span style={{ fontSize: 'var(--fs-badge)', fontWeight: 800, color: 'var(--accent-ink)', background: 'color-mix(in srgb, var(--accent) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)', padding: '2px 5px', borderRadius: 'var(--radius-xs)', letterSpacing: '.04em', flexShrink: 0 }}>BOARD {u.boardNumber}</span>}
                    {me && <span style={{ fontSize: 'var(--fs-badge)', fontWeight: 800, color: 'var(--text-3)', background: 'var(--btn)', border: '1px solid var(--border-2)', padding: '2px 5px', borderRadius: 'var(--radius-xs)', letterSpacing: '.04em', flexShrink: 0 }}>{tr.users.meBadge}</span>}
                  </div>
                  <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                </div>
              </div>
              <div role="cell">
                <span style={{ display: 'inline-block', fontSize: 'var(--fs-badge)', fontWeight: 800, color: r.color, background: r.bg, border: `1px solid ${r.bd}`, padding: '4px 10px', borderRadius: 'var(--radius-xs)' }}>{r.label}</span>
                {u.position && <div style={{ fontSize: 'var(--fs-badge)', color: 'var(--text-4)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.position}</div>}
              </div>
              <div role="cell" style={{ fontSize: 'var(--fs-meta)', color: pn ? 'var(--text-2)' : 'var(--text-5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pn ? `↔ ${pn}` : tr.users.noPlayerProfile}</div>
              <div role="cell" style={{ display: 'flex', justifyContent: 'center' }}>
                {u.isBoard
                  ? <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-5)' }}>–</span>
                  : s.twoFAUserIds.includes(u.id)
                    ? <span title={tr.users.twoFAActive} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-badge)', fontWeight: 800, color: 'var(--success)' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)' }} />2FA</span>
                    : <span title={tr.users.twoFANotSet} style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-5)' }}>–</span>}
              </div>
              <div role="cell" style={{ display: 'flex', justifyContent: 'center' }}>
                <button onClick={() => s.toggleUserActive(u.id)} title={tr.users.toggleActive} aria-label={tr.users.toggleActive} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: u.active ? 'var(--success)' : 'var(--text-5)' }} />
                  <span style={{ fontSize: 'var(--fs-meta)', fontWeight: 600, color: u.active ? 'var(--success)' : 'var(--text-4)' }}>{u.active ? tr.users.active : tr.users.inactive}</span>
                </button>
              </div>
              <div role="cell" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="dh-btn" onClick={() => s.openEditUser(u.id)} title={tr.common.edit} aria-label={tr.common.edit} style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
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
            <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-meta)', color: 'var(--text-3)' }}>
              <span style={{ width: 9, height: 9, borderRadius: 'var(--radius-xs)', background: r.color }} />
              <span style={{ fontWeight: 700 }}>{r.label}</span>
              <span style={{ color: 'var(--text-5)' }}>· {count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
