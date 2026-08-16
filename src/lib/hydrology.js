// Otevřená hydrologická data ČHMÚ (opendata.chmi.cz) — vodní stav, průtok,
// teplota vody. Bez klíče, licence CC BY 4.0.
//
// Stejný princip jako lib/weather.js: appka hodnotu K DANÉMU DATU dopočítá a
// uloží (neposčítává se živě znovu při každém zobrazení výpravy/úlovku) —
// výjimka je katalog míst (LocationsModal), tam se natahuje živě při otevření
// detailu, protože tam jde o "jak je na revíru TEĎ", ne o historickou hodnotu.
//
// Přesnost podle stáří dat (appka vybírá automaticky):
//   'live'        - dnešek, desetiminutová data (now/)
//   'recent'      - nedávná historie, denní podrobnost (recent/) — přesná
//                    hranice retenčního okna není z dokumentace jistá, appka
//                    to zkouší přes fetchNowOrRecent a při chybě/404 padá
//                    zpátky na měsíční průměr
//   'monthly_avg' - jen měsíční průměr průtoku a teploty vody
//                    (historical/monthly/) — vodní stav tam ČHMÚ
//                    v měsíčních datech neposkytuje

// POZNÁMKA K CORS (ověřeno v provozu): opendata.chmi.cz neposílá CORS
// hlavičky, takže přímé volání z prohlížeče appky prohlížeč zablokuje.
// Proto appka místo toho volá vlastní Supabase Edge Function "chmi-proxy"
// (viz supabase/functions/chmi-proxy/index.ts), která na pozadí (server-
// server, bez CORS) přeposílá požadavek na ČHMÚ a vrátí appce výsledek
// s hlavičkami, které prohlížeč pustí.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const PROXY_URL = `${SUPABASE_URL}/functions/v1/chmi-proxy`

async function chmiFetch(path) {
  return fetch(`${PROXY_URL}?path=${encodeURIComponent(path)}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  })
}

let stationListPromise = null

function toRad(deg) {
  return (deg * Math.PI) / 180
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// Seznam stanic appka stáhne jednou (přes 400 položek) a drží v paměti po
// dobu běhu appky — nemá smysl ho tahat znovu při každém dotazu.
async function loadStationList() {
  if (stationListPromise) return stationListPromise
  stationListPromise = (async () => {
    let res
    try {
      res = await chmiFetch('hydrology/now/metadata/meta1.json')
    } catch (err) {
      console.error('ČHMÚ — fetch meta1.json selhal:', err)
      stationListPromise = null
      throw err
    }
    if (!res.ok) {
      console.error('ČHMÚ — meta1.json vrátilo HTTP', res.status)
      stationListPromise = null
      throw new Error('Nepodařilo se načíst seznam stanic ČHMÚ.')
    }
    const json = await res.json()
    const table = json?.data?.data
    if (!table?.header || !table?.values) {
      console.error('ČHMÚ — neočekávaný formát meta1.json:', json)
      stationListPromise = null
      throw new Error('Neočekávaný formát metadat ČHMÚ.')
    }
    const cols = table.header.split(',')
    const iObjID = cols.indexOf('objID')
    const iName = cols.indexOf('STATION_NAME')
    const iStream = cols.indexOf('STREAM_NAME')
    const iLat = cols.indexOf('GEOGR1')
    const iLng = cols.indexOf('GEOGR2')
    return table.values
      .map((row) => ({
        objID: row[iObjID],
        name: row[iName],
        stream: row[iStream],
        lat: row[iLat],
        lng: row[iLng],
      }))
      .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
  })()
  return stationListPromise
}

// Pro výběr/potvrzení stanice u katalogového místa (a pro automatické
// dohledání u záznamů bez katalogového místa).
export async function findNearestStations(lat, lng, count = 5) {
  if (lat == null || lng == null) return []
  const stations = await loadStationList()
  return stations
    .map((s) => ({ ...s, distanceKm: haversineKm(lat, lng, s.lat, s.lng) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, count)
}

function closestValue(tsList, conID, targetDate) {
  const ts = tsList.find((t) => t.tsConID === conID)
  if (!ts?.tsData?.length) return null
  if (!targetDate) return ts.tsData[ts.tsData.length - 1].value ?? null
  let closest = ts.tsData[0]
  let bestDiff = Infinity
  for (const point of ts.tsData) {
    const diff = Math.abs(new Date(point.dt) - targetDate)
    if (diff < bestDiff) { bestDiff = diff; closest = point }
  }
  return closest.value ?? null
}

// Měsíční data mají tsData v jiném (kompaktním tabulkovém) tvaru, ověřeno
// naživo: { data: { header: "DT,VAL", values: [["2025-01-01T00:00:00Z", 91.7], ...] } }
function closestMonthlyValue(tsList, conID, targetDate) {
  const ts = tsList.find((t) => t.tsConID === conID)
  const rows = ts?.tsData?.data?.values
  if (!rows?.length) return null
  let closest = rows[0]
  let bestDiff = Infinity
  for (const row of rows) {
    const diff = Math.abs(new Date(row[0]) - targetDate)
    if (diff < bestDiff) { bestDiff = diff; closest = row }
  }
  return closest[1] ?? null
}

async function fetchStationSeries(stationId, dateStr, isToday) {
  const path = isToday
    ? `hydrology/now/data/${stationId}.json`
    : `hydrology/recent/data/${dateStr.replace(/-/g, '')}_${stationId}.json`
  let res
  try {
    res = await chmiFetch(path)
  } catch (err) {
    console.error(`ČHMÚ — fetch ${path} selhal:`, err)
    throw err
  }
  if (!res.ok) return null
  const json = await res.json()
  const obj = json?.objList?.[0]
  if (!obj?.tsList) return null
  return obj.tsList
}

async function fetchMonthlyAverage(stationId, dateStr) {
  const year = dateStr.slice(0, 4)
  const month = Number(dateStr.slice(5, 7))
  const path = `hydrology/historical/data/monthly/H_${stationId}_MQ_${year}.json`
  let res
  try {
    res = await chmiFetch(path)
  } catch (err) {
    console.error(`ČHMÚ — fetch ${path} selhal:`, err)
    return null
  }
  if (!res.ok) {
    console.warn(`ČHMÚ — ${path} vrátilo HTTP ${res.status} (stanice pro ten rok nejspíš nemá historická data).`)
    return null
  }
  const json = await res.json()
  // Stejný tvar jako now/recent (tsList s tsConID/tsData), jen bez obálky
  // "objList" a s jinými kódy: QM = měsíční průměrný průtok, TM = měsíční
  // průměrná teplota vody. Vodní stav (H) tu ČHMÚ v měsíčních datech nemá.
  const tsList = json?.tsList
  if (!tsList) {
    console.warn(`ČHMÚ — neočekávaný formát ${path}, syrová data:`, json)
    return null
  }
  const target = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`)
  const flow_m3s = closestMonthlyValue(tsList, 'QM', target)
  const temp_c = closestMonthlyValue(tsList, 'TM', target)
  if (flow_m3s == null && temp_c == null) return null
  return { level_cm: null, flow_m3s, temp_c }
}

