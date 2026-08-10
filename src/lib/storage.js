import { supabase } from '../supabaseClient'

export async function uploadPhoto(file, folder) {
  const ext = file.name.split('.').pop()
  const path = `${folder}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('photos').upload(path, file)
  if (error) { alert('Nahrání fotky selhalo: ' + error.message); return null }
  const { data } = supabase.storage.from('photos').getPublicUrl(path)
  return data.publicUrl
}
