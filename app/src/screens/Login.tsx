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
  const busy = s.loginForm.busy; // während der Anmeldung: Button sperren + Feedback, kein Doppel-Submit

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80,
      // Ambient-Glow aus dem (pro Verein konfigurierbaren) Akzent abgeleitet → folgt der Vereinsfarbe.
      background: 'radial-gradient(1200px 620px at 50% -12%, color-mix(in srgb, var(--accent) 13%, var(--bg)) 0%, var(--bg) 60%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'auto',
    }}>
      <div style={{ width: 420, maxWidth: '94vw' }}>
        {/* Vereinslogo steht ueber dem Namen, mittig — der Verein ist das Erste, was man sieht.
            Die Groesse kommt ungekuerzt aus den Einstellungen (48–160 px): in dieser Anordnung
            darf das Logo gross sein, waehrend es neben dem Text gedeckelt werden musste. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 26, padding: '0 2px' }}>
          {(() => {
            const logoSize = s.settings.loginLogoSize ?? 88;
            return s.settings.clubLogo
              ? <img src={s.settings.clubLogo} alt={tr.sidebar.clubLogoAlt} style={{ width: logoSize, height: logoSize, borderRadius: Math.round(logoSize * 0.2), objectFit: 'contain', flexShrink: 0 }} />
              : <Logo size={logoSize} />;
          })()}
          <div style={{ textAlign: 'center', minWidth: 0 }}>
            <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.1 }}>DartsZentrale</div>
            {/* Ohne gepflegten Vereinsnamen bleibt die Zeile ganz weg, statt leer Platz zu halten. */}
            {s.settings.clubName && <div style={{ fontSize: 'var(--fs-sub)', color: 'var(--text-4)', fontWeight: 600, marginTop: 3 }}>{s.settings.clubName}</div>}
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-xl)', padding: 28, boxShadow: 'var(--shadow-card)' }}>
          <div style={{ fontSize: 'var(--fs-title)', fontWeight: 800, letterSpacing: '-.01em' }}>{tr.login.signIn}</div>
          <div style={{ width: 30, height: 2, background: 'var(--accent)', borderRadius: 2, margin: '9px 0 10px' }} />
          <div style={{ fontSize: 'var(--fs-sub)', color: 'var(--text-4)', marginBottom: 20 }}>{tr.login.signInSub}</div>

          <label htmlFor="login-email" style={{ display: 'block', fontSize: 'var(--fs-meta)', color: 'var(--text-3)', fontWeight: 700, marginBottom: 6 }}>{tr.login.email}</label>
          <input
            id="login-email"
            className="dh-input" type="email" value={s.loginForm.email} placeholder={tr.login.emailPh}
            onChange={(e) => s.setLoginField('email', e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !busy) s.loginEmail(); }}
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '12px 14px', color: 'var(--text)', fontSize: 'var(--fs-body)', fontFamily: 'inherit', marginBottom: 14 }}
          />

          <label htmlFor="login-pw" style={{ display: 'block', fontSize: 'var(--fs-meta)', color: 'var(--text-3)', fontWeight: 700, marginBottom: 6 }}>{tr.login.password}</label>
          <input
            id="login-pw"
            className="dh-input" type="password" value={s.loginForm.pw} placeholder="••••••••"
            onChange={(e) => s.setLoginField('pw', e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !busy) s.loginEmail(); }}
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '12px 14px', color: 'var(--text)', fontSize: 'var(--fs-body)', fontFamily: 'inherit', marginBottom: 6 }}
          />

          {s.loginForm.mfaStep && (
            <div style={{ marginTop: 8 }}>
              <label htmlFor="login-code" style={{ display: 'block', fontSize: 'var(--fs-meta)', color: 'var(--text-3)', fontWeight: 700, marginBottom: 6 }}>{tr.login.code}</label>
              <input
                id="login-code"
                className="dh-input" type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus
                value={s.loginForm.code} placeholder="123456"
                onChange={(e) => s.setLoginField('code', e.target.value.replace(/\s/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter' && !busy) s.loginEmail(); }}
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '12px 14px', color: 'var(--text)', fontSize: 'var(--fs-title)', letterSpacing: '.25em', fontFamily: 'var(--font-num, monospace)', marginBottom: 6 }}
              />
              <div style={{ fontSize: 'var(--fs-badge)', color: 'var(--text-5)', margin: '2px 2px 0' }}>{tr.login.codeHint}</div>
            </div>
          )}

          {s.loginForm.err && <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--danger)', fontWeight: 600, margin: '6px 2px 0' }}>{s.loginForm.err}</div>}

          <button className="dh-primary" onClick={() => s.loginEmail()} disabled={busy} style={{ width: '100%', marginTop: 16, background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)', padding: 13, borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-lead)', fontWeight: 800, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'inherit' }}>{busy ? tr.login.signingIn : (s.loginForm.mfaStep ? tr.login.confirm : tr.login.signIn)}</button>

          {demos.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0 16px' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
            <span style={{ fontSize: 'var(--fs-badge)', color: 'var(--text-5)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{tr.login.demoAccounts}</span>
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
                    <div style={{ fontSize: 'var(--fs-sub)', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                    <div style={{ fontSize: 'var(--fs-badge)', color: 'var(--text-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.email}</div>
                  </div>
                  <span style={{ fontSize: 'var(--fs-badge)', fontWeight: 800, color: r.color, background: r.bg, padding: '3px 8px', borderRadius: 'var(--radius-xs)', flexShrink: 0 }}>{r.label}</span>
                </button>
              );
            })}
          </div>
          {!s.pbMode && <div style={{ fontSize: 'var(--fs-badge)', color: 'var(--text-5)', textAlign: 'center', marginTop: 14 }}>{tr.login.demoHint}</div>}
        </div>

        {(impressum || datenschutz) && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 18, fontSize: 'var(--fs-meta)' }}>
            {impressum && <button className="dh-focus dh-tap" onClick={() => setLegal('impressum')} style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-meta)', padding: 4, borderRadius: 'var(--radius-xs)', textDecoration: 'underline' }}>{tr.login.impressum}</button>}
            {impressum && datenschutz && <span style={{ color: 'var(--text-5)' }}>·</span>}
            {datenschutz && <button className="dh-focus dh-tap" onClick={() => setLegal('datenschutz')} style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-meta)', padding: 4, borderRadius: 'var(--radius-xs)', textDecoration: 'underline' }}>{tr.login.datenschutz}</button>}
          </div>
        )}
      </div>

      {legal && (
        <div onClick={() => setLegal(null)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--scrim)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'auto' }}>
          <div role="dialog" aria-modal="true" aria-label={legalTitle} onClick={(e) => e.stopPropagation()} style={{ width: 620, maxWidth: '94vw', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '20px 24px', borderBottom: '1px solid var(--hairline)' }}>
              <div style={{ fontSize: 'var(--fs-title)', fontWeight: 800 }}>{legalTitle}</div>
              <button className="dh-focus dh-btn" onClick={() => setLegal(null)} aria-label={tr.login.close} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'var(--btn)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', color: 'var(--text-3)', cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            {/* Einzige echte Lesefläche der App: Zeilenlänge auf ~68 Zeichen begrenzt (vorher ~82) und
                eine Stufe größer als die dichte App-Typografie — hier wird gelesen, nicht bedient. */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: 'var(--fs-lead)', lineHeight: 1.6, color: 'var(--text-2)', maxWidth: '68ch' }}>{legalText}</div>
          </div>
        </div>
      )}
    </div>
  );
}
