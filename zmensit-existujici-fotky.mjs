// Jednorázový migrační skript: appka zmenší a zkomprimuje VŠECHNY UŽ
// NAHRANÉ fotky ve Supabase Storage (bucket "photos"). Předchozí
// úprava (resizeImage v src/lib/storage.js) totiž zmenšuje jen NOVĚ
// nahrávané fotky odteď dál -- existující, plnorozměrné fotky appka
// nijak nezmenší, dokud je někdo nenahraje znovu. Tenhle skript
// doplní/zmenší ty staré fotky jednorázově.
//
// Spouští se přes GitHub Actions (viz .github/workflows/zmensit-fotky.yml)
// -- appka čte URL projektu, klíč a "suchý běh" z proměnných prostředí,
// NIKDY je nemá natvrdo v kódu (to by skončilo veřejně v repu).

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DRY_RUN = process.env.DRY_RUN !== 'false' // proměnné prostředí jsou vždycky text -- appka bezpečný běh (suchý) použije, POKUD DRY_RUN nebude přesně řetězec "false"

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 82
const BUCKET = 'photos'

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Chybí SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY (proměnné prostředí).')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function listAllFiles(prefix) {
  const out = []
  let offset = 0
  const PAGE = 100
  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: PAGE, offset })
    if (error) throw error
    if (!data || data.length === 0) break
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id === null) {
        // je to složka -- appka projde dovnitř rekurzivně
        out.push(...await listAllFiles(path))
      } else {
        out.push({ path, size: item.metadata?.size ?? 0 })
      }
    }
    if (data.length < PAGE) break
    offset += PAGE
  }
  return out
}

async function processOne(file) {
  const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(file.path)
  if (dlErr) { console.error('  chyba stažení:', file.path, dlErr.message); return }
  const inputBuf = Buffer.from(await blob.arrayBuffer())

  let outBuf
  try {
    outBuf = await sharp(inputBuf)
      .rotate() // podle EXIF appka opraví rotaci, ať fotka po zmenšení nezůstane "na boku"
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer()
  } catch (e) {
    console.error('  nešlo zpracovat:', file.path, e.message)
    return
  }

  const beforeKB = (inputBuf.length / 1024).toFixed(0)
  const afterKB = (outBuf.length / 1024).toFixed(0)
  if (outBuf.length >= inputBuf.length) {
    console.log(`  ${file.path}: ${beforeKB}KB -- už je menší/stejné, appka přeskočí`)
    return
  }
  console.log(`  ${file.path}: ${beforeKB}KB -> ${afterKB}KB`)

  if (DRY_RUN) return

  const newPath = file.path.replace(/\.\w+$/, '') + '.jpg'
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(newPath, outBuf, {
    contentType: 'image/jpeg', upsert: true,
  })
  if (upErr) { console.error('  chyba nahrání:', newPath, upErr.message); return }
  if (newPath !== file.path) {
    await supabase.storage.from(BUCKET).remove([file.path])
  }
}

async function main() {
  console.log(DRY_RUN ? 'SUCHÝ BĚH -- appka nic nenahraje ani nepřepíše, jen spočítá úsporu.' : 'appka teď fotky doopravdy PŘEPÍŠE.')
  const files = await listAllFiles('')
  console.log(`appka nalezla ${files.length} soubor(ů) v bucketu "${BUCKET}"`)
  for (const f of files) {
    await processOne(f)
  }
  console.log('Hotovo.')
}

main().catch((e) => { console.error(e); process.exit(1) })
