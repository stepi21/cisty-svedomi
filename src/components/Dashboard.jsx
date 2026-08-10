import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { supabase } from '../supabaseClient'
import CatchTicket from './CatchTicket.jsx'
import { fetchWeather } from '../lib/weather.js'
import { uploadPhoto } from '../lib/storage.js'

const iconCarp = `<svg viewBox="0 0 24 24" fill="none"><path d="M3 12c0-4 5-7 10-7s8 3 8 7-3 7-8 7-10-3-10-7Z" stroke="#2C6E71" stroke-width="1.6"/><circle cx="16" cy="10.5" r="1" fill="#2C6E71"/></svg>`
const iconSpin = `<svg viewBox="0 0 24 24" fill="none"><path d="M4 20 L18 6" stroke="#6B7A4F" stroke-width="1.8"/><circle cx="4" cy="20" r="2" stroke="#6B7A4F" stroke-width="1.6"/><path d="M18 6 l3 -1 -1 3" stroke="#6B7A4F" stroke-width="1.6"/></svg>`
const fishSVG = (color) => `
  <svg viewBox="0 0 64 34" xmlns="http://www.w3.org/2000/svg">
    <path d="M4,17 C4,8 18,3 32,3 C46,3 58,9 60,17 C58,25 46,31 32,31 C18,31 4,26 4,17 Z" fill="${color}"/>
    <path d="M4,17 L-6,8 L-6,26 Z" fill="${color}"/>
    <circle cx="46" cy="14" r="2.3" fill="#1a1a1a"/>
  </svg>`
const rodColors = ['#2C6E71', '#B97F35', '#6B7A4F', '#D9A054']
const SESSION_TYPES = [
  { value: 'kapr', label: 'Kapři (bod)' },
  { value: 'privlac', label: 'Přívlač (oblast)' },
  { value: 'muska', label: 'Muška (bod)' },
  { value: 'plavana', label: 'Plavaná (bod)' },
  { value: 'jine', label: 'Jiné (bod)' },
]
const AREA_TYPES = ['privlac'] // typy, kde se místo bodu kreslí oblast

