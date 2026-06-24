import type { CSSProperties, ReactNode } from 'react';

export function Modal({ children, onClose, width = 440, z = 60, style }: {
  children: ReactNode; onClose?: () => void; width?: number; z?: number; style?: CSSProperties;
}) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(8,10,12,.78)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: z, padding: 24, overflow: 'auto',
      }}
    >
      <div className="dh-pop" style={{
        background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 20, padding: 28,
        width, maxWidth: '92vw', boxShadow: '0 30px 70px rgba(0,0,0,.55)', ...style,
      }}>{children}</div>
    </div>
  );
}

export function ModalTitle({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 22 }}>{children}</div>;
}

export function FieldLabel({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, marginBottom: 6 }}>
      {children}{note && <span style={{ color: 'var(--text-5)', fontWeight: 500 }}> {note}</span>}
    </label>
  );
}

export function TextInput({ value, onChange, placeholder, maxLength, mono, style, type = 'text', inputMode }: {
  value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number;
  mono?: boolean; style?: CSSProperties; type?: string; inputMode?: 'numeric' | 'text';
}) {
  return (
    <input
      className="dh-input"
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      inputMode={inputMode}
      style={{
        width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)',
        borderRadius: 11, padding: '12px 14px', fontSize: 15, color: 'var(--text)',
        fontFamily: mono ? "'JetBrains Mono',monospace" : 'inherit', textTransform: mono ? 'uppercase' : 'none',
        ...style,
      }}
    />
  );
}

export function ModalFooter({ onDelete, onCancel, onSave, saveDisabled, saveLabel = 'Speichern' }: {
  onDelete?: () => void; onCancel?: () => void; onSave?: () => void; saveDisabled?: boolean; saveLabel?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
      {onDelete && (
        <button className="dh-btn" onClick={onDelete} style={{
          background: 'rgba(224,89,75,.1)', border: '1px solid rgba(224,89,75,.4)', color: '#E0594B',
          padding: '12px 16px', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}>Löschen</button>
      )}
      <div style={{ flex: 1 }} />
      <button className="dh-btn" onClick={onCancel} style={{
        background: 'var(--btn)', border: '1px solid var(--border-2)', color: 'var(--text)',
        padding: '12px 20px', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
      }}>Abbrechen</button>
      <button onClick={saveDisabled ? undefined : onSave} disabled={saveDisabled} style={{
        background: saveDisabled ? 'var(--btn)' : 'var(--accent)', border: 'none',
        color: saveDisabled ? 'var(--text-5)' : 'var(--accent-fg)', padding: '12px 22px', borderRadius: 11,
        fontSize: 14, fontWeight: 800, cursor: saveDisabled ? 'default' : 'pointer', fontFamily: 'inherit',
      }}>{saveLabel}</button>
    </div>
  );
}
