import { useState } from 'react';
import { useStore } from '../store/useStore';
import { ROLES } from '../data/constants';
import { Avatar } from '../components/Avatar';
import { Logo } from '../lib/icons';
import { useT } from '../i18n';

export function Login() {
  const s = useStore();
  const tr = useT();
  // Schnellanmeldung per Konto-Klick gibt es nur im lokalen Demo-Modus (kein echtes Passwort).
  const demos = s.pbMode ? [] : s.accounts.filter((a) => a.active);
  // Rechtstexte (Impressum §5 DDG, Datenschutz Art. 13 DSGVO) — ohne Anmeldung erreichbar, Pflicht
  // im öffentlichen Internet-Betrieb. Nur verlinkt, wenn der Verein den jeweiligen Text gepflegt hat.
  const impressum = (s.settings.impressum || '').trim();
  const datenschutz = (s.settings.datenschutz || '').trim();
  const [legal, setLegal] = useState<null | 'impressum' | 'datenschutz'>(null);
  const legalTitle = legal === 'impressum' ? tr.login.impressumTitle : tr.login.datenschutzTitle;
  const legalText = legal === 'impressum' ? impressum : datenschutz;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80,
      // Ambient-Glow aus dem (pro Verein konfigurierbaren) Akzent abgeleitet → folgt der Vereinsfarbe.
      background: 'radial-gradient(1200px 620px at 50% -12%, color-mix(in srgb, var(--accent) 13%, var(--bg)) 0%, var(--bg) 60%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'auto',
    }}>
      <div style={{ width: 420, maxWidth: '94vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22, padding: '0 2px' }}>
          {(() => {
            const logoSize = s.settings.loginLogoSize ?? 88;
            const lockSize = Math.min(logoSize, 56);
            return s.settings.clubLogo
              ? <img src={s.settings.clubLogo} alt={tr.sidebar.clubLogoAlt} style={{ width: lockSize, height: lockSize, borderRadius: Math.round(lockSize * 0.2), objectFit: 'contain', flexShrink: 0 }} />
              : <Logo size={lockSize} />;
          })()}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.1 }}>DartsZentrale</div>
            <div style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 600, marginTop: 3 }}>{s.settings.clubName ? `${s.settings.clubName} · ` : ''}{tr.login.management}</div>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-xl)', padding: 28, boxShadow: 'var(--shadow-card)' }}>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>{tr.login.signIn}</div>
          <div style={{ width: 30, height: 2, background: 'var(--accent)', borderRadius: 2, margin: '9px 0 10px' }} />
          <div style={{ fontSize: 13, color: 'var(--text-4)', marginBottom: 20 }}>{tr.login.signInSub}</div>

          <label htmlFor="login-email" style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, marginBottom: 6 }}>{tr.login.email}</label>
          <input
            id="login-email"
            className="dh-input" type="email" value={s.loginForm.email} placeholder="name@verein.de"
            onChange={(e) => s.setLoginField('email', e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') s.loginEmail(); }}
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', marginBottom: 14 }}
          />

          <label htmlFor="login-pw" style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, marginBottom: 6 }}>{tr.login.password}</label>
          <input
            id="login-pw"
            className="dh-input" type="password" value={s.loginForm.pw} placeholder="••••••••"
            onChange={(e) => s.setLoginField('pw', e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') s.loginEmail(); }}
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', marginBottom: 6 }}
          />

          {s.loginForm.mfaStep && (
            <div style={{ marginTop: 8 }}>
              <label htmlFor="login-code" style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, marginBottom: 6 }}>{tr.login.code}</label>
              <input
                id="login-code"
                className="dh-input" type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus
                value={s.loginForm.code} placeholder="123456"
                onChange={(e) => s.setLoginField('code', e.target.value.replace(/\s/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') s.loginEmail(); }}
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '12px 14px', color: 'var(--text)', fontSize: 18, letterSpacing: '.25em', fontFamily: 'var(--font-num, monospace)', marginBottom: 6 }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-5)', margin: '2px 2px 0' }}>{tr.login.codeHint}</div>
            </div>
          )}

          {s.loginForm.err && <div style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600, margin: '6px 2px 0' }}>{s.loginForm.err}</div>}

          <button className="dh-primary" onClick={() => s.loginEmail()} style={{ width: '100%', marginTop: 16, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: 13, borderRadius: 'var(--radius-md)', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{s.loginForm.mfaStep ? tr.login.confirm : tr.login.signIn}</button>

          {demos.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0 16px' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-5)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{tr.login.demoAccounts}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
          </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {demos.map((d) => {
              const r = ROLES[d.role];
              return (
                <button key={d.id} className="dh-hover-border" onClick={() => s.login(d.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Avatar photo={d.photo} short={(d.first[0] || '') + (d.last[0] || '')} avi={d.avi} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.email}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: r.color, background: r.bg, padding: '3px 8px', borderRadius: 'var(--radius-xs)', flexShrink: 0 }}>{r.label}</span>
                </button>
              );
            })}
          </div>
          {!s.pbMode && <div style={{ fontSize: 11, color: 'var(--text-5)', textAlign: 'center', marginTop: 14 }}>{tr.login.demoHint}</div>}
        </div>

        {(impressum || datenschutz) && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 18, fontSize: 12 }}>
            {impressum && <button className="dh-focus" onClick={() => setLegal('impressum')} style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, padding: 4, borderRadius: 'var(--radius-xs)', textDecoration: 'underline' }}>{tr.login.impressum}</button>}
            {impressum && datenschutz && <span style={{ color: 'var(--text-5)' }}>·</span>}
            {datenschutz && <button className="dh-focus" onClick={() => setLegal('datenschutz')} style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, padding: 4, borderRadius: 'var(--radius-xs)', textDecoration: 'underline' }}>{tr.login.datenschutz}</button>}
          </div>
        )}
      </div>

      {legal && (
        <div onClick={() => setLegal(null)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--scrim)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'auto' }}>
          <div role="dialog" aria-modal="true" aria-label={legalTitle} onClick={(e) => e.stopPropagation()} style={{ width: 620, maxWidth: '94vw', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '20px 24px', borderBottom: '1px solid var(--hairline)' }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{legalTitle}</div>
              <button className="dh-focus dh-btn" onClick={() => setLegal(null)} aria-label={tr.login.close} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', color: 'var(--text-3)', cursor: 'pointer' }}>
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
