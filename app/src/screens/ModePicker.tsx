import { useStore } from '../store/useStore';
import { Logo } from '../lib/icons';

// Erst-Start-Auswahl: einmalig Lokal- oder Vereinsmodus wählen. Die Wahl wird festgeschrieben
// (appModeManual=true) und beim nächsten Start respektiert. Erscheint nur auf einem frischen Gerät.

function Card({ title, sub, points, onClick, primary }: {
  title: string; sub: string; points: string[]; onClick: () => void; primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="dh-hover-border"
      style={{
        flex: 1, minWidth: 240, maxWidth: 340, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
        background: 'var(--surface-2)', border: `1px solid ${primary ? 'var(--accent)' : 'var(--border-2)'}`,
        borderRadius: 18, padding: '24px 24px 22px', display: 'flex', flexDirection: 'column', gap: 12,
        boxShadow: primary ? '0 0 0 1px var(--accent), 0 14px 40px color-mix(in srgb, var(--accent) 14%, transparent)' : 'none',
      }}
    >
      <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>{sub}</div>
      <ul style={{ margin: '4px 0 0', paddingLeft: 18, color: 'var(--text-4)', fontSize: 12.5, lineHeight: 1.7 }}>
        {points.map((p, i) => <li key={i}>{p}</li>)}
      </ul>
      <div style={{ marginTop: 'auto', paddingTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{
          background: primary ? 'var(--accent)' : 'var(--btn)', color: primary ? 'var(--accent-fg)' : 'var(--text)',
          border: primary ? 'none' : '1px solid var(--border-2)', padding: '9px 16px', borderRadius: 11,
          fontSize: 13.5, fontWeight: 800,
        }}>Auswählen →</span>
      </div>
    </button>
  );
}

export function ModePicker() {
  const choose = useStore((s) => s.chooseMode);
  return (
    <div style={{
      flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 26, padding: 24, overflowY: 'auto', background: 'var(--bg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Logo size={34} />
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.01em' }}>DartsHub</div>
      </div>
      <div style={{ textAlign: 'center', maxWidth: 540 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Wie möchtest du DartsHub nutzen?</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-3)', lineHeight: 1.55 }}>
          Du kannst die Wahl später in den Einstellungen unter „Nutzungsart" jederzeit ändern.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 740 }}>
        <Card
          title="Lokal"
          sub="Alles auf diesem Gerät — ohne Server, ohne Anmeldung. Ideal für ein einzelnes Board."
          points={['Sofort startklar', 'Daten bleiben im Browser', 'Keine Datenbank nötig']}
          primary
          onClick={() => choose('local')}
        />
        <Card
          title="Vereinsmodus"
          sub="Mit eigenem Datenbank-Server: echte Konten, mehrere Boards, geteilte Daten."
          points={['Anmeldung mit Vereinskonto', 'Mehrere Geräte synchron', 'Server (LAN oder Cloud) nötig']}
          onClick={() => choose('verein')}
        />
      </div>
    </div>
  );
}
