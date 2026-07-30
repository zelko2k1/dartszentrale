import type { CSSProperties, ReactNode } from 'react';
import { ROLES } from '../data/constants';
import type { Role } from '../data/types';

// Avatar lebt jetzt in components/Avatar.tsx (mit Profilfoto + Fallback).

// ── Rollen-Badge ──
export function RoleBadge({ role, style }: { role: Role; style?: CSSProperties }) {
  const r = ROLES[role];
  return (
    <span style={{
      display: 'inline-block', fontSize: 'var(--fs-badge)', fontWeight: 800, padding: '4px 10px',
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
      border: 'none', padding: '11px 18px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-body)', fontWeight: 800,
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
      fontSize: 'var(--fs-sub)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', ...style,
    }}>{children}</button>
  );
}

// ── Karte ──
// Bewusst OHNE onClick: die Prop war nirgends benutzt und hätte ein klickbares <div> ohne
// Tastaturzugang erzeugt. Für anklickbare Karten/Zeilen gibt es PressableRow.
export function Card({ children, style, hover = false }: {
  children: ReactNode; style?: CSSProperties; hover?: boolean;
}) {
  return (
    <div className={hover ? 'dh-hover-border' : undefined} style={{
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
        <span style={{ fontSize: 'var(--fs-meta)', fontWeight: 600, color: 'var(--text-4)' }}>{label}</span>
        {icon && <span style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-lead)' }}>{icon}</span>}
      </div>
      <div style={{ fontFamily: 'var(--font-num)', fontSize: 'var(--fs-stat)', fontWeight: 800, lineHeight: 1, color: valueColor }}>{value}</div>
      {sub && <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-4)', marginTop: 10 }}>{sub}</div>}
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
      {title && <div style={{ fontSize: compact ? 'var(--fs-body)' : 'var(--fs-lead)', fontWeight: 700, color: 'var(--text-2)' }}>{title}</div>}
      {children && <div style={{ fontSize: 'var(--fs-sub)', color: 'var(--text-4)', lineHeight: 1.5, maxWidth: 340 }}>{children}</div>}
      {action && <div style={{ marginTop: 2 }}>{action}</div>}
    </div>
  );
}

// ── Sektionsüberschrift ──
// Die App hatte 18× <h1> und sonst NICHTS: jede Sektionsüberschrift war ein gestyltes <div>,
// womit Screenreader keine Gliederung zum Anspringen hatten (WCAG 1.3.1). Dieses Primitive
// rendert dieselbe Optik als echtes <h2>/<h3>. `level` wählt die Ebene: 2 direkt unter dem
// Seitentitel (<h1> aus PageHeader), 3 für Blöcke INNERHALB einer Sektion oder Karte.
// Die beiden Ebenen unterscheiden sich auch optisch — vorher war derselbe Rang mal 12px/--text-3,
// mal 11px/--text-4 ausgezeichnet, ohne dass die Abweichung etwas bedeutete. Jetzt heißt Ebene 3:
// eine Stufe leiser, weil sie INNERHALB einer Sektion steht.
const HEADING_LEVEL: Record<2 | 3, CSSProperties> = {
  2: { fontSize: 'var(--fs-meta)', color: 'var(--text-3)', letterSpacing: '.08em' },
  3: { fontSize: 'var(--fs-badge)', color: 'var(--text-4)', letterSpacing: '.06em' },
};

export function SectionHeading({ children, level = 2, style, id }: {
  children: ReactNode; level?: 2 | 3; style?: CSSProperties; id?: string;
}) {
  const Tag = level === 2 ? 'h2' : 'h3';
  return (
    <Tag id={id} style={{
      margin: 0, fontWeight: 700, textTransform: 'uppercase',
      ...HEADING_LEVEL[level], ...style,
    }}>{children}</Tag>
  );
}

// ── Seitenkopf (Titel + Aktion rechts) ──
export function PageHeader({ title, sub, action, style }: {
  title: string; sub?: ReactNode; action?: ReactNode; style?: CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, ...style }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-page)', fontWeight: 800, letterSpacing: '-.02em' }}>{title}</h1>
        {sub && <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', marginTop: 6, maxWidth: 560 }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}
