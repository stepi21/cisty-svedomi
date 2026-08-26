// Jednorázový migrační skript: appka zmenší a zkomprimuje VŠECHNY UŽ
// NAHRANÉ fotky ve Supabase Storage (bucket "photos"). Předchozí
// úprava (resizeImage v src/lib/storage.js) totiž zmenšuje jen NOVĚ
// nahrávané fotky odteď dál -- existující, plnorozměrné fotky appka
// nijak nezmenší, dokud je někdo nenahraje znovu. Tenhle skript
// doplní/zmenší ty staré fotky jednorázově.
//
// SPUŠTĚNÍ (appka to neumí spustit sama v prohlížeči -- pusť si to
// lokálně na svém počítači, potřebuješ Node.js 18+):
//
//   npm install @supabase/supabase-js sharp
//   node zmensit-existujici-fotky.mjs
//
// Níže musíš doplnit URL projektu a SERVICE ROLE klíč (Supabase
// Dashboard -> Project Settings -> API -> service_role, NE anon/public
// klíč, který appka běžně používá v prohlížeči). Ten service role klíč
// dokáže obejít všechna oprávnění (RLS) -- nikdy ho nedávej do appky
// samotné ani na GitHub, jen ho sem jednou lokálně vlož, skript pusť,
// a pak ho z tohohle souboru zase smaž.

const SUPABASE_URL = 'https://TVUJ-PROJEKT.supabase.co'        // doplň skutečnou URL projektu
const SUPABASE_SERVICE_ROLE_KEY = 'DOPLN-SEM-SERVICE-ROLE-KLIC'

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 82
const BUCKET = 'photos'
// Nejdřív appka jen SPOČÍTÁ, kolik místa by se ušetřilo, ale nic
// nenahraje ani nepřepíše (bezpečné na vyzkoušení). Až budeš spokojen
// s výpisem, přepni na false a spusť skript znovu -- tím se to
// provede doopravdy.
const DRY_RUN = true

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

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
        // je to složka -- appka appce projde dovnitř rekurzivně
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
  console.log(DRY_RUN ? 'SUCHÝ BĚH -- appka nic nenahraje ani nepřepíše, jen appka appce spočítá úsporu.' : 'appka teď fotky doopravdy PŘEPÍŠE.')
  const files = await listAllFiles('')
  console.log(`appka nalezla ${files.length} soubor(ů) v bucketu "${BUCKET}"`)
  for (const f of files) {
    await processOne(f)
  }
  console.log('Hotovo.')
}

main().catch((e) => { console.error(e); process.exit(1) })
