import type { CSSProperties, ReactNode } from 'react';
import { ROLES } from '../data/constants';
import type { Role } from '../data/types';

// Avatar lebt jetzt in components/Avatar.tsx (mit Profilfoto + Fallback).

// ── Rollen-Badge ──
export function RoleBadge({ role, style }: { role: Role; style?: CSSProperties }) {
  const r = ROLES[role];
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '4px 10px',
      borderRadius: 'var(--radius-xs)', color: r.color, background: r.bg, border: `1px solid ${r.bd}`,
      whiteSpace: 'nowrap', ...style,
    }}>{r.label}</span>
  );
}

// ── Primärbutton (Akzent-Grün) ──
export function PrimaryButton({ children, onClick, style, disabled, title }: {
  children: ReactNode; onClick?: () => void; style?: CSSProperties; disabled?: boolean; title?: string;
}) {
  return (
    <button className="dh-primary" onClick={onClick} disabled={disabled} title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: disabled ? 'var(--btn)' : 'var(--accent)', color: disabled ? 'var(--text-5)' : 'var(--accent-fg)',
      border: 'none', padding: '11px 18px', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 800,
      cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', ...style,
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
      color: 'var(--text-2)', border: '1px solid var(--border-2)', padding: '9px 14px', borderRadius: 'var(--radius-md)',
      fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', ...style,
    }}>{children}</button>
  );
}

// ── Karte ──
export function Card({ children, style, hover = false, onClick }: {
  children: ReactNode; style?: CSSProperties; hover?: boolean; onClick?: () => void;
}) {
  return (
    <div className={hover ? 'dh-hover-border' : undefined} onClick={onClick} style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', ...style,
    }}>{children}</div>
  );
}

// ── Statistik-Kachel (Dashboard) ──
export function StatTile({ label, value, sub, icon, iconBg = 'var(--btn)', valueColor = 'var(--text)' }: {
  label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; iconBg?: string; valueColor?: string;
}) {
  return (
    <div className="dh-hover-border" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-4)' }}>{label}</span>
        {icon && <span style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{icon}</span>}
      </div>
      <div style={{ fontFamily: 'var(--font-num)', fontSize: 30, fontWeight: 800, lineHeight: 1, color: valueColor }}>{value}</div>
      {sub && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-4)', marginTop: 10 }}>{sub}</div>}
    </div>
  );
}

// ── Leerzustand ──
// Icon-Kreis + optionaler Titel + Beschreibung + optionale Aktion. `compact` für Widget-Leeren (kleiner,
// randlos, da die Karte/Sektion schon den Rahmen + Überschrift stellt); Standard für Content-Flächen.
export function EmptyState({ icon, title, children, action, compact, style }: {
  icon?: ReactNode; title?: ReactNode; children?: ReactNode; action?: ReactNode; compact?: boolean; style?: CSSProperties;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      gap: compact ? 8 : 12, padding: compact ? '20px 16px' : '36px 24px', ...style,
    }}>
      {icon && (
        <div style={{ width: compact ? 34 : 46, height: compact ? 34 : 46, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text-4)', flexShrink: 0 }}>{icon}</div>
      )}
      {title && <div style={{ fontSize: compact ? 'var(--fs-base)' : 'var(--fs-md)', fontWeight: 700, color: 'var(--text-2)' }}>{title}</div>}
      {children && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-4)', lineHeight: 1.5, maxWidth: 340 }}>{children}</div>}
      {action && <div style={{ marginTop: 2 }}>{action}</div>}
    </div>
  );
}

// ── Seitenkopf (Titel + Aktion rechts) ──
export function PageHeader({ title, sub, action, style }: {
  title: string; sub?: ReactNode; action?: ReactNode; style?: CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, ...style }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 800, letterSpacing: '-.02em' }}>{title}</h1>
        {sub && <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-3)', marginTop: 6, maxWidth: 560 }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}
