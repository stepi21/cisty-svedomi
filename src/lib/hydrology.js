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
//   'monthly_avg' - jen měsíční průměr průtoku (historical/monthly/) —
//                    vodní stav a teplota vody tam ČHMÚ neposkytuje

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
  const res = await chmiFetch(path)
  if (!res.ok) return null
  const json = await res.json()
  // Formát měsíčních dat appka zatím nemá ověřený na reálném vzorku (jen
  // odvozený z názvů souborů) — zkusí pár rozumných tvarů, jinak vrátí null
  // (radši nic, než tichá chyba v datech).
  const table = json?.data?.data
  const rows = table?.values || json?.values
  const header = table?.header || json?.header
  if (!rows || !header) return null
  const cols = header.split(',')
  const monthIdx = cols.findIndex((c) => /^(m|month|mesic|měsíc)$/i.test(c.trim()))
  const valueIdx = cols.findIndex((c) => /^(q|value|hodnota)$/i.test(c.trim()))
  if (monthIdx === -1 || valueIdx === -1) return null
  const row = rows.find((r) => Number(r[monthIdx]) === month)
  if (!row || row[valueIdx] == null) return null
  return { level_cm: null, flow_m3s: row[valueIdx], temp_c: null }
}

// Hlavní funkce — pro danou stanici a datum (+ volitelně čas) vrátí vodní
// stav/průtok/teplotu vody s co nejlepší dostupnou přesností, nebo null,
// pokud se nic nepodařilo najít (appka pak to pole prostě nechá prázdné).
export async function fetchWaterConditions(stationId, dateStr, timeStr) {
  if (!stationId || !dateStr) return null
  const today = new Date().toISOString().slice(0, 10)
  const isToday = dateStr === today
  const target = timeStr ? new Date(`${dateStr}T${timeStr}:00`) : null

  try {
    if (isToday) {
      const tsList = await fetchStationSeries(stationId, dateStr, true)
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
      if (tsList) {
        return {
          level_cm: closestValue(tsList, 'H', target),
          flow_m3s: closestValue(tsList, 'Q', target),
          temp_c: closestValue(tsList, 'TH', target),
          precision: 'recent',
        }
      }
    }
  } catch {
    // padá dál na měsíční průměr
  }

  try {
    const monthly = await fetchMonthlyAverage(stationId, dateStr)
    if (monthly) return { ...monthly, precision: 'monthly_avg' }
  } catch {
    // appka nic nenašla — vrátí se null, volající to nechá prázdné
  }
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
