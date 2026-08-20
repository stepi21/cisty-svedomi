// Automatické vygenerování tvaru revíru podél řeky: appka nechá uživatele
// naklikat jen pár bodů středem toku, a sama dopočítá skutečnou vodní plochu
// z OpenStreetMap dat (Overpass API) v okolí té čáry.
//
// Postup:
// 1) Overpass dotaz na vodní plochy (natural=water, waterway=riverbank,
//    relace natural=water) v obdélníku kolem čáry -- s automatickým
//    fallbackem na záložní veřejný server, když hlavní neodpoví/timeoutne.
// 2) Kolem čáry appka vytvoří "koridor" (buffer) zvolené šířky a prolne ho
//    (intersect) se skutečnou vodou -- vzdálené zátoky/ramena mimo koridor
//    odpadnou, i když jsou v OSM zapsané jako součást téhož polygonu.
// 3) Na začátku a na konci čáry appka usekne dva kolmé řezy (kolmo na směr
//    prvního/posledního úseku čáry), ať délka výsledné plochy sedí přesně
//    na to, co uživatel naklikal -- ne na celou délku OSM polygonu.
//
// Ověřeno v izolovaném prototypu na úseku Labe (Tuhaň/Neratovice, Kárané,
// Čelákovice) -- na místech s kvalitně zmapovanou vodou v OSM dá appka
// realistický tvar břehu, ne jen odhadnutý symetrický pás.

import * as turf from '@turf/turf'

const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

function metersToDegLat(m) { return m / 111320 }
function metersToDegLng(m, lat) { return m / (111320 * Math.cos((lat * Math.PI) / 180)) }

function buildSearchBBox(points, padMeters) {
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const south = Math.min(...lats)
  const north = Math.max(...lats)
  const west = Math.min(...lngs)
  const east = Math.max(...lngs)
  const midLat = (south + north) / 2
  const padLat = metersToDegLat(padMeters)
  const padLng = metersToDegLng(padMeters, midLat)
  return { south: south - padLat, north: north + padLat, west: west - padLng, east: east + padLng }
}

async function queryOverpassWithFallback(query) {
  let lastError = null
  for (const server of OVERPASS_SERVERS) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000)
      const res = await fetch(server, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!res.ok) throw new Error(`server odpověděl chybou ${res.status}`)
      return await res.json()
    } catch (err) {
      lastError = err
      // zkusí další server v seznamu, žádná další akce tady není potřeba
    }
  }
  throw lastError || new Error('Všechny Overpass servery selhaly.')
}

function makeProjector(refLat) {
  const mLat = 111320
  const mLng = 111320 * Math.cos((refLat * Math.PI) / 180)
  return {
    toXY: (p) => [p.lng * mLng, p.lat * mLat],
    toLatLng: (xy) => ({ lat: xy[1] / mLat, lng: xy[0] / mLng }),
  }
}

function normalizeVec(v) {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1]) || 1
  return [v[0] / len, v[1] / len]
}

// Sutherland–Hodgman ořezání polygonu jednou polorovinou obecného směru
// (ne jen podél os) -- používá se pro dva kolmé řezy na koncích čáry.
function clipHalfPlane(poly, p0, normal) {
  function inside(p) { return (p[0] - p0[0]) * normal[0] + (p[1] - p0[1]) * normal[1] >= 0 }
  function intersectEdge(a, b) {
    const da = (a[0] - p0[0]) * normal[0] + (a[1] - p0[1]) * normal[1]
    const db = (b[0] - p0[0]) * normal[0] + (b[1] - p0[1]) * normal[1]
    const t = da / (da - db)
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
  }
  const output = []
  for (let i = 0; i < poly.length; i++) {
    const curr = poly[i]
    const prev = poly[(i - 1 + poly.length) % poly.length]
    const currIn = inside(curr)
    const prevIn = inside(prev)
    if (currIn) {
      if (!prevIn) output.push(intersectEdge(prev, curr))
      output.push(curr)
    } else if (prevIn) {
      output.push(intersectEdge(prev, curr))
    }
  }
  return output
}

