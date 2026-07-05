import { useState } from 'react';
import { useStore } from '../store/useStore';
import { ROLES } from '../data/constants';
import { Avatar } from '../components/Avatar';
import { Logo } from '../lib/icons';

export function Login() {
  const s = useStore();
  // Schnellanmeldung per Konto-Klick gibt es nur im lokalen Demo-Modus (kein echtes Passwort).
  const demos = s.pbMode ? [] : s.accounts.filter((a) => a.active);
  // Rechtstexte (Impressum §5 DDG, Datenschutz Art. 13 DSGVO) — ohne Anmeldung erreichbar, Pflicht
  // im öffentlichen Internet-Betrieb. Nur verlinkt, wenn der Verein den jeweiligen Text gepflegt hat.
  const impressum = (s.settings.impressum || '').trim();
  const datenschutz = (s.settings.datenschutz || '').trim();
  const [legal, setLegal] = useState<null | 'impressum' | 'datenschutz'>(null);
  const legalTitle = legal === 'impressum' ? 'Impressum' : 'Datenschutzerklärung';
  const legalText = legal === 'impressum' ? impressum : datenschutz;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80,
      background: 'radial-gradient(1200px 600px at 50% -10%, #122a1e 0%, #0a0c0e 60%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'auto',
    }}>
      <div style={{ width: 420, maxWidth: '94vw' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 26 }}>
          {(() => {
            const logoSize = s.settings.loginLogoSize ?? 88;
            return s.settings.clubLogo
              ? <img src={s.settings.clubLogo} alt="Vereinslogo" style={{ width: logoSize, height: logoSize, borderRadius: Math.round(logoSize * 0.2), objectFit: 'contain' }} />
              : <Logo size={logoSize} />;
          })()}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.01em' }}>DartsZentrale</div>
            <div style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 600, marginTop: 2 }}>{s.settings.clubName ? `${s.settings.clubName} · ` : ''}Vereinsverwaltung</div>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 20, padding: 28, boxShadow: '0 30px 70px rgba(0,0,0,.5)' }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Anmelden</div>
          <div style={{ fontSize: 13, color: 'var(--text-4)', marginBottom: 20 }}>Mit deinem Vereinskonto anmelden</div>

          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, marginBottom: 6 }}>E-Mail</label>
          <input
            className="dh-input" type="email" value={s.loginForm.email} placeholder="name@verein.de"
            onChange={(e) => s.setLoginField('email', e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') s.loginEmail(); }}
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', marginBottom: 14 }}
          />

          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, marginBottom: 6 }}>Passwort</label>
          <input
            className="dh-input" type="password" value={s.loginForm.pw} placeholder="••••••••"
            onChange={(e) => s.setLoginField('pw', e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') s.loginEmail(); }}
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', marginBottom: 6 }}
          />

          {s.loginForm.mfaStep && (
            <div style={{ marginTop: 8 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, marginBottom: 6 }}>Bestätigungscode</label>
              <input
                className="dh-input" type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus
                value={s.loginForm.code} placeholder="123456"
                onChange={(e) => s.setLoginField('code', e.target.value.replace(/\s/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') s.loginEmail(); }}
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 11, padding: '12px 14px', color: 'var(--text)', fontSize: 18, letterSpacing: '.25em', fontFamily: 'var(--font-num, monospace)', marginBottom: 6 }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-5)', margin: '2px 2px 0' }}>Code aus deiner Authenticator-App. Kein Zugriff? Gib stattdessen einen deiner 8-stelligen Backup-Codes ein.</div>
            </div>
          )}

          {s.loginForm.err && <div style={{ fontSize: 12, color: '#E0594B', fontWeight: 600, margin: '6px 2px 0' }}>{s.loginForm.err}</div>}

          <button className="dh-primary" onClick={() => s.loginEmail()} style={{ width: '100%', marginTop: 16, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: 13, borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{s.loginForm.mfaStep ? 'Bestätigen' : 'Anmelden'}</button>

          {demos.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0 16px' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-5)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>Demo-Konten</span>
            <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
          </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {demos.map((d) => {
              const r = ROLES[d.role];
              return (
                <button key={d.id} className="dh-hover-border" onClick={() => s.login(d.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Avatar photo={d.photo} short={(d.first[0] || '') + (d.last[0] || '')} avi={d.avi} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.email}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: r.color, background: r.bg, padding: '3px 8px', borderRadius: 6, flexShrink: 0 }}>{r.label}</span>
                </button>
              );
            })}
          </div>
          {!s.pbMode && <div style={{ fontSize: 11, color: 'var(--text-5)', textAlign: 'center', marginTop: 14 }}>Demo-Modus — Passwort beliebig, oder Demo-Konto wählen.</div>}
        </div>

        {(impressum || datenschutz) && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 18, fontSize: 12 }}>
            {impressum && <button onClick={() => setLegal('impressum')} style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, padding: 4, textDecoration: 'underline' }}>Impressum</button>}
            {impressum && datenschutz && <span style={{ color: 'var(--text-5)' }}>·</span>}
            {datenschutz && <button onClick={() => setLegal('datenschutz')} style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, padding: 4, textDecoration: 'underline' }}>Datenschutz</button>}
          </div>
        )}
      </div>

      {legal && (
        <div onClick={() => setLegal(null)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(6,8,10,.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 620, maxWidth: '94vw', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 18, boxShadow: '0 30px 70px rgba(0,0,0,.55)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '20px 24px', borderBottom: '1px solid var(--hairline)' }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{legalTitle}</div>
              <button onClick={() => setLegal(null)} aria-label="Schließen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 10, color: 'var(--text-3)', cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div style={{ padding: '20px 24px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, color: 'var(--text-2)' }}>{legalText}</div>
          </div>
        </div>
      )}
    </div>
  );
}
