// OPRAVNY skript: napravuje skodu z predchoziho migracniho skriptu
// (zmensit-existujici-fotky.mjs). U fotek s jinou priponou nez .jpg
// (.png, .jpeg, .webp...) ten skript ulozil zmensenou verzi pod NOVYM
// jmenem (pripona .jpg) a PUVODNI soubor smazal. Databaze ale dal
// odkazuje na ten puvodni (smazany) nazev -- proto se v prohlizeci
// objevuji rozbite obrazky (otazniky).
//
// Tenhle skript databazi VUBEC NEMENI. Pro kazdy odkaz z databaze, ktery
// uz v Storage neexistuje, najde jeho novou (.jpg) verzi a ulozi ji
// zase zpatky POD PUVODNIM NAZVEM -- s Content-Type: image/jpeg, takze
// prohlizec obrazek zobrazi spravne i pod puvodni priponou (prohlizec
// se ridi Content-Type hlavickou, ne priponou v URL). Stare URL v
// databazi tak zase zacnou fungovat, beze zmeny jedineho radku v
// databazi.

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DRY_RUN = process.env.DRY_RUN !== 'false'
const BUCKET = 'photos'

import { createClient } from '@supabase/supabase-js'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Chybi SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Z verejne URL (".../object/public/photos/<cesta>") vytahne jen <cesta>.
function pathFromPublicUrl(url) {
  if (!url) return null
  const marker = `/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length))
}

async function collectAllPhotoUrls() {
  const urls = new Set()

  const { data: catches, error: e1 } = await supabase.from('catches').select('photo_url, bait_photo_url')
  if (e1) throw e1
  ;(catches || []).forEach((c) => {
    if (c.photo_url) urls.add(c.photo_url)
    if (c.bait_photo_url) urls.add(c.bait_photo_url)
  })

  const { data: baits, error: e2 } = await supabase.from('baits').select('photo_url')
  if (e2) throw e2
  ;(baits || []).forEach((b) => { if (b.photo_url) urls.add(b.photo_url) })

  // rods appka ma fotky nastrah ulozene uvnitr JSON sloupce "baits"
  // (pole objektu {name, photo_url}), ne jako vlastni plochy sloupec.
  const { data: rods, error: e3 } = await supabase.from('rods').select('baits')
  if (e3) throw e3
  ;(rods || []).forEach((r) => {
    (r.baits || []).forEach((b) => { if (b && b.photo_url) urls.add(b.photo_url) })
  })

  return urls
}

async function fileExists(path) {
  const dir = path.split('/').slice(0, -1).join('/')
  const name = path.split('/').pop()
  const { data, error } = await supabase.storage.from(BUCKET).list(dir, { limit: 1000, search: name })
  if (error) return false
  return (data || []).some((f) => f.name === name)
}

async function main() {
  console.log(DRY_RUN ? 'SUCHY BEH -- nic se nezapise, jen se vypise, co by se opravilo.' : 'Ostry beh -- appka teď obrazky doopravdy obnovi.')

  const urls = await collectAllPhotoUrls()
  console.log(`Nalezeno ${urls.size} unikatnich odkazu na fotky v databazi.`)

  let broken = 0
  let fixed = 0
  let unfixable = 0

  for (const url of urls) {
    const oldPath = pathFromPublicUrl(url)
    if (!oldPath) continue

    const exists = await fileExists(oldPath)
    if (exists) continue // stary odkaz zije, neni co opravovat

    broken++
    const newPath = oldPath.replace(/\.\w+$/, '') + '.jpg'
    if (newPath === oldPath) {
      console.log(`  chybi i puvodni .jpg soubor (nejde obnovit): ${oldPath}`)
      unfixable++
      continue
    }

    const newExists = await fileExists(newPath)
    if (!newExists) {
      console.log(`  nenalezena ani nova .jpg verze (nejde obnovit): ${oldPath}`)
      unfixable++
      continue
    }

    console.log(`  obnovim: ${oldPath}  (z ${newPath})`)
    if (DRY_RUN) continue

    const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(newPath)
    if (dlErr) { console.error('    chyba stazeni:', dlErr.message); continue }
    const buf = Buffer.from(await blob.arrayBuffer())
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(oldPath, buf, {
      contentType: 'image/jpeg', upsert: true,
    })
    if (upErr) { console.error('    chyba obnoveni:', upErr.message); continue }
    fixed++
  }

  console.log(`Hotovo. Rozbitych odkazu: ${broken}, opraveno: ${fixed}, bez opravy: ${unfixable}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
