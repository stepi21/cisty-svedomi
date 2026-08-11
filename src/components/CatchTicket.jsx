import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { uploadPhoto } from '../lib/storage.js'
import { moonPhaseName } from '../lib/weather.js'

const CATEGORY_COLOR = { dravec: '#1F4E5F', bila: '#D9A054' }

const fishSVG = (color) => `
  <svg viewBox="0 0 64 34" xmlns="http://www.w3.org/2000/svg">
    <path d="M4,17 C4,8 18,3 32,3 C46,3 58,9 60,17 C58,25 46,31 32,31 C18,31 4,26 4,17 Z" fill="${color}"/>
    <path d="M4,17 L-6,8 L-6,26 Z" fill="${color}"/>
    <circle cx="46" cy="14" r="2.3" fill="#1a1a1a"/>
  </svg>`

function toLocalTimeInput(isoString) {
  const d = new Date(isoString)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export default function CatchTicket({ catchData: c, session, catcherName, onClose, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    species: c.species, category: c.category, revir: c.revir || '',
    length_cm: c.length_cm ?? '', weight_kg: c.weight_kg ?? '', bait: c.bait ?? '',
    time: c.caught_at ? toLocalTimeInput(c.caught_at) : '',
    photoFile: null, baitPhotoFile: null,
  })
  const color = CATEGORY_COLOR[c.category]

  async function handleSave(e) {
    e.preventDefault()
    setBusy(true)
    let photo_url = c.photo_url
    if (form.photoFile) {
      const url = await uploadPhoto(form.photoFile, `catches/${c.session_id}`)
      if (url) photo_url = url
    }
    let bait_photo_url = c.bait_photo_url
    if (form.baitPhotoFile) {
      const url = await uploadPhoto(form.baitPhotoFile, `catches/${c.session_id}`)
      if (url) bait_photo_url = url
    }
    const sessionDate = session?.session_date || (c.caught_at ? c.caught_at.slice(0, 10) : null)
    const caught_at = form.time && sessionDate
      ? new Date(`${sessionDate}T${form.time}:00`).toISOString()
      : c.caught_at
    const { error } = await supabase.from('catches').update({
      species: form.species, category: form.category, revir: form.revir || null,
      length_cm: form.length_cm || null, weight_kg: form.weight_kg || null,
      bait: form.bait, photo_url, bait_photo_url, caught_at,
    }).eq('id', c.id)
    setBusy(false)
    if (error) { alert(error.message); return }
    setEditing(false)
    onUpdated()
  }

  async function handleDelete() {
    if (!window.confirm('Opravdu smazat tento úlovek? Nedá se to vrátit zpět.')) return
    setBusy(true)
    const { error } = await supabase.from('catches').delete().eq('id', c.id)
    setBusy(false)
    if (error) { alert(error.message); return }
    onDeleted()
  }

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ticket">
        <div className="ticket-top">
          <button className="ticket-close" onClick={onClose}>✕</button>
          <div className="eyebrow">Úlovkový lístek</div>
          <h2>{c.species}</h2>
          {catcherName && <div className="catcher-sub">Chytil: {catcherName}</div>}
        </div>
        <div className="perforation"></div>
        <div className="ticket-body">
          {!editing ? (
            <>
              <div className="ticket-illustration">
                {c.photo_url
                  ? <img src={c.photo_url} alt={c.species} className="catch-photo" />
                  : <div style={{ width: 120 }} dangerouslySetInnerHTML={{ __html: fishSVG(color) }} />}
              </div>
              <div className="ticket-stats">
                <div className="stat"><div className="num">{c.length_cm ?? '—'} cm</div><div className="lab">délka</div></div>
                <div className="stat"><div className="num">{c.weight_kg ?? '—'} kg</div><div className="lab">váha</div></div>
              </div>
              {c.revir && <div className="ticket-line"><span className="lab">Revír</span><span className="val">{c.revir}</span></div>}
              <div className="ticket-line"><span className="lab">Nástraha</span><span className="val">{c.bait || '—'}</span></div>
              {c.bait_photo_url && (
                <div className="ticket-illustration" style={{ marginTop: 6 }}>
                  <img src={c.bait_photo_url} alt="nástraha" style={{ maxHeight: 90, borderRadius: 8 }} />
                </div>
              )}
              <div className="ticket-line"><span className="lab">Čas úlovku</span><span className="val">{c.caught_at ? new Date(c.caught_at).toLocaleTimeString('cs-CZ') : '—'}</span></div>
              <div className="ticket-line"><span className="lab">Lokace</span><span className="val">{c.lat?.toFixed(4)}, {c.lng?.toFixed(4)}</span></div>
              {session && <div className="ticket-line"><span className="lab">Výprava</span><span className="val" style={{ fontFamily: 'inherit', fontWeight: 600 }}>{session.title}</span></div>}
              {session && (
                <div className="conditions-strip">
                  <span className="cond-chip">📅 {session.session_date}</span>
                  <span className="cond-chip">🌡 {session.weather_temp_c ?? '—'}°C</span>
                  <span className="cond-chip">📊 {session.weather_pressure_hpa ?? '—'} hPa</span>
                  <span className="cond-chip">💨 {session.weather_wind || '—'}</span>
                  <span className="cond-chip">🌙 {moonPhaseName(session.session_date)}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="new-btn" onClick={() => setEditing(true)}>✏️ Upravit</button>
                <button className="new-btn danger-btn" onClick={handleDelete} disabled={busy}>🗑 Smazat</button>
              </div>
            </>
          ) : (
            <form onSubmit={handleSave}>
              <label className="field-label">Druh ryby</label>
              <input className="text-input" required value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })} />
              <label className="field-label">Revír / lokalita</label>
              <input className="text-input" value={form.revir} onChange={(e) => setForm({ ...form, revir: e.target.value })} placeholder="např. Labe 19" />
              <label className="field-label">Kategorie</label>
              <select className="text-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="dravec">Dravec</option>
                <option value="bila">Bílá ryba</option>
              </select>
              <div className="input-row">
                <div>
                  <label className="field-label">Délka (cm)</label>
                  <input className="text-input" type="number" value={form.length_cm} onChange={(e) => setForm({ ...form, length_cm: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Váha (kg)</label>
                  <input className="text-input" type="number" step="0.1" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Čas</label>
                  <input className="text-input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                </div>
              </div>
              <label className="field-label">Nástraha</label>
              <input className="text-input" value={form.bait} onChange={(e) => setForm({ ...form, bait: e.target.value })} />
              <label className="photo-label" style={{ display: 'inline-block', marginTop: 4 }}>
                📷 {form.baitPhotoFile ? form.baitPhotoFile.name : (c.bait_photo_url ? 'změnit foto nástrahy' : 'foto nástrahy')}
                <input type="file" accept="image/*" hidden onChange={(e) => setForm({ ...form, baitPhotoFile: e.target.files[0] })} />
              </label>
              <br />
              <label className="field-label">Foto úlovku</label>
              <label className="photo-label" style={{ display: 'inline-block', marginTop: 4 }}>
                📷 {form.photoFile ? form.photoFile.name : (c.photo_url ? 'změnit foto' : 'vybrat foto')}
                <input type="file" accept="image/*" hidden onChange={(e) => setForm({ ...form, photoFile: e.target.files[0] })} />
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button className="new-btn" type="button" onClick={() => setEditing(false)}>Zrušit</button>
                <button className="btn-primary" style={{ margin: 0 }} type="submit" disabled={busy}>{busy ? 'Ukládám…' : 'Uložit změny'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
