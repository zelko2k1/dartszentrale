import { useState, useEffect, type CSSProperties } from 'react';
import { timeNow } from '../lib/format';

// Live tickende Uhr (eigenes 1-Sekunden-Intervall → isolierter Re-Render, folgt immer der echten Systemzeit).
// mode 'time'     → "14:30"
// mode 'datetime' → "Freitag, 26. Juni 2026 · 14:30" (deutsches Standardformat)
export function LiveClock({ mode = 'time', style }: { mode?: 'time' | 'datetime'; style?: CSSProperties }) {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (mode === 'datetime') {
    const date = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return <span style={style}>{date} · {timeNow(now)}</span>;
  }
  return <span style={style}>{timeNow(now)}</span>;
}