export default function Dashboard({ groupId, userId, profile, onSignOut }) {
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [ticketCatch, setTicketCatch] = useState(null)
  const [inviteInfo, setInviteInfo] = useState(null)

  // --- flow state pro vytváření nové výpravy ---
  const [pickingType, setPickingType] = useState(false)         // ukazuje mini panel "jaký typ?"
  const [areaDraft, setAreaDraft] = useState(null)               // {points:[]} během kreslení oblasti
  const [placementTarget, setPlacementTarget] = useState(null)   // 'session-point' | 'area-point' | 'rod-<i>' | 'catch-point'
  const [draftSession, setDraftSession] = useState(null)         // otevřený formulář nové výpravy
  const [draftCatch, setDraftCatch] = useState(null)             // otevřený formulář nového úlovku
  const [catchChoosing, setCatchChoosing] = useState(false)      // mini panel "na jaké pozici?"
  const [editingRodId, setEditingRodId] = useState(null)         // id prutu, co se právě edituje inline

  const placementTargetRef = useRef(null)
  useEffect(() => { placementTargetRef.current = placementTarget }, [placementTarget])

  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markersLayer = useRef(null)
  const draftLayer = useRef(null)

  useEffect(() => { loadSessions() }, [groupId])

  async function loadSessions() {
    setLoading(true)
    const { data, error } = await supabase
      .from('sessions')
      .select('*, rods(*), catches(*)')
      .eq('group_id', groupId)
      .order('session_date', { ascending: false })
    if (!error) {
      setSessions(data)
      if (data.length && !activeId) setActiveId(data[0].id)
    }
    setLoading(false)
  }

  const activeSession = sessions.find((s) => s.id === activeId) || null

  function filteredCatches(session) {
    if (!session) return []
    if (activeCategory === 'all') return session.catches
    return session.catches.filter((c) => c.category === activeCategory)
  }

  // --- init map jednou ---
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return
    const map = L.map(mapRef.current).setView([49.8, 15.5], 8)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'Podklad: OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)
    markersLayer.current = L.layerGroup().addTo(map)
    draftLayer.current = L.layerGroup().addTo(map)

    map.on('click', (e) => handleMapClick(e.latlng))
    mapInstance.current = map
    return () => { map.remove(); mapInstance.current = null }
  }, [])

  function handleMapClick(latlng) {
    const target = placementTargetRef.current
    if (!target) return
    const point = { lat: latlng.lat, lng: latlng.lng }

    if (target === 'session-point') {
      setPlacementTarget(null)
      setDraftSession({
        type: pendingTypeRef.current,
        title: '', date: '', timeFrom: '', timeTo: '',
        temp: '', pressure: '', wind: '', desc: '',
        point, area: null,
        rods: [{ name: 'Prut 1', bait: '', lat: point.lat, lng: point.lng, baitPhotoFile: null }],
      })
      return
    }

    if (target === 'area-point') {
      setAreaDraft((prev) => ({ points: [...(prev?.points || []), point] }))
      return
    }

    if (target === 'catch-point') {
      setPlacementTarget(null)
      setDraftCatch({ point, species: '', category: 'dravec', length: '', weight: '', bait: '', rodId: '', time: '' })
      return
    }

    if (target.startsWith('rod-')) {
      const idx = Number(target.split('-')[1])
      setDraftSession((prev) => {
        if (!prev) return prev
        const rods = [...prev.rods]
        rods[idx] = { ...rods[idx], lat: point.lat, lng: point.lng }
        return { ...prev, rods }
      })
      setPlacementTarget(null)
      return
    }

    if (target.startsWith('edit-rod-')) {
      const rodId = target.slice('edit-rod-'.length)
      setPlacementTarget(null)
      supabase.from('rods').update({ lat: point.lat, lng: point.lng }).eq('id', rodId).then(({ error }) => {
        if (error) alert(error.message)
        else loadSessions()
      })
      return
    }
  }

  const pendingTypeRef = useRef('kapr')

  // --- kreslení preview polygonu při tvorbě oblasti ---
  useEffect(() => {
    if (!draftLayer.current) return
    draftLayer.current.clearLayers()
    if (areaDraft && areaDraft.points.length) {
      const latlngs = areaDraft.points.map((p) => [p.lat, p.lng])
      if (latlngs.length === 1) {
        L.circleMarker(latlngs[0], { radius: 6, color: '#6B7A4F' }).addTo(draftLayer.current)
      } else {
        L.polyline(latlngs, { color: '#6B7A4F', weight: 3, dashArray: '6 6' }).addTo(draftLayer.current)
        latlngs.forEach((ll) => L.circleMarker(ll, { radius: 5, color: '#6B7A4F', fillOpacity: 1 }).addTo(draftLayer.current))
      }
    }
  }, [areaDraft])

  // --- render markerů pro aktivní výpravu ---
  useEffect(() => {
    if (!mapInstance.current || !markersLayer.current) return
    markersLayer.current.clearLayers()
    if (!activeSession) return

    const map = mapInstance.current
    map.setView([activeSession.lat, activeSession.lng], 14)

    if (activeSession.area && activeSession.area.length > 2) {
      L.polygon(activeSession.area.map((p) => [p.lat, p.lng]), {
        color: '#6B7A4F', weight: 2, fillColor: '#6B7A4F', fillOpacity: 0.12,
      }).addTo(markersLayer.current)
    }

    ;(activeSession.rods || []).forEach((r, i) => {
      const color = rodColors[i % rodColors.length]
      L.circleMarker([r.lat ?? activeSession.lat, r.lng ?? activeSession.lng], {
        radius: 8, color, weight: 2, fillColor: color, fillOpacity: 0.5,
      }).bindPopup(`<b>${r.name}</b><br>${r.bait || ''}`).addTo(markersLayer.current)
    })

    filteredCatches(activeSession).forEach((c) => {
      const color = c.category === 'dravec' ? '#6B7A4F' : '#B97F35'
      const html = `<div style="width:30px;height:30px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)">${fishSVG('#fff')}</div>`
      const icon = L.divIcon({ html, className: '', iconSize: [30, 30], iconAnchor: [15, 15] })
      const marker = L.marker([c.lat ?? activeSession.lat, c.lng ?? activeSession.lng], { icon })
      marker.on('click', () => setTicketCatch(c))
      marker.addTo(markersLayer.current)
    })
  }, [activeSession, activeCategory])

  async function createInvite() {
    const { data, error } = await supabase
      .from('group_invites')
      .insert({ group_id: groupId, created_by: userId })
      .select()
      .single()
    if (!error) setInviteInfo(data)
  }

  // --- začátek tvorby nové výpravy ---
  function startNewSession() { setPickingType(true) }

  function chooseType(type) {
    setPickingType(false)
    pendingTypeRef.current = type
    if (AREA_TYPES.includes(type)) {
      setAreaDraft({ points: [] })
      setPlacementTarget('area-point')
    } else {
      setPlacementTarget('session-point')
    }
  }

  function undoAreaPoint() {
    setAreaDraft((prev) => ({ points: prev.points.slice(0, -1) }))
  }

  function cancelAreaOrPoint() {
    setAreaDraft(null)
    setPlacementTarget(null)
  }

  function finishArea() {
    const points = areaDraft.points
    if (points.length < 3) return
    const centroid = {
      lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
      lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
    }
    setAreaDraft(null)
    setPlacementTarget(null)
    setDraftSession({
      type: pendingTypeRef.current,
      title: '', date: '', timeFrom: '', timeTo: '',
      temp: '', pressure: '', wind: '', desc: '',
      point: centroid, area: points,
      rods: [{ name: 'Prut 1', bait: '', lat: centroid.lat, lng: centroid.lng, baitPhotoFile: null }],
    })
  }

  function startAddCatch() {
    setCatchChoosing(true)
  }

  function chooseCatchOnRod(rod) {
    setCatchChoosing(false)
    setDraftCatch({ point: { lat: rod.lat, lng: rod.lng }, species: '', category: 'dravec', length: '', weight: '', bait: rod.bait || '', rodId: rod.id, time: '' })
  }

  function chooseCatchOnMap() {
    setCatchChoosing(false)
    setPlacementTarget('catch-point')
  }

  async function saveSession() {
    const s = draftSession
    const { data: session, error: sErr } = await supabase
      .from('sessions')
      .insert({
        group_id: groupId, user_id: userId, type: s.type, title: s.title,
        session_date: s.date, time_from: s.timeFrom || null, time_to: s.timeTo || null,
        lat: s.point.lat, lng: s.point.lng, area: s.area,
        weather_temp_c: s.temp || null, weather_pressure_hpa: s.pressure || null,
        weather_wind: s.wind || null, weather_desc: s.desc || null,
      }).select().single()
    if (sErr) { alert(sErr.message); return }

    for (const r of s.rods.filter((r) => r.name)) {
      let bait_photo_url = null
      if (r.baitPhotoFile) {
        bait_photo_url = await uploadPhoto(r.baitPhotoFile, `baits/${session.id}`)
      }
      await supabase.from('rods').insert({
        session_id: session.id, group_id: groupId, name: r.name, bait: r.bait,
        lat: r.lat, lng: r.lng, bait_photo_url,
      })
    }

    setDraftSession(null)
    await loadSessions()
    setActiveId(session.id)
  }

  async function saveCatch() {
    const c = draftCatch
    const session = activeSession
    const caughtAt = c.time && session
      ? new Date(`${session.session_date}T${c.time}:00`).toISOString()
      : null
    const { error } = await supabase.from('catches').insert({
      session_id: session.id, group_id: groupId, rod_id: c.rodId || null,
      species: c.species, category: c.category, length_cm: c.length || null, weight_kg: c.weight || null,
      bait: c.bait, caught_at: caughtAt, lat: c.point.lat, lng: c.point.lng,
    })
    if (error) { alert(error.message); return }
    setDraftCatch(null)
    await loadSessions()
  }

  const visibleSessions = sessions.filter((s) => {
    if (activeCategory === 'all') return true
    return filteredCatches(s).length > 0
  })

  const isPlacingSomething = placementTarget === 'session-point' || placementTarget === 'catch-point' || areaDraft || (placementTarget && (placementTarget.startsWith('rod-') || placementTarget.startsWith('edit-rod-')))

  return (
    <div className="app">
      <header>
        <div className="head-row">
          <h1>Čisté<span className="accent">svědomí</span></h1>
          <div className="head-actions">
            <button className="new-btn" onClick={createInvite}>+ pozvat parťáka</button>
            <button className="new-btn" onClick={onSignOut}>Odhlásit</button>
          </div>
        </div>
        {inviteInfo && (
          <div className="invite-banner">
            Kód pro kamaráda: <strong>{inviteInfo.code}</strong> (platný 7 dní) — ať ho zadá po přihlášení do appky na obrazovce "Mám kód pozvánky".
            <button className="ticket-close" onClick={() => setInviteInfo(null)}>✕</button>
          </div>
        )}
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="sb-head">
            <span>Výpravy</span>
            <button className="new-btn" onClick={startNewSession}>+ nová výprava</button>
          </div>
          <div className="filter-row">
            {['all', 'dravec', 'bila'].map((cat) => (
              <button
                key={cat}
                className={`filter-chip ${activeCategory === cat ? `active ${cat}` : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat === 'all' ? 'Vše' : cat === 'dravec' ? 'Dravci' : 'Bílá ryba'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="loader-text" style={{ padding: 18 }}>Načítám…</div>
          ) : visibleSessions.length === 0 ? (
            <div style={{ padding: '20px 18px', color: 'var(--ink-soft)', fontSize: 13 }}>
              Žádná výprava. Zkus přidat první přes "+ nová výprava".
            </div>
          ) : (
            visibleSessions.map((s) => (
              <div
                key={s.id}
                className={`session-item ${s.id === activeId ? 'active' : ''}`}
                onClick={() => setActiveId(s.id)}
              >
                <div className="s-icon" dangerouslySetInnerHTML={{ __html: s.type === 'kapr' ? iconCarp : iconSpin }} />
                <div className="s-body">
                  <div className="s-title">{s.title}</div>
                  <div className="s-sub">{s.session_date} · {s.time_from}–{s.time_to}</div>
                  <div className="s-tags">
                    <span className="s-tag">{s.type}</span>
                    <span className="s-tag catch">{filteredCatches(s).length} úlovky</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </aside>

        <main>
          <div ref={mapRef} id="map" style={{ cursor: isPlacingSomething ? 'crosshair' : '' }} />

          {pickingType && (
            <div className="type-picker">
              <div className="type-picker-title">Jaký typ výpravy?</div>
              {SESSION_TYPES.map((t) => (
                <button key={t.value} className="type-btn" onClick={() => chooseType(t.value)}>{t.label}</button>
              ))}
              <button className="type-cancel" onClick={() => setPickingType(false)}>Zrušit</button>
            </div>
          )}

          {catchChoosing && activeSession && (
            <div className="type-picker">
              <div className="type-picker-title">Kde jsi rybu chytil?</div>
              {(activeSession.rods || []).map((r) => (
                <button key={r.id} className="type-btn" onClick={() => chooseCatchOnRod(r)}>
                  Na pozici: {r.name}{r.bait ? ` (${r.bait})` : ''}
                </button>
              ))}
              <button className="type-btn" onClick={chooseCatchOnMap}>📍 Kliknout na jinou pozici mapy</button>
              <button className="type-cancel" onClick={() => setCatchChoosing(false)}>Zrušit</button>
            </div>
          )}

          {placementTarget === 'session-point' && (
            <div className="place-hint">
              Klikni na mapu, kde jsi chytal.
              <button className="ticket-close" onClick={cancelAreaOrPoint}>✕</button>
            </div>
          )}

          {placementTarget === 'catch-point' && (
            <div className="place-hint">
              Klikni na mapu, kde jsi rybu chytil.
              <button className="ticket-close" onClick={() => setPlacementTarget(null)}>✕</button>
            </div>
          )}

          {areaDraft && (
            <div className="place-hint area-hint">
              Klikej podél trasy/oblasti, kde jsi chytal ({areaDraft.points.length} bodů, potřeba aspoň 3).
              <div className="area-controls">
                <button className="new-btn" onClick={undoAreaPoint} disabled={!areaDraft.points.length}>Zpět o bod</button>
                <button className="btn-primary" style={{ margin: 0 }} onClick={finishArea} disabled={areaDraft.points.length < 3}>Dokončit oblast</button>
                <button className="new-btn" onClick={cancelAreaOrPoint}>Zrušit</button>
              </div>
            </div>
          )}

          {placementTarget && (placementTarget.startsWith('rod-') || placementTarget.startsWith('edit-rod-')) && (
            <div className="place-hint">
              Klikni na mapu pro pozici prutu.
              <button className="ticket-close" onClick={() => setPlacementTarget(null)}>✕</button>
            </div>
          )}

          {activeSession && !draftSession && (
            <div className="detail-strip">
              <div className="det-block">
                <h3>Podmínky</h3>
                <div className="weather-row">
                  <div className="w-item"><div className="num">{activeSession.weather_temp_c ?? '—'}°C</div><div className="lab">teplota</div></div>
                  <div className="w-item"><div className="num">{activeSession.weather_pressure_hpa ?? '—'} hPa</div><div className="lab">tlak</div></div>
                  <div className="w-item"><div className="num">{activeSession.weather_wind || '—'}</div><div className="lab">vítr</div></div>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-soft)' }}>{activeSession.weather_desc}</div>
              </div>
              <div className="det-block">
                <h3>Pruty a nástrahy</h3>
                {(activeSession.rods || []).map((r, i) => (
                  editingRodId === r.id ? (
                    <RodEditRow
                      key={r.id}
                      rod={r}
                      color={rodColors[i % rodColors.length]}
                      onArmPosition={() => setPlacementTarget(`edit-rod-${r.id}`)}
                      onDone={() => { setEditingRodId(null); loadSessions() }}
                      onCancel={() => setEditingRodId(null)}
                    />
                  ) : (
                    <div className="rod-row" key={r.id}>
                      <div className="rod-dot" style={{ background: rodColors[i % rodColors.length] }} />
                      <div className="rod-name">{r.name}</div>
                      <div className="rod-bait">{r.bait}</div>
                      {r.bait_photo_url && <img src={r.bait_photo_url} alt="nástraha" className="bait-thumb" />}
                      <button className="new-btn" style={{ marginLeft: 'auto' }} onClick={() => setEditingRodId(r.id)}>✏️</button>
                    </div>
                  )
                ))}
                {(!activeSession.rods || activeSession.rods.length === 0) && (
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Bez prutů</div>
                )}
              </div>
              <div className="det-block">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h3>Úlovky</h3>
                  <button className="new-btn" onClick={startAddCatch}>+ úlovek</button>
                </div>
                <div className="catch-list">
                  {filteredCatches(activeSession).map((c) => (
                    <div className="catch-row" key={c.id} onClick={() => setTicketCatch(c)}>
                      <div className="fish-mini" dangerouslySetInnerHTML={{ __html: fishSVG(c.category === 'dravec' ? '#6B7A4F' : '#B97F35') }} />
                      <div>
                        <div className="c-name">{c.species}</div>
                        <div className="c-sub">{c.length_cm} cm · {c.weight_kg} kg</div>
                      </div>
                    </div>
                  ))}
                  {filteredCatches(activeSession).length === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Žádný úlovek.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {draftSession && (
        <SessionFormPanel
          draft={draftSession}
          setDraft={setDraftSession}
          onArmRod={(i) => setPlacementTarget(`rod-${i}`)}
          onSave={saveSession}
          onClose={() => setDraftSession(null)}
        />
      )}

      {draftCatch && activeSession && (
        <CatchFormPanel
          draft={draftCatch}
          setDraft={setDraftCatch}
          rods={activeSession.rods || []}
          onSave={saveCatch}
          onClose={() => setDraftCatch(null)}
        />
      )}

      {ticketCatch && (
        <CatchTicket catchData={ticketCatch} session={activeSession} onClose={() => setTicketCatch(null)} onUpdated={loadSessions} />
      )}
    </div>
  )
}

function RodEditRow({ rod, color, onArmPosition, onDone, onCancel }) {
  const [name, setName] = useState(rod.name)
  const [bait, setBait] = useState(rod.bait || '')
  const [photoFile, setPhotoFile] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSave() {
    setBusy(true)
    let bait_photo_url = rod.bait_photo_url
    if (photoFile) {
      const url = await uploadPhoto(photoFile, `baits/${rod.session_id}`)
      if (url) bait_photo_url = url
    }
    const { error } = await supabase.from('rods').update({ name, bait, bait_photo_url }).eq('id', rod.id)
    setBusy(false)
    if (error) { alert(error.message); return }
    onDone()
  }

  return (
    <div className="rod-edit-block">
      <div className="input-row">
        <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="text-input" value={bait} onChange={(e) => setBait(e.target.value)} placeholder="nástraha" style={{ gridColumn: 'span 2' }} />
      </div>
      <div className="rod-edit-row">
        <button type="button" className="new-btn" onClick={onArmPosition}>📍 změnit pozici na mapě</button>
        <label className="photo-label">
          📷 {photoFile ? photoFile.name : (rod.bait_photo_url ? 'změnit foto' : 'foto nástrahy')}
          <input type="file" accept="image/*" hidden onChange={(e) => setPhotoFile(e.target.files[0])} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="new-btn" onClick={onCancel}>Zrušit</button>
        <button className="btn-primary" style={{ margin: 0 }} onClick={handleSave} disabled={busy}>{busy ? 'Ukládám…' : 'Uložit'}</button>
      </div>
    </div>
  )
}

function SessionFormPanel({ draft, setDraft, onArmRod, onSave, onClose }) {
  const [busy, setBusy] = useState(false)
  const [weatherBusy, setWeatherBusy] = useState(false)
  const [weatherError, setWeatherError] = useState(null)

  function set(field, value) { setDraft((d) => ({ ...d, [field]: value })) }
  function setRod(i, field, value) {
    setDraft((d) => {
      const rods = [...d.rods]; rods[i] = { ...rods[i], [field]: value }
      return { ...d, rods }
    })
  }
  function addRod() {
    setDraft((d) => ({
      ...d,
      rods: [...d.rods, { name: `Prut ${d.rods.length + 1}`, bait: '', lat: d.point.lat, lng: d.point.lng, baitPhotoFile: null }],
    }))
  }

  async function handleFetchWeather() {
    if (!draft.date) { setWeatherError('Nejdřív vyplň datum.'); return }
    setWeatherBusy(true); setWeatherError(null)
    try {
      const w = await fetchWeather(draft.point.lat, draft.point.lng, draft.date, draft.timeFrom)
      setDraft((d) => ({ ...d, temp: w.temp, pressure: w.pressure, wind: w.wind, desc: w.desc }))
    } catch (e) {
      setWeatherError(e.message)
    }
    setWeatherBusy(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    await onSave()
    setBusy(false)
  }

  return (
    <div className="side-panel">
      <div className="ticket" style={{ maxWidth: 400 }}>
        <div className="ticket-top">
          <button className="ticket-close" onClick={onClose}>✕</button>
          <div className="eyebrow">Nová výprava</div>
          <h2>Zápis do deníku</h2>
        </div>
        <div className="perforation"></div>
        <div className="ticket-body">
          <form onSubmit={handleSubmit}>
            <p className="hint-text">
              {draft.area ? `Oblast: ${draft.area.length} bodů` : `Pozice: ${draft.point.lat.toFixed(4)}, ${draft.point.lng.toFixed(4)}`}
            </p>
            <label className="field-label">Název výpravy</label>
            <input className="text-input" required value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="např. Orlík — zátoka pod hrází" />
            <div className="input-row">
              <div>
                <label className="field-label">Datum</label>
                <input className="text-input" type="date" required value={draft.date} onChange={(e) => set('date', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Od</label>
                <input className="text-input" type="time" value={draft.timeFrom} onChange={(e) => set('timeFrom', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Do</label>
                <input className="text-input" type="time" value={draft.timeTo} onChange={(e) => set('timeTo', e.target.value)} />
              </div>
            </div>

            <button type="button" className="new-btn" onClick={handleFetchWeather} disabled={weatherBusy} style={{ marginTop: 10 }}>
              {weatherBusy ? 'Zjišťuji počasí…' : '🌤 Doplnit počasí automaticky'}
            </button>
            {weatherError && <p className="error-text">{weatherError}</p>}

            <div className="input-row" style={{ marginTop: 10 }}>
              <div>
                <label className="field-label">Teplota °C</label>
                <input className="text-input" type="number" value={draft.temp} onChange={(e) => set('temp', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Tlak hPa</label>
                <input className="text-input" type="number" value={draft.pressure} onChange={(e) => set('pressure', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Vítr</label>
                <input className="text-input" value={draft.wind} onChange={(e) => set('wind', e.target.value)} placeholder="3 m/s SV" />
              </div>
            </div>
            <label className="field-label">Popis počasí</label>
            <input className="text-input" value={draft.desc} onChange={(e) => set('desc', e.target.value)} placeholder="jasno, ráno mlha" />

            <label className="field-label">Pruty</label>
            {draft.rods.map((r, i) => (
              <div key={i} className="rod-edit-block">
                <div className="input-row">
                  <input className="text-input" value={r.name} onChange={(e) => setRod(i, 'name', e.target.value)} placeholder="Prut 1" />
                  <input className="text-input" value={r.bait} onChange={(e) => setRod(i, 'bait', e.target.value)} placeholder="nástraha" style={{ gridColumn: 'span 2' }} />
                </div>
                <div className="rod-edit-row">
                  <button type="button" className="new-btn" onClick={() => onArmRod(i)}>📍 pozice na mapě: {r.lat.toFixed(4)}, {r.lng.toFixed(4)}</button>
                  <label className="photo-label">
                    📷 {r.baitPhotoFile ? r.baitPhotoFile.name : 'foto nástrahy'}
                    <input type="file" accept="image/*" hidden onChange={(e) => setRod(i, 'baitPhotoFile', e.target.files[0])} />
                  </label>
                </div>
              </div>
            ))}
            <button type="button" className="new-btn" onClick={addRod} style={{ marginBottom: 12 }}>+ další prut</button>

            <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Ukládám…' : 'Uložit výpravu'}</button>
          </form>
        </div>
      </div>
    </div>
  )
}

function CatchFormPanel({ draft, setDraft, rods, onSave, onClose }) {
  const [busy, setBusy] = useState(false)
  function set(field, value) { setDraft((d) => ({ ...d, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    await onSave()
    setBusy(false)
  }

  return (
    <div className="side-panel">
      <div className="ticket" style={{ maxWidth: 380 }}>
        <div className="ticket-top">
          <button className="ticket-close" onClick={onClose}>✕</button>
          <div className="eyebrow">Nový úlovek</div>
          <h2>Zapsat rybu</h2>
        </div>
        <div className="perforation"></div>
        <div className="ticket-body">
          <form onSubmit={handleSubmit}>
            <p className="hint-text">Pozice: {draft.point.lat.toFixed(4)}, {draft.point.lng.toFixed(4)}</p>
            <label className="field-label">Druh ryby</label>
            <input className="text-input" required value={draft.species} onChange={(e) => set('species', e.target.value)} placeholder="Kapr obecný" />
            <label className="field-label">Kategorie</label>
            <select className="text-input" value={draft.category} onChange={(e) => set('category', e.target.value)}>
              <option value="dravec">Dravec</option>
              <option value="bila">Bílá ryba</option>
            </select>
            <div className="input-row">
              <div>
                <label className="field-label">Délka (cm)</label>
                <input className="text-input" type="number" value={draft.length} onChange={(e) => set('length', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Váha (kg)</label>
                <input className="text-input" type="number" step="0.1" value={draft.weight} onChange={(e) => set('weight', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Čas</label>
                <input className="text-input" type="time" value={draft.time} onChange={(e) => set('time', e.target.value)} />
              </div>
            </div>
            <label className="field-label">Nástraha</label>
            <input className="text-input" value={draft.bait} onChange={(e) => set('bait', e.target.value)} placeholder="boilie tuňák 20mm" />
            {rods.length > 0 && (
              <>
                <label className="field-label">Prut</label>
                <select className="text-input" value={draft.rodId} onChange={(e) => set('rodId', e.target.value)}>
                  <option value="">— nevybráno —</option>
                  {rods.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </>
            )}
            <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Ukládám…' : 'Uložit úlovek'}</button>
          </form>
        </div>
      </div>
    </div>
  )
}
