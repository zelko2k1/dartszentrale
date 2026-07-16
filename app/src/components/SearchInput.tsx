import type { Ref, KeyboardEventHandler } from 'react';
import { IconSearch, IconX } from '../lib/icons';
import { useT } from '../i18n';

// Schlankes Suchfeld für Listen (Spieler, Benutzer, Kader). Filtert live ab dem
// ersten Zeichen; mit „×" lässt sich die Eingabe schnell leeren.
export function SearchInput({
  value, onChange, placeholder, width = 240, autoFocus = false, inputRef, onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number | string;
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
}) {
  const tr = useT();
  return (
    <div style={{ position: 'relative', width, maxWidth: '100%' }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)', display: 'flex', pointerEvents: 'none' }}>
        <IconSearch size={16} />
      </span>
      <input
        className="dh-input"
        type="text"
        ref={inputRef}
        value={value}
        autoFocus={autoFocus}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? tr.search.placeholder}
        style={{
          width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)',
          borderRadius: 11, padding: '10px 34px', color: 'var(--text)', fontSize: 14, fontWeight: 600,
          fontFamily: 'inherit', outline: 'none',
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          title={tr.search.clear}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 24, height: 24, borderRadius: 7, background: 'transparent', border: 'none', color: 'var(--text-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <IconX size={15} />
        </button>
      )}
    </div>
  );
}