// Hlavní funkce — pro danou stanici a datum (+ volitelně čas) vrátí vodní
// stav/průtok/teplotu vody s co nejlepší dostupnou přesností, nebo null,
// pokud se nic nepodařilo najít (appka pak to pole prostě nechá prázdné).
export async function fetchWaterConditions(stationId, dateStr, timeStr) {
  if (!stationId || !dateStr) return null
  const today = new Date().toISOString().slice(0, 10)
  const isToday = dateStr === today
  const target = timeStr ? new Date(`${dateStr}T${timeStr}:00`) : null
  console.info(`ČHMÚ: fetchWaterConditions(stanice=${stationId}, datum=${dateStr}, dnes=${isToday})`)

  try {
    if (isToday) {
      const tsList = await fetchStationSeries(stationId, dateStr, true)
      console.info('ČHMÚ: "now" výsledek tsList =', tsList)
      if (tsList) {
        return {
          level_cm: closestValue(tsList, 'H', target),
          flow_m3s: closestValue(tsList, 'Q', target),
          temp_c: closestValue(tsList, 'TH', target),
          precision: 'live',
        }
      }
    } else {
      const tsList = await fetchStationSeries(stationId, dateStr, false)
      console.info('ČHMÚ: "recent" výsledek tsList =', tsList)
      if (tsList) {
        return {
          level_cm: closestValue(tsList, 'H', target),
          flow_m3s: closestValue(tsList, 'Q', target),
          temp_c: closestValue(tsList, 'TH', target),
          precision: 'recent',
        }
      }
    }
  } catch (err) {
    console.warn('ČHMÚ: "now/recent" selhalo, padám na měsíční průměr:', err)
  }

  console.info('ČHMÚ: zkouším měsíční průměr (historical/monthly)...')
  try {
    const monthly = await fetchMonthlyAverage(stationId, dateStr)
    console.info('ČHMÚ: měsíční průměr výsledek =', monthly)
    if (monthly) return { ...monthly, precision: 'monthly_avg' }
  } catch (err) {
    console.warn('ČHMÚ: měsíční průměr selhal:', err)
  }
  console.info('ČHMÚ: nic se nenašlo, vracím null.')
  return null
}

// Pro živé zobrazení u katalogového místa (LocationsModal) — bez data,
// vždycky "co nejnovější, co ČHMÚ má".
export async function fetchLiveConditions(stationId) {
  if (!stationId) return null
  try {
    const tsList = await fetchStationSeries(stationId, null, true)
    if (!tsList) return null
    return {
      level_cm: closestValue(tsList, 'H'),
      flow_m3s: closestValue(tsList, 'Q'),
      temp_c: closestValue(tsList, 'TH'),
    }
  } catch {
    return null
  }
}

export const WATER_PRECISION_LABEL = {
  live: 'živě dnes',
  recent: 'z toho dne',
  monthly_avg: 'měsíční průměr',
}
