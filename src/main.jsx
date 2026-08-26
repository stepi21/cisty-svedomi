import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import './styles.css'

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
