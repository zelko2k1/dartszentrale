import type { CSSProperties, ReactNode } from 'react';

// Klickbare Zeile/Karte mit ECHTER Button-Semantik: Tastatur (Enter/Space), Fokus, role=button gratis.
// Ersatz für `<div onClick>`. Setzt bewusst KEINE visuellen Button-Defaults → sieht identisch zum div aus;
// alle Layout-Styles kommen wie zuvor über `style`.
// HINWEIS: nur verwenden, wenn die Zeile KEINE verschachtelten interaktiven Elemente (Buttons/Links) enthält
// — sonst entsteht ungültiges verschachteltes <button>. Für solche Fälle role="button"+tabIndex+onKeyDown am div.
export function PressableRow({ children, onClick, style, className, title, disabled, ariaLabel }: {
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  className?: string;
  title?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={className}
      style={{
        display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
        padding: 0, margin: 0, font: 'inherit', color: 'inherit', cursor: disabled ? 'default' : 'pointer',
        ...style,
      }}
    >{children}</button>
  );
}
