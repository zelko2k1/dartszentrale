import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts'
import './styles/tokens.css'
import './styles/global.css'
import App from './App.tsx'
import { useStore } from './store/useStore'
import { initPwaUpdate } from './lib/pwaUpdate'

// PWA: Service-Worker registrieren + beim Start einmalig auf eine neue Version prüfen.
// Nur im Production-Build (im Dev ist der SW aus). Ein bereitliegendes Update wird NICHT automatisch
// angewendet – es erscheint als Hinweis-Banner + in den Einstellungen, Reload nur per Klick.
if (import.meta.env.PROD) {
  initPwaUpdate((ready) => useStore.setState({ updateReady: ready }))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
