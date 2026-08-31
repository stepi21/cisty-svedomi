// Proč tohle existuje: appka na ploše telefonu (hlavně iPhone) se vždycky
// spustí na start_url z manifestu -- ne na adrese, ze které jsi appku na
// plochu přidal. Normální manifest.json má start_url pevně "/", takže appka
// na ploše "zapomene" kód pozvánky, i kdyby sis appku přidal přímo z demo
// odkazu. Tahle funkce vygeneruje manifest na míru: pokud appku otevřeš
// s ?invite=KOD v adrese, appka si vyžádá tenhle manifest (viz index.html)
// a kód pozvánky appka zapeče přímo do start_url. Ikonka na ploše pak
// vždycky otevře appku i s kódem, ať appku přidáš na plochu odkudkoli.
export default function handler(req, res) {
  const invite = typeof req.query.invite === 'string' ? req.query.invite : ''
  const startUrl = invite ? `/?invite=${encodeURIComponent(invite)}` : '/'

  res.setHeader('Content-Type', 'application/manifest+json')
  res.setHeader('Cache-Control', 'no-cache, must-revalidate')
  res.status(200).json({
    name: invite ? 'Nahodit — DEMO' : 'Nahodit',
    short_name: invite ? 'Nahodit DEMO' : 'Nahodit',
    description: 'Rybářský deník -- výpravy a úlovky, sám nebo s partou.',
    start_url: startUrl,
    display: 'standalone',
    background_color: '#EDE9DC',
    theme_color: '#123B52',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  })
}
