// Jednorázový migrační skript: appka doplní malé náhledové fotky
// (miniatury) ke VŠEM UŽ NAHRANÝM fotkám, které appka zatím žádný
// náhled nemá. Nová úprava appky (src/lib/storage.js) totiž náhled
// generuje jen u NOVĚ nahrávaných fotek odteď dál -- existující fotky
// zůstávají bez náhledu, dokud je někdo nenahraje znovu. Tenhle skript
// tu mezeru doplní jednorázově, bez nutnosti cokoli přenahrávat.
//
// SPUŠTĚNÍ (appka to neumí spustit sama v prohlížeči -- pusť si to
// lokálně na svém počítači, potřebuješ Node.js 18+):
//
//   npm install @supabase/supabase-js sharp
//   node vytvorit-nahledy.mjs
//
// Níže musíš doplnit URL projektu a SERVICE ROLE klíč (Supabase
// Dashboard -> Project Settings -> API -> service_role, NE anon/public
// klíč). Ten service role klíč dokáže obejít všechna oprávnění (RLS) --
// nikdy ho nedávej do appky samotné ani na GitHub, jen ho sem jednou
// lokálně vlož, skript pusť, a pak ho z tohohle souboru zase smaž.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://TVUJ-PROJEKT.supabase.co'        // doplň skutečnou URL projektu (pro lokální běh)
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'DOPLN-SEM-SERVICE-ROLE-KLIC'

