import type { ReactNode } from 'react';
import { useStore } from '../store/useStore';
import { perm, currentUser } from '../store/selectors';
import { ROLES } from '../data/constants';
import { Avatar } from '../components/Avatar';
import type { Screen } from '../data/types';
import { useT } from '../i18n';
import {
  Logo, IconDashboard, IconTarget, IconTraining, IconCalendar, IconTrophy, IconShield,
  IconUsers, IconBars, IconUserCheck, IconSettings, IconLogout,
} from '../lib/icons';

const SCREEN_ALIAS: Record<string, Screen> = { playerDetail: 'players', setup: 'counter' };

function NavItem({ icon, label, screen, active, onClick, badge }: {
  icon: ReactNode; label: string; screen: Screen; active: boolean; onClick: () => void; badge?: ReactNode;
}) {
  void screen;
  return (
    <button
      className={`dh-nav${active ? ' dh-nav-active' : ''}`}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 11, border: 'none',
        cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, textAlign: 'left',
        background: active ? 'var(--nav-active)' : 'transparent', color: active ? 'var(--nav-active-fg)' : 'var(--text-3)',
      }}
    >
      {icon}
      {label}
      {badge}
    </button>
  );
}

export function Sidebar() {
  const s = useStore();
  const tr = useT();
  const p = perm(s.settings, s.accounts, s.session);
  const isVerein = s.settings.appMode === 'verein';
  const active = SCREEN_ALIAS[s.screen] || s.screen;
  const cu = currentUser(s.accounts, s.session);
  const gameActive = s.allThrows.length > 0;

  return (
    <aside style={{ width: 248, flexShrink: 0, background: 'var(--sidebar)', borderRight: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 18px' }}>
        {isVerein && s.settings.clubLogo
          ? <img src={s.settings.clubLogo} alt={tr.sidebar.clubLogoAlt} style={{ width: 38, height: 38, borderRadius: 9, objectFit: 'contain', flexShrink: 0 }} />
          : <Logo size={38} />}
        <div>
          <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-.01em' }}>DartsZentrale</div>
          {isVerein && <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600 }}>{s.settings.clubName}</div>}
        </div>
      </div>

      {/* Saison-Umschalter (Soft-Archiv): zeigt die betrachtete Saison; ≠ aktive → Lesemodus. */}
      {isVerein && s.seasons.length > 0 && (
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{ position: 'relative' }}>
            <select
              value={s.viewSeasonId ?? ''}
              onChange={(e) => s.setViewSeason(e.target.value)}
              title={tr.sidebar.chooseSeason}
              style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', background: 'var(--surface-2)', border: `1px solid ${s.viewSeasonId !== s.activeSeasonId ? 'rgba(242,184,41,.5)' : 'var(--border-2)'}`, borderRadius: 10, padding: '8px 28px 8px 11px', color: 'var(--text)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
            >
              {[...s.seasons]
                .sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) || b.name.localeCompare(a.name))
                .map((se) => (
                  <option key={se.id} value={se.id}>{tr.common.season} {se.name}{se.status === 'active' ? '' : ` · ${tr.common.archive}`}</option>
                ))}
            </select>
            <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-4)', fontSize: 10 }}>▼</span>
          </div>
          {s.viewSeasonId !== s.activeSeasonId && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#F2B829', fontWeight: 700 }}>{tr.sidebar.archivedReadOnly}</div>
          )}
        </div>
      )}

      <nav style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <NavItem icon={<IconDashboard />} label={tr.nav.dashboard} screen="dashboard" active={active === 'dashboard'} onClick={() => s.go('dashboard')} />
        {p.play && (
          <>
            <NavItem
              icon={<IconTarget />} label={tr.nav.counter} screen="counter" active={active === 'counter'} onClick={() => gameActive ? s.go('counter') : s.goSetup()}
              badge={gameActive ? <span style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: '#E04B43', boxShadow: '0 0 8px #E04B43' }} /> : undefined}
            />
            <NavItem icon={<IconTraining />} label={tr.nav.training} screen="training" active={active === 'training'} onClick={() => s.go('training')} />
          </>
        )}
        <NavItem icon={<IconCalendar />} label={tr.nav.calendar} screen="calendar" active={active === 'calendar'} onClick={() => s.go('calendar')} />
        {isVerein && (
          <>
            <NavItem icon={<IconTrophy />} label={tr.nav.leagues} screen="leagues" active={active === 'leagues'} onClick={() => s.go('leagues')} />
            <NavItem icon={<IconShield />} label={tr.nav.teams} screen="teams" active={active === 'teams'} onClick={() => s.go('teams')} />
          </>
        )}
        <NavItem icon={<IconUsers />} label={tr.nav.players} screen="players" active={active === 'players'} onClick={() => s.go('players')} />
        <NavItem icon={<IconBars />} label={tr.nav.stats} screen="stats" active={active === 'stats'} onClick={() => s.go('stats')} />
        {isVerein && p.manageUsers && <NavItem icon={<IconUserCheck />} label={tr.nav.users} screen="users" active={active === 'users'} onClick={() => s.go('users')} />}
        <NavItem icon={<IconSettings />} label={tr.nav.settings} screen="settings" active={active === 'settings'} onClick={() => s.go('settings')} />
      </nav>

      {isVerein && cu && (
        <div style={{ padding: 12, borderTop: '1px solid var(--hairline)' }}>
          <div title={tr.sidebar.loggedInAccount} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 11, background: 'var(--surface-2)' }}>
            <Avatar photo={cu.photo} short={(cu.first[0] || '') + (cu.last[0] || '')} avi={cu.avi} size={34} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cu.name}</div>
              <div style={{ fontSize: 11, color: ROLES[cu.role].color, fontWeight: 600 }}>{ROLES[cu.role].label}</div>
            </div>
            <button className="dh-btn-ghost" onClick={() => s.logout()} title={tr.sidebar.logout} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0, color: 'var(--text-4)' }}>
              <IconLogout size={16} sw={2} />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
