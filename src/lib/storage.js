import { supabase } from '../supabaseClient'

// Appka fotky z mobilu dřív nahrávala v plné velikosti, jak je vyfotil
// fotoaparát (běžně 3-8 MB) -- appka je zmenšovala jen kosmeticky, přes
// CSS, na desítky až stovky pixelů (bait-thumb 28px, feed-card-photo pár
// set pixelů, galerie podobně). Stahovat takhle velký soubor jen pro
// zmenšenou dlaždici je zbytečné a je to hlavní důvod, proč appka na
// Domů/Úlovcích (kde appka na obrazovku najednou natáhne víc fotek)
// působí extrémně pomalá, obzvlášť na horším mobilním připojení.
// Appka teď fotku před nahráním zmenší a zkomprimuje přes canvas --
// max. delší strana 1600px (dost i pro fullscreen zoom na mobilu/
// desktopu, viz CatchTicket "zoom-in") a JPEG kvalita 0.82. Běžná fotka
// z mobilu tak z několika MB klesne typicky na pár set kB.
const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.82

async function resizeImage(file) {
  // Appka se pokusí zmenšit jen skutečné obrázky (ne třeba HEIC appka
  // ještě neumí přes canvas přečíst ve všech prohlížečích) -- pokud
  // cokoli selže, appka to tiše přeskočí a nahraje originál, ať appka
  // fotku vůbec nezablokuje jen kvůli optimalizaci.
  if (!file.type || !file.type.startsWith('image/') || file.type === 'image/svg+xml') return file

  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
    // Appka soubor nezmenšuje, pokud je už menší/stejný -- ať appka
    // zbytečně nezhoršuje kvalitu malých fotek, jen je znovu zabalí.
    if (scale >= 1 && file.size < 1.5 * 1024 * 1024) { bitmap.close?.(); return file }

    const targetW = Math.round(width * scale)
    const targetH = Math.round(height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, targetW, targetH)
    bitmap.close?.()

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob) return file
    // Appka ponechá appce nový, menší soubor jako "stejnojmenný" JPEG --
    // appka si jméno souboru (kvůli příponě) stejně jen odvozuje níž.
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

export async function uploadPhoto(file, folder) {
  const optimized = await resizeImage(file)
  const ext = optimized.name.split('.').pop()
  const path = `${folder}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('photos').upload(path, optimized)
  if (error) { alert('Nahrání fotky selhalo: ' + error.message); return null }
  const { data } = supabase.storage.from('photos').getPublicUrl(path)
  return data.publicUrl
}
