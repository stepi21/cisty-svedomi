// Supabase Edge Function: chmi-proxy
// ----------------------------------------------------------------------------
// Proč tohle existuje: opendata.chmi.cz je obyčejný statický souborový server
// a neposílá CORS hlavičky (Access-Control-Allow-Origin) — prohlížeč proto
// zablokuje přímé volání appky na jejich data. Tahle funkce běží na
// Supabase (server-server, žádné CORS) a jen bezpečně přeposílá požadavek.
//
// Bezpečnost: proxy jde použít JEN na předem povolené cesty pod
// opendata.chmi.cz (whitelist níže) — nejde ho zneužít jako obecný otevřený
// proxy na cokoliv jiného.
// ----------------------------------------------------------------------------

const ALLOWED_PREFIXES = [
  'hydrology/now/metadata/',
  'hydrology/now/data/',
  'hydrology/recent/data/',
  'hydrology/historical/data/monthly/',
]

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  const url = new URL(req.url)
  const path = url.searchParams.get('path') || ''

  if (!ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return new Response(JSON.stringify({ error: 'Nepovolená cesta.' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const upstream = await fetch(`https://opendata.chmi.cz/${path}`)
    const body = await upstream.text()
    return new Response(body, {
      status: upstream.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
