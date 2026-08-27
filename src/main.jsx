import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import './styles.css'

// Appka fotky (Domů/Úlovky) natahuje z domény Supabase Storage, na kterou
// prohlížeč do teď nemusel mít žádné spojení -- první fotka tak zbytečně
// čekala na plný DNS+TLS handshake navíc, než se vůbec začala stahovat.
// Appka proto hned na startu požádá prohlížeč, ať tohle spojení připraví
// předem ("preconnect"). URL berem z env proměnné (ne napevno v
// index.html), protože se liší mezi lokálním během a Vercelem.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
if (supabaseUrl) {
  const link = document.createElement('link')
  link.rel = 'preconnect'
  link.href = supabaseUrl
  link.crossOrigin = 'anonymous'
  document.head.appendChild(link)
}

// Registrace service workeru -- jen kvůli Android Chrome, ať appku
// nabídne jako plnohodnotnou appku k instalaci (bez adresního řádku),
// ne jen jako záložku. iOS Safari to samo o sobě neřeší, ale ani mu to
// nevadí (chybějící/tichou registraci prostě ignoruje).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Appka poběží normálně i bez service workeru -- jen Chrome na
      // Androidu potom nenabídne plnou instalaci, jen "Přidat na
      // plochu". Neřešíme to jinak, jen to appku nesmí zastavit.
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
