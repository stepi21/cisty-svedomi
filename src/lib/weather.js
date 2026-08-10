// Bezplatné počasí bez API klíče — Open-Meteo.
// Pro dnešek/budoucnost použije forecast endpoint, pro minulost archiv.

const WEATHER_DESC = {
  0: 'jasno', 1: 'převážně jasno', 2: 'oblačno', 3: 'zataženo',
  45: 'mlha', 48: 'jinovatka a mlha',
  51: 'slabý déšť', 53: 'déšť', 55: 'vytrvalý déšť',
  61: 'slabý déšť', 63: 'déšť', 65: 'silný déšť',
  71: 'slabé sněžení', 73: 'sněžení', 75: 'silné sněžení',
  80: 'přeháňky', 81: 'přeháňky', 82: 'silné přeháňky',
  95: 'bouřka', 96: 'bouřka s kroupami', 99: 'silná bouřka s kroupami',
}

export function moonPhaseName(dateStr) {
  if (!dateStr) return null
  const synodic = 29.53058867
  const known = new Date('2000-01-06T18:14:00Z')
  const target = new Date(`${dateStr}T12:00:00Z`)
  const days = (target - known) / 86400000
  let phase = (days % synodic) / synodic
  if (phase < 0) phase += 1
  const names = ['Nov', 'Dorůstající srpek', 'První čtvrť', 'Dorůstající měsíc', 'Úplněk', 'Couvající měsíc', 'Poslední čtvrť', 'Couvající srpek']
  const idx = Math.round(phase * 8) % 8
  return names[idx]
}

export async function fetchWeather(lat, lng, dateStr, timeStr) {
  if (lat == null || lng == null || !dateStr) {
    throw new Error('Chybí pozice nebo datum.')
  }
  const time = timeStr || '12:00'
  const target = new Date(`${dateStr}T00:00:00`)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const isPast = target < today

  const base = isPast
    ? 'https://archive-api.open-meteo.com/v1/archive'
    : 'https://api.open-meteo.com/v1/forecast'

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: 'temperature_2m,surface_pressure,wind_speed_10m,weather_code',
    timezone: 'Europe/Prague',
    start_date: dateStr,
    end_date: dateStr,
  })

  const res = await fetch(`${base}?${params.toString()}`)
  if (!res.ok) throw new Error('Server s počasím neodpověděl.')
  const data = await res.json()
  if (!data.hourly || !data.hourly.time || !data.hourly.time.length) {
    throw new Error('Pro tento den/lokaci nejsou data o počasí.')
  }

  const hourPrefix = time.slice(0, 2)
  const targetLabel = `${dateStr}T${hourPrefix}:00`
  let idx = data.hourly.time.indexOf(targetLabel)
  if (idx === -1) idx = 0

  const code = data.hourly.weather_code[idx]
  return {
    temp: Math.round(data.hourly.temperature_2m[idx]),
    pressure: Math.round(data.hourly.surface_pressure[idx]),
    wind: `${Math.round(data.hourly.wind_speed_10m[idx])} km/h`,
    desc: WEATHER_DESC[code] ?? 'neznámo',
  }
}
