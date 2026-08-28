// Orientační odhad hmotnosti ryby z délky u vybraných druhů.
//
// Appka počítá podle standardního ichtyologického vzorce (Fultonův
// kondiční faktor K): hmotnost(kg) = K * délka(cm)^3 / 100000.
// K appka bere jako průměrnou hodnotu pro "normálně vykrmenou" rybu
// daného druhu -- u konkrétního kusu (vyhladovělý/vykrmený jedinec) se
// skutečná hmotnost může lišit, appka to appce nabízí čistě jako
// orientační odhad, ne jako náhradu váhy.
//
// Appka se drží jen druhů, kde je vztah délka/hmotnost dost
// předvídatelný (válcovité/vřetenovité tělo) -- u druhů appka nemá
// dostatečně spolehlivou hodnotu K, appka odhad radši vůbec nenabídne,
// než aby appka ukázala zavádějící číslo.
// Appka místo přesné shody hledá klíčové slovo kdekoliv v názvu druhu --
// rybáři píší "Kapr obecný", "kapr šupinatý", jen "Kapr" i "korunní
// kapr", appka tak zachytí všechny běžné varianty, ne jen jednu
// přesnou podobu.
const SPECIES_K = [
  { keyword: 'kapr', k: 1.7 },
  { keyword: 'amur', k: 1.5 },
  { keyword: 'štika', k: 0.45 },
  { keyword: 'candát', k: 0.6 },
  { keyword: 'sumec', k: 0.35 },
  { keyword: 'bolen', k: 0.75 },
  { keyword: 'cejn', k: 1.3 },
  { keyword: 'lín', k: 1.4 },
]

function normalizeSpecies(name) {
  return (name || '').trim().toLowerCase()
}

function findK(speciesName) {
  const n = normalizeSpecies(speciesName)
  if (!n) return null
  const match = SPECIES_K.find((s) => n.includes(s.keyword))
  return match ? match.k : null
}

// Appka vrací null, když appka pro daný druh/délku nemá dost podkladů
// (appka pak pole prostě nechá prázdné -- žádný fallback appka
// nezobrazí).
export function estimateWeightKg(speciesName, lengthCm) {
  const k = findK(speciesName)
  const length = Number(lengthCm)
  if (!k || !length || length <= 0) return null
  const kg = (k * Math.pow(length, 3)) / 100000
  return Math.round(kg * 10) / 10
}

export function hasWeightEstimate(speciesName) {
  return findK(speciesName) != null
}