const THUMB_DIMENSION = 480
const THUMB_QUALITY = 65
const BUCKET = 'photos'
// Appka nejdřív jen SPOČÍTÁ, kolik fotek by dostalo náhled, ale nic
// nenahraje ani nezapíše do databáze (bezpečné na vyzkoušení). Až
// budeš spokojen s výpisem, přepni na false (nebo v GitHub Actions
// odškrtni checkbox dry_run) a spusť skript znovu -- tím se to provede
// doopravdy.
const DRY_RUN = process.env.DRY_RUN !== undefined ? process.env.DRY_RUN !== 'false' : true

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`

// Appka si pamatuje, jaký náhled appka už jednou vyrobila pro danou
// plnou URL -- stejná fotka (nástraha) appka totiž zůstává navázaná
// na desítky úlovků/prutů najednou, appka by jinak zbytečně stahovala
// a zmenšovala ten samý soubor pořád znovu.
const thumbCache = new Map()

function storagePathFromPublicUrl(url) {
  if (!url || !url.startsWith(PUBLIC_PREFIX)) return null
  return url.slice(PUBLIC_PREFIX.length)
}

async function makeThumbForUrl(photoUrl) {
  if (thumbCache.has(photoUrl)) return thumbCache.get(photoUrl)
  const path = storagePathFromPublicUrl(photoUrl)
  if (!path) { thumbCache.set(photoUrl, null); return null }
  const thumbPath = path.replace(/\.\w+$/, '') + '-thumb.jpg'

  if (DRY_RUN) {
    thumbCache.set(photoUrl, `${PUBLIC_PREFIX}${thumbPath}`)
    return thumbCache.get(photoUrl)
  }

  try {
    const res = await fetch(photoUrl)
    if (!res.ok) { thumbCache.set(photoUrl, null); return null }
    const bytes = Buffer.from(await res.arrayBuffer())
    const thumbBytes = await sharp(bytes)
      .resize({ width: THUMB_DIMENSION, height: THUMB_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: THUMB_QUALITY })
      .toBuffer()
    const { error } = await supabase.storage.from(BUCKET).upload(thumbPath, thumbBytes, {
      contentType: 'image/jpeg', upsert: true,
    })
    if (error) { console.warn(`  ✗ nahrání náhledu selhalo (${path}): ${error.message}`); thumbCache.set(photoUrl, null); return null }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(thumbPath)
    thumbCache.set(photoUrl, data.publicUrl)
    return data.publicUrl
  } catch (err) {
    console.warn(`  ✗ zpracování fotky selhalo (${path}): ${err.message}`)
    thumbCache.set(photoUrl, null)
    return null
  }
}

async function processCatches() {
  console.log('\n--- catches (foto úlovku + foto nástrahy) ---')
  let from = 0
  const PAGE = 200
  let touched = 0
  while (true) {
    const { data: rows, error } = await supabase
      .from('catches')
      .select('id, photo_url, photo_thumb_url, bait_photo_url, bait_photo_thumb_url')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!rows || rows.length === 0) break

    for (const row of rows) {
      const updates = {}
      if (row.photo_url && !row.photo_thumb_url) {
        const thumbUrl = await makeThumbForUrl(row.photo_url)
        if (thumbUrl) updates.photo_thumb_url = thumbUrl
      }
      if (row.bait_photo_url && !row.bait_photo_thumb_url) {
        const thumbUrl = await makeThumbForUrl(row.bait_photo_url)
        if (thumbUrl) updates.bait_photo_thumb_url = thumbUrl
      }
      if (Object.keys(updates).length > 0) {
        touched++
        console.log(`  úlovek ${row.id}: ${Object.keys(updates).join(', ')}`)
        if (!DRY_RUN) {
          const { error: updErr } = await supabase.from('catches').update(updates).eq('id', row.id)
          if (updErr) console.warn(`  ✗ zápis do DB selhal (${row.id}): ${updErr.message}`)
        }
      }
    }
    from += PAGE
  }
  console.log(`catches: ${touched} záznamů ${DRY_RUN ? 'by appka doplnila' : 'doplněno'}`)
}

async function processBaitsCatalog() {
  console.log('\n--- baits (katalog nástrah) ---')
  const { data: rows, error } = await supabase.from('baits').select('id, photo_url, photo_thumb_url')
  if (error) throw error
  let touched = 0
  for (const row of rows || []) {
    if (!row.photo_url || row.photo_thumb_url) continue
    const thumbUrl = await makeThumbForUrl(row.photo_url)
    if (!thumbUrl) continue
    touched++
    console.log(`  nástraha ${row.id}: photo_thumb_url`)
    if (!DRY_RUN) {
      const { error: updErr } = await supabase.from('baits').update({ photo_thumb_url: thumbUrl }).eq('id', row.id)
      if (updErr) console.warn(`  ✗ zápis do DB selhal (${row.id}): ${updErr.message}`)
    }
  }
  console.log(`baits: ${touched} záznamů ${DRY_RUN ? 'by appka doplnila' : 'doplněno'}`)
}

async function processRods() {
  console.log('\n--- rods (nástrahy navázané na konkrétní prut výpravy) ---')
  let from = 0
  const PAGE = 200
  let touched = 0
  while (true) {
    const { data: rows, error } = await supabase
      .from('rods')
      .select('id, baits')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!rows || rows.length === 0) break

    for (const row of rows) {
      const baits = row.baits
      if (!Array.isArray(baits) || baits.length === 0) continue
      let changed = false
      const newBaits = []
      for (const b of baits) {
        if (b && b.photo_url && !b.photo_thumb_url) {
          const thumbUrl = await makeThumbForUrl(b.photo_url)
          if (thumbUrl) { changed = true; newBaits.push({ ...b, photo_thumb_url: thumbUrl }); continue }
        }
        newBaits.push(b)
      }
      if (changed) {
        touched++
        console.log(`  prut ${row.id}: doplněny náhledy nástrah`)
        if (!DRY_RUN) {
          const { error: updErr } = await supabase.from('rods').update({ baits: newBaits }).eq('id', row.id)
          if (updErr) console.warn(`  ✗ zápis do DB selhal (${row.id}): ${updErr.message}`)
        }
      }
    }
    from += PAGE
  }
  console.log(`rods: ${touched} záznamů ${DRY_RUN ? 'by appka doplnila' : 'doplněno'}`)
}

console.log(DRY_RUN ? '=== SUCHÝ BĚH (nic se nezapíše) ===' : '=== NAOSTRO (appka zapisuje doopravdy) ===')
await processCatches()
await processBaitsCatalog()
await processRods()
console.log('\nHotovo.')
