// Výpravy appka ukládá jen s JEDNÍM datem (den, kdy výprava začala) a
// dvěma časy (Od/Do) -- appka žádné druhé datum nepřidává, i když
// výprava přejde přes půlnoc (typicky noční kapr). Appka to pozná sama
// jen z porovnání časů: je-li čas Do menší než čas Od, výprava (nebo
// jednotlivý úlovek zapsaný v tu chvíli) appka bere jako spadající až
// do následujícího kalendářního dne.
//
// Zvládá appka jen JEDEN přechod přes půlnoc (výprava do 24 hodin) --
// vícedenní výpravy appka zatím neřeší, na to appka datum jen ze dvou
// časů odvodit nejde.

// Přičte (nebo odečte, se záporným počtem) dny k datu ve formátu
// "YYYY-MM-DD".
export function addDays(dateStr, days) {
  if (!dateStr) return dateStr
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// True, pokud appka pozná přechod přes půlnoc jen z toho, že Do je
// menší než Od (obojí musí být vyplněné).
export function crossesMidnight(timeFrom, timeTo) {
  return !!(timeFrom && timeTo && timeTo < timeFrom)
}

// Vrátí skutečné kalendářní datum daného času uvnitř výpravy -- buď
// datum výpravy, nebo (u časů po půlnoci) datum následujícího dne.
// Bez vyplněného Od u výpravy (starší výpravy appka to nemusí mít)
// appka prostě vrátí datum výpravy beze změny.
export function actualDateForTime(sessionDate, sessionTimeFrom, timeHHMM) {
  if (!timeHHMM || !sessionTimeFrom) return sessionDate
  return timeHHMM < sessionTimeFrom ? addDays(sessionDate, 1) : sessionDate
}

// Trvání výpravy v minutách, s ošetřeným přechodem přes půlnoc.
// Appka vrátí null, pokud chybí byť jeden z obou časů (appka appce
// tahle pole nedělá povinná).
export function sessionDurationMinutes(session) {
  const timeFrom = session?.time_from
  const timeTo = session?.time_to
  if (!timeFrom || !timeTo) return null
  const [fh, fm] = timeFrom.split(':').map(Number)
  const [th, tm] = timeTo.split(':').map(Number)
  if ([fh, fm, th, tm].some((n) => Number.isNaN(n))) return null
  let minutes = (th * 60 + tm) - (fh * 60 + fm)
  if (minutes <= 0) minutes += 24 * 60
  return minutes
}

// "4 h 30 min" / "45 min" / "2 h" -- appka zformátuje minuty na
// čitelný text.
export function formatDurationHM(minutes) {
  if (minutes == null) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}
