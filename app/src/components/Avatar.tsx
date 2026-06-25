import { avatar } from '../data/constants';

// Einheitliche Avatar-Anzeige: zeigt das Profilfoto (falls vorhanden), sonst Farbe + Kürzel.
// size = Kantenlänge in px; circle = rund statt abgerundetes Quadrat.
export function Avatar({ photo, short, avi, size = 32, circle = false, style }: {
  photo?: string | null; short: string; avi: number; size?: number; circle?: boolean; style?: React.CSSProperties;
}) {
  const radius = circle ? '50%' : Math.max(6, Math.round(size * 0.28));
  const base: React.CSSProperties = { width: size, height: size, borderRadius: radius, flexShrink: 0, ...style };
  if (photo) {
    return <img src={photo} alt="" loading="lazy" style={{ ...base, objectFit: 'cover', background: 'var(--btn)' }} />;
  }
  const a = avatar(avi);
  return (
    <div style={{ ...base, background: a.bg, color: a.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: Math.max(9, Math.round(size * 0.38)) }}>{short}</div>
  );
}