/**
 * Vygeneruje jeden nebo víc polygonů (oblastí) podél zadané čáry středem
 * toku -- appka najde skutečnou vodní plochu z OSM v okolí čáry, prolne ji
 * s koridorem dané šířky, a usekne na délku čáry (s volitelným přesahem).
 *
 * @param {Array<{lat:number,lng:number}>} points -- čára, min. 2 body
 * @param {{corridorWidthMeters?: number, overshootMeters?: number}} options
 * @returns {Promise<Array<Array<{lat:number,lng:number}>>>} pole polygonů,
 *   každý jako pole bodů {lat,lng} -- stejný formát, jaký appka používá pro
 *   ručně naklikané oblasti (areaDraft.areas), takže jde rovnou vložit do
 *   existujícího zpracování beze změny.
 */
export async function buildRiverAreasFromLine(points, options = {}) {
  if (!points || points.length < 2) return []
  const corridorWidthMeters = options.corridorWidthMeters ?? 80
  const overshootMeters = options.overshootMeters ?? 0
  const searchPadMeters = 400 // menší než hledaná šířka koridoru by neměla být

  const searchBox = buildSearchBBox(points, searchPadMeters)
  const query = `
    [out:json][timeout:20];
    (
      way["natural"="water"](${searchBox.south},${searchBox.west},${searchBox.north},${searchBox.east});
      way["waterway"="riverbank"](${searchBox.south},${searchBox.west},${searchBox.north},${searchBox.east});
      relation["natural"="water"](${searchBox.south},${searchBox.west},${searchBox.north},${searchBox.east});
    );
    out body;
    >;
    out skel qt;
  `

  const data = await queryOverpassWithFallback(query)

  const nodesData = {}
  data.elements.filter((e) => e.type === 'node').forEach((n) => { nodesData[n.id] = { lat: n.lat, lng: n.lon } })
  const ways = data.elements.filter((e) => e.type === 'way' && e.nodes)
  if (ways.length === 0) return []

  const lineLngLat = points.map((p) => [p.lng, p.lat])
  const turfLine = turf.lineString(lineLngLat)
  const corridorPoly = turf.buffer(turfLine, corridorWidthMeters, { units: 'meters' })
  if (!corridorPoly) return []

  const midLat = points.reduce((s, p) => s + p.lat, 0) / points.length
  const proj = makeProjector(midLat)
  const ptsXY = points.map(proj.toXY)
  const start = ptsXY[0]
  const end = ptsXY[ptsXY.length - 1]
  const dirStart = normalizeVec([ptsXY[1][0] - ptsXY[0][0], ptsXY[1][1] - ptsXY[0][1]])
  const dirEnd = normalizeVec([
    ptsXY[ptsXY.length - 1][0] - ptsXY[ptsXY.length - 2][0],
    ptsXY[ptsXY.length - 1][1] - ptsXY[ptsXY.length - 2][1],
  ])
  const startCut = [start[0] - dirStart[0] * overshootMeters, start[1] - dirStart[1] * overshootMeters]
  const endCut = [end[0] + dirEnd[0] * overshootMeters, end[1] + dirEnd[1] * overshootMeters]

  const result = []
  ways.forEach((w) => {
    let latlngs = w.nodes.map((id) => nodesData[id]).filter(Boolean)
    if (latlngs.length < 3) return
    const first = latlngs[0]
    const last = latlngs[latlngs.length - 1]
    if (first.lat !== last.lat || first.lng !== last.lng) {
      latlngs = [...latlngs, first]
    }
    const ringLngLat = latlngs.map((p) => [p.lng, p.lat])
    let osmPoly
    try {
      osmPoly = turf.polygon([ringLngLat])
    } catch {
      return // nevalidní prstenec (samoprotnutí apod.) -- appka ho jen přeskočí
    }

    let intersection
    try {
      intersection = turf.intersect(osmPoly, corridorPoly)
    } catch {
      intersection = null
    }
    if (!intersection) return

    const polys = intersection.geometry.type === 'MultiPolygon'
      ? intersection.geometry.coordinates
      : [intersection.geometry.coordinates]

    polys.forEach((rings) => {
      const outerRing = rings[0]
      let polyXY = outerRing.map(([lng, lat]) => proj.toXY({ lat, lng }))
      polyXY = clipHalfPlane(polyXY, startCut, dirStart)
      if (polyXY.length < 3) return
      polyXY = clipHalfPlane(polyXY, endCut, [-dirEnd[0], -dirEnd[1]])
      if (polyXY.length < 3) return
      result.push(polyXY.map(proj.toLatLng))
    })
  })

  return result
}
