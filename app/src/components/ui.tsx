import type { CSSProperties, ReactNode } from 'react';
import { ROLES } from '../data/constants';
import type { Role } from '../data/types';
import { accentFg } from '../store/selectors';

// Avatar lebt jetzt in components/Avatar.tsx (mit Profilfoto + Fallback).

// ── Rollen-Badge ──
export function RoleBadge({ role, style }: { role: Role; style?: CSSProperties }) {
  const r = ROLES[role];
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '4px 10px',
      borderRadius: 7, color: r.color, background: r.bg, border: `1px solid ${r.bd}`,
      whiteSpace: 'nowrap', ...style,
    }}>{r.label}</span>
  );
}

// ── Primärbutton (Akzent-Grün) ──
export function PrimaryButton({ children, onClick, accent = '#19A463', style, disabled, title }: {
  children: ReactNode; onClick?: () => void; accent?: string; style?: CSSProperties; disabled?: boolean; title?: string;
}) {
  return (
    <button className="dh-primary" onClick={onClick} disabled={disabled} title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, background: disabled ? 'var(--btn)' : accent,
      color: disabled ? 'var(--text-5)' : accentFg(accent), border: 'none', padding: '11px 18px',
      borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
      fontFamily: 'inherit', boxShadow: disabled ? 'none' : '0 8px 24px color-mix(in srgb, var(--accent) 28%, transparent)',
      whiteSpace: 'nowrap', ...style,
    }}>{children}</button>
  );
}

// ── Sekundärbutton ──
export function SecondaryButton({ children, onClick, style, title, ghost }: {
  children: ReactNode; onClick?: () => void; style?: CSSProperties; title?: string; ghost?: boolean;
}) {
  return (
    <button className={ghost ? 'dh-btn dh-btn-ghost' : 'dh-btn'} onClick={onClick} title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, background: ghost ? 'transparent' : 'var(--btn)',
      color: 'var(--text-2)', border: '1px solid var(--border-2)', padding: '9px 14px', borderRadius: 10,
      fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', ...style,
    }}>{children}</button>
  );
}

// ── Toggle (44×24 Pille) ──
export function Toggle({ on, onClick, accent = '#19A463', size = 'md' }: {
  on: boolean; onClick?: () => void; accent?: string; size?: 'md' | 'lg';
}) {
  const w = size === 'lg' ? 46 : 44, h = size === 'lg' ? 26 : 24, knob = size === 'lg' ? 22 : 20;
  return (
    <button onClick={onClick} style={{
      width: w, height: h, borderRadius: 999, background: on ? accent : 'var(--btn)',
      border: `1px solid ${on ? accent : 'var(--border-2)'}`, position: 'relative', cursor: 'pointer',
      transition: 'background .15s ease, border-color .15s ease', flexShrink: 0, padding: 0,
    }}>
      <span style={{
        position: 'absolute', top: 1, left: 1, width: knob, height: knob, borderRadius: '50%',
        background: on ? accentFg(accent) : 'var(--text-4)', transition: 'transform .15s ease',
        transform: on ? `translateX(${w - knob - 2}px)` : 'translateX(0)',
      }} />
    </button>
  );
}

// ── Karte ──
export function Card({ children, style, hover = false, onClick }: {
  children: ReactNode; style?: CSSProperties; hover?: boolean; onClick?: () => void;
}) {
  return (
    <div className={hover ? 'dh-hover-border' : undefined} onClick={onClick} style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, ...style,
    }}>{children}</div>
  );
}

// ── Statistik-Kachel (Dashboard) ──
export function StatTile({ label, value, sub, icon, iconBg = 'var(--btn)', valueColor = 'var(--text)' }: {
  label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; iconBg?: string; valueColor?: string;
}) {
  return (
    <div className="dh-hover-border" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-4)' }}>{label}</span>
        {icon && <span style={{ width: 30, height: 30, borderRadius: 9, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{icon}</span>}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 30, fontWeight: 800, lineHeight: 1, color: valueColor }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 10 }}>{sub}</div>}
    </div>
  );
}

// ── Leerzustand ──
export function EmptyState({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      border: '1px dashed var(--border-2)', borderRadius: 14, padding: '28px 22px', textAlign: 'center',
      color: 'var(--text-4)', fontSize: 13, ...style,
    }}>{children}</div>
  );
}

// ── Seitenkopf (Titel + Aktion rechts) ──
export function PageHeader({ title, sub, action, style }: {
  title: string; sub?: ReactNode; action?: ReactNode; style?: CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, ...style }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 27, fontWeight: 800, letterSpacing: '-.02em' }}>{title}</h1>
        {sub && <div style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 6, maxWidth: 560 }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}
