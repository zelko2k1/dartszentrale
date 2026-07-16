import { useState } from 'react';
import { useStore } from '../store/useStore';
import { EVENT_TYPES, EVENT_TYPE_ALL } from '../data/constants';
import { perm, inSeason } from '../store/selectors';
import { IconChevronLeft, IconChevronRight, IconPlus } from '../lib/icons';
import { useT } from '../i18n';

const pad2 = (n: number) => (n < 10 ? '0' + n : '' + n);
// Kalenderwochen beginnen montags → Reihenfolge Mo…So aus dem So-basierten wdShort ableiten.
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

export function Calendar() {
  const s = useStore();
  const tr = useT();
  const MON = tr.format.monLong;
  const accent = s.settings.accent;
  const p = perm(s.settings, s.accounts, s.session);
  const readOnly = s.viewSeasonId != null && s.viewSeasonId !== s.activeSeasonId;
  const canManageEvents = p.manageEvents && !readOnly;
  const scope = s.settings.appMode === 'local' ? 'local' : 'verein';
  // Termine der betrachteten Saison (Soft-Archiv): Liga-/Pokal- und übrige Termine pro Saison getrennt.
  const events = inSeason(s.events, s.viewSeasonId);
  const now = new Date();
  const [ref, setRef] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const todayIso = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());

  const byDate: Record<string, typeof s.events> = {};
  events.filter((e) => e.scope === scope).forEach((e) => { (byDate[e.date] = byDate[e.date] || []).push(e); });

  const first = new Date(ref.y, ref.m, 1);
  const startDow = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(ref.y, ref.m, 1 - startDow + i);
    const iso = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    const evs = (byDate[iso] || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const inMonth = d.getMonth() === ref.m;
    const isToday = iso === todayIso;
    cells.push({
      day: String(d.getDate()), iso, inMonth, outMonth: !inMonth, isToday,
      dayColor: isToday ? '#06160d' : inMonth ? 'var(--text-2)' : 'var(--text-5)',
      dayBg: isToday ? accent : 'transparent',
      cellBg: isToday ? `color-mix(in srgb, ${accent} 8%, transparent)` : (inMonth ? 'transparent' : 'var(--surface-2)'),
      chips: evs.slice(0, 3).map((e) => { const t = EVENT_TYPES[e.type] || { label: e.type, color: 'var(--text-3)', icon: '' }; return { id: e.id, title: e.title, color: t.color, icon: t.icon, bg: `color-mix(in srgb, ${t.color} 16%, transparent)` }; }),
      more: evs.length > 3 ? evs.length - 3 : 0,
    });
  }
  const weeks = [];
  for (let w = 0; w < 6; w++) weeks.push(cells.slice(w * 7, w * 7 + 7));
  while (weeks.length > 4 && weeks[weeks.length - 1].every((c) => c.outMonth && c.chips.length === 0)) weeks.pop();

  const monthEvents = events.filter((e) => e.scope === scope && e.date.slice(0, 7) === `${ref.y}-${pad2(ref.m + 1)}`).length;
  const shift = (dir: number) => setRef((r) => { const d = new Date(r.y, r.m + dir, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 22, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>{tr.calendar.title}</div>
          <h1 style={{ margin: 0, fontSize: 27, fontWeight: 800, letterSpacing: '-.02em' }}>{MON[ref.m]} {ref.y}</h1>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>{tr.calendar.eventsThisMonth(monthEvents)}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="dh-hover-border" onClick={() => shift(-1)} title={tr.calendar.prevMonth} style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><IconChevronLeft size={18} /></button>
          <button className="dh-hover-border" onClick={() => setRef({ y: now.getFullYear(), m: now.getMonth() })} style={{ background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-2)', padding: '0 16px', height: 38, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{tr.common.today}</button>
          <button className="dh-hover-border" onClick={() => shift(1)} title={tr.calendar.nextMonth} style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><IconChevronRight size={18} /></button>
          {canManageEvents && (
            <button className="dh-primary" onClick={() => s.openAddEvent()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', height: 38, padding: '0 16px', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', marginLeft: 6 }}><IconPlus size={16} />{tr.calendar.addEvent}</button>
          )}
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflowX: 'auto', overflowY: 'hidden', minWidth: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(64px,1fr))', borderBottom: '1px solid var(--border)', minWidth: 462 }}>
          {MON_FIRST.map((i) => tr.format.wdShort[i]).map((wd) => (
            <div key={wd} style={{ padding: '11px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-4)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{wd}</div>
          ))}
        </div>
        {weeks.map((wk, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(64px,1fr))', borderBottom: '1px solid var(--hairline)', minWidth: 462 }}>
            {wk.map((c) => (
              <div key={c.iso} className="dh-row" onClick={() => canManageEvents && s.openAddEvent(c.iso)} style={{ minHeight: 112, padding: '7px 7px 9px', borderRight: '1px solid var(--hairline)', background: c.cellBg, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', minWidth: 24, height: 24, padding: '0 6px', borderRadius: 7, fontFamily: 'var(--font-num)', fontSize: 13, fontWeight: 800, color: c.dayColor, background: c.dayBg }}>{c.day}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  {c.chips.map((ch) => (
                    <div key={ch.id} onClick={(e) => { e.stopPropagation(); if (canManageEvents) s.openEditEvent(ch.id); }} title={ch.title} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 6px', borderRadius: 6, background: ch.bg, cursor: 'pointer', minWidth: 0 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={ch.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d={ch.icon} /></svg>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.title}</span>
                    </div>
                  ))}
                  {c.more > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', paddingLeft: 6 }}>{tr.calendar.moreCount(c.more)}</span>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 20px', marginTop: 16, padding: '0 2px' }}>
        {EVENT_TYPE_ALL.map((key) => {
          const t = EVENT_TYPES[key];
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: `color-mix(in srgb, ${t.color} 16%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg></span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>{t.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
