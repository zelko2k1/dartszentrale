import { Avatar } from './Avatar';

// Box-Ansicht (Counter „Box" + alle Trainingsspiele): Name oben, große Kennzahl mittig, links daneben eine
// kleine schwarze Box (Counter: Legs, Training: Spiel-Kontext), unten eine Kennzahl-Zeile. Die Farben
// kommen aus denselben Einstellungen wie die übrigen Spielerkarten (Akzent, Score-Farbe, Skin/Theme).
// Leg-Box bewusst themen-unabhängig schwarz/weiß (Nutzervorgabe) — aus der DESIGN.md-Palette:
// dunkelste Fläche (Seitenleiste) + warmes Primärweiß, statt reinem #000/#fff. Feste Werte statt
// var(--…), weil die Variablen im Hellmodus/je Skin umschlagen würden.
const BADGE_BG = '#0a0c0e';
const BADGE_FG = '#ECEAE3';
export interface ScoreBoxBadge { value: string | number; label?: string; }
export interface ScoreBoxStat { label: string; value: string | number; }

export function ScoreBox({
  name, photo, short, av, active, dim, accent, scoreInk, turnLabel, main, mainSize, badges, stats, extra,
  nameSize = 17, badgeSize = 100, statSize = 100, avatarSize = 32, fill = false,
}: {
  name: string; photo?: string; short: string; av: number;
  active: boolean; dim?: boolean; accent: string; scoreInk?: string | null; turnLabel?: string;
  main: string | number;
  // CSS-Schriftgröße der großen Kennzahl (Counter: container-query-Formel, Training: feste px).
  mainSize: string;
  badges?: ScoreBoxBadge[]; stats?: ScoreBoxStat[]; extra?: React.ReactNode;
  nameSize?: number; badgeSize?: number; statSize?: number; avatarSize?: number;
  // true = füllt die verfügbare Höhe (Counter-Band); false = Höhe nach Inhalt (Training-Raster).
  fill?: boolean;
}) {
  const ink = active ? (scoreInk || accent) : 'var(--text-4)';
  const badgeFs = Math.round(22 * badgeSize / 100);
  return (
    <div style={{ flex: fill ? 1 : undefined, display: 'flex', flexDirection: 'column', minWidth: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden', opacity: dim ? 0.5 : 1, background: active ? `color-mix(in srgb, ${accent} 9%, var(--surface-2))` : 'var(--surface-2)', border: `1px solid ${active ? accent : 'var(--border-2)'}`, boxShadow: active ? `0 0 0 1px ${accent}, 0 0 46px color-mix(in srgb, ${accent} 12%, transparent)` : 'none', transition: 'border-color .18s var(--ease-out)' }}>
      {/* Name oben, mittig */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '12px 14px 0', minWidth: 0, flexShrink: 0 }}>
        <Avatar photo={photo} short={short} avi={av} size={avatarSize} />
        <div style={{ minWidth: 0, textAlign: 'left' }}>
          <div style={{ fontSize: nameSize, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.15 }}>{name}</div>
          <div style={{ fontSize: Math.max(10, Math.round(nameSize * 0.62)), color: accent, fontWeight: 700, letterSpacing: '.04em', height: Math.round(nameSize * 0.85) }}>{active ? turnLabel : ''}</div>
        </div>
      </div>
      {/* Mitte: kleine schwarze Box(en) links, große Kennzahl daneben */}
      {/* fill: die ganze Zeile ist der Container (cq-Einheiten), damit die Leg-Box direkt NEBEN der Zahl sitzt. */}
      <div style={{ flex: fill ? 1 : undefined, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '4px 14px', containerType: fill ? 'size' : undefined }}>
        {badges && badges.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            {badges.map((b, i) => (
              <div key={i} style={{ background: BADGE_BG, color: BADGE_FG, borderRadius: 'var(--radius-sm)', padding: `${Math.round(badgeFs * 0.25)}px ${Math.round(badgeFs * 0.45)}px`, minWidth: Math.round(badgeFs * 1.6), textAlign: 'center', lineHeight: 1 }}>
                {b.label && <div style={{ fontSize: Math.max(9, Math.round(badgeFs * 0.42)), fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 3 }}>{b.label}</div>}
                <div style={{ fontFamily: 'var(--font-num)', fontSize: badgeFs, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{b.value}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: 'var(--font-score)', fontWeight: 800, fontSize: mainSize, lineHeight: 1, letterSpacing: '-.03em', color: ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', WebkitTextStroke: '1.5px var(--score-stroke)', paintOrder: 'stroke fill' as React.CSSProperties['paintOrder'] }}>{main}</div>
        </div>
      </div>
      {extra && <div style={{ display: 'flex', justifyContent: 'center', padding: '0 12px 4px', flexShrink: 0 }}>{extra}</div>}
      {/* Kennzahl-Zeile unten */}
      {stats && stats.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '4px 18px', padding: '6px 12px 12px', flexShrink: 0 }}>
          {stats.map((st, i) => (
            <span key={i} style={{ fontSize: Math.round(15 * statSize / 100), whiteSpace: 'nowrap' }}>
              <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>{st.label} </span>
              <span style={{ fontFamily: 'var(--font-num)', fontWeight: 800 }}>{st.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
