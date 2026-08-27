import { supabase } from '../supabaseClient'

// Appka fotky z mobilu dřív nahrávala v plné velikosti, jak je vyfotil
// fotoaparát (běžně 3-8 MB) -- appka je zmenšovala jen kosmeticky, přes
// CSS, na desítky až stovky pixelů (bait-thumb 28px, feed-card-photo pár
// set pixelů, galerie podobně). Appka teď při nahrání uloží DVĚ verze:
// plnou (max. 1600px, kvalita 0.82 -- pro fullscreen zoom) a malou
// náhledovou (max. 480px, kvalita 0.65 -- pro dlaždice/mřížky jako
// Domů, Úlovky, galerie). I ta plná verze zmenšená na pár set kB byla
// zbytečně velká na 28-104px dlaždici -- appka na Domů/Úlovcích najednou
// natáhne víc fotek, a i "jen" pár set kB každá se sečte na jednotky MB,
// což na horším mobilním připojení trvá vteřiny. Náhled bývá typicky
// desítky kB.
const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.82
const THUMB_DIMENSION = 480
const THUMB_QUALITY = 0.65

function resizeBitmap(bitmap, maxDim, quality) {
  const { width, height } = bitmap
  const scale = Math.min(1, maxDim / Math.max(width, height))
  const targetW = Math.max(1, Math.round(width * scale))
  const targetH = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, targetW, targetH)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

// Appka z jednoho rozbaleného bitmapu vyrobí obě varianty najednou --
// soubor se tak dekóduje jen jednou. Pokud cokoli selže (např. appka
// narazí na formát, co ještě neumí přes canvas přečíst), appka tiše
// vrátí originál jako "full" a žádný náhled.
async function makeVariants(file) {
  if (!file.type || !file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return { full: file, thumb: null }
  }
  try {
    const bitmap = await createImageBitmap(file)
    const baseName = file.name.replace(/\.\w+$/, '')
    let full = file
    if (bitmap.width > MAX_DIMENSION || bitmap.height > MAX_DIMENSION || file.size >= 1.5 * 1024 * 1024) {
      const fullBlob = await resizeBitmap(bitmap, MAX_DIMENSION, JPEG_QUALITY)
      if (fullBlob) full = new File([fullBlob], baseName + '.jpg', { type: 'image/jpeg' })
    }
    const thumbBlob = await resizeBitmap(bitmap, THUMB_DIMENSION, THUMB_QUALITY)
    bitmap.close?.()
    const thumb = thumbBlob ? new File([thumbBlob], baseName + '-thumb.jpg', { type: 'image/jpeg' }) : null
    return { full, thumb }
  } catch {
    return { full: file, thumb: null }
  }
}

// Appka vrátí { url, thumbUrl } -- thumbUrl je vždy vyplněná (pokud se
// náhled nepodařilo udělat, appka jako thumbUrl vrátí plnou url), ať
// volající kód nemusí chybějící hodnotu řešit zvlášť.
export async function uploadPhoto(file, folder) {
  const { full, thumb } = await makeVariants(file)
  const stamp = Date.now()
  const fullExt = full.name.split('.').pop()
  const fullPath = `${folder}/${stamp}.${fullExt}`
  const { error } = await supabase.storage.from('photos').upload(fullPath, full)
  if (error) { alert('Nahrání fotky selhalo: ' + error.message); return null }
  const url = supabase.storage.from('photos').getPublicUrl(fullPath).data.publicUrl

  let thumbUrl = url
  if (thumb) {
    const thumbPath = `${folder}/${stamp}-thumb.jpg`
    const { error: thumbErr } = await supabase.storage.from('photos').upload(thumbPath, thumb)
    if (!thumbErr) {
      thumbUrl = supabase.storage.from('photos').getPublicUrl(thumbPath).data.publicUrl
    }
  }
  return { url, thumbUrl }
}
