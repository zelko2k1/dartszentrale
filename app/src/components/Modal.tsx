import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { useT } from '../i18n';

// Basis-Dialog: role="dialog"/aria-modal, Esc schließt, Fokus-Trap + Initial-Fokus, Fokus-Restore beim Schließen.
// Ein Fix hier härtet ALLE Dialoge, die <Modal> nutzen (a11y, WCAG 2.4.3/4.1.2). `label` setzt den zugänglichen Namen.
export function Modal({ children, onClose, width = 440, z = 60, style, label }: {
  children: ReactNode; onClose?: () => void; width?: number; z?: number; style?: CSSProperties; label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const prev = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(
      el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    ).filter((n) => !n.hasAttribute('disabled') && n.offsetParent !== null);
    (focusables()[0] ?? el).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose?.(); return; }
      if (e.key !== 'Tab') return;
      const f = focusables(); if (!f.length) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    el.addEventListener('keydown', onKey);
    return () => { el.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, background: 'var(--scrim)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: z, padding: 24, overflow: 'auto',
      }}
    >
      <div ref={ref} className="dh-pop" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} style={{
        background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-xl)', padding: 28,
        width, maxWidth: '92vw', boxShadow: 'var(--shadow-card)', outline: 'none', ...style,
      }}>{children}</div>
    </div>
  );
}

export function ModalTitle({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, marginBottom: 22 }}>{children}</div>;
}

// htmlFor koppelt das Label programmatisch an sein Feld (Screenreader-Name). Caller setzt dieselbe id am Input.
export function FieldLabel({ children, note, htmlFor }: { children: ReactNode; note?: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 'var(--fs-xs)', color: 'var(--text-3)', fontWeight: 700, marginBottom: 6 }}>
      {children}{note && <span style={{ color: 'var(--text-5)', fontWeight: 500 }}> {note}</span>}
    </label>
  );
}

export function ModalFooter({ onDelete, onCancel, onSave, saveDisabled, saveLabel, saving }: {
  onDelete?: () => void; onCancel?: () => void; onSave?: () => void; saveDisabled?: boolean; saveLabel?: string; saving?: boolean;
}) {
  const tr = useT();
  const disabled = saveDisabled || saving;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
      {onDelete && (
        <button className="dh-btn" onClick={onDelete} style={{
          background: 'color-mix(in srgb, var(--danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)', color: 'var(--danger)',
          padding: '12px 16px', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}>{tr.common.delete}</button>
      )}
      <div style={{ flex: 1 }} />
      <button className="dh-btn" onClick={onCancel} style={{
        background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)',
        padding: '12px 20px', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
      }}>{tr.common.cancel}</button>
      <button onClick={disabled ? undefined : onSave} disabled={disabled} style={{
        background: disabled ? 'var(--btn)' : 'var(--accent)', border: 'none',
        color: disabled ? 'var(--text-5)' : 'var(--accent-fg)', padding: '12px 22px', borderRadius: 'var(--radius-md)',
        fontSize: 14, fontWeight: 800, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
      }}>{saving ? '…' : (saveLabel ?? tr.common.save)}</button>
    </div>
  );
}
