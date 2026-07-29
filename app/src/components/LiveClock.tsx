import { useState, useEffect, type CSSProperties } from 'react';
import { timeNow } from '../lib/format';
import { useT } from '../i18n';

// Live tickende Uhr (eigenes 1-Sekunden-Intervall → isolierter Re-Render, folgt immer der echten Systemzeit).
// mode 'time'     → "14:30"
// mode 'datetime' → "Freitag, 26. Juni 2026 · 14:30" (deutsches Standardformat)
export function LiveClock({ mode = 'time', style }: { mode?: 'time' | 'datetime'; style?: CSSProperties }) {
  const tr = useT();
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (mode === 'datetime') {
    // Locale aus dem Sprachpaket wie überall sonst — fest verdrahtetes 'de-DE' zeigte
    // englischen Nutzern ein deutsches Datum mitten in einer englischen Oberfläche.
    const date = now.toLocaleDateString(tr.format.dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return <span style={style}>{date} · {timeNow(now)}</span>;
  }
  return <span style={style}>{timeNow(now)}</span>;
}
