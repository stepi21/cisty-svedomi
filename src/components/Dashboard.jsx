import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { supabase } from '../supabaseClient'
import CatchTicket from './CatchTicket.jsx'

const iconCarp = `<svg viewBox="0 0 24 24" fill="none"><path d="M3 12c0-4 5-7 10-7s8 3 8 7-3 7-8 7-10-3-10-7Z" stroke="#2C6E71" stroke-width="1.6"/><circle cx="16" cy="10.5" r="1" fill="#2C6E71"/></svg>`
const iconSpin = `<svg viewBox="0 0 24 24" fill="none"><path d="M4 20 L18 6" stroke="#6B7A4F" stroke-width="1.8"/><circle cx="4" cy="20" r="2" stroke="#6B7A4F" stroke-width="1.6"/><path d="M18 6 l3 -1 -1 3" stroke="#6B7A4F" stroke-width="1.6"/></svg>`
const fishSVG = (color) => `
  <svg viewBox="0 0 64 34" xmlns="http://www.w3.org/2000/svg">
    <path d="M4,17 C4,8 18,3 32,3 C46,3 58,9 60,17 C58,25 46,31 32,31 C18,31 4,26 4,17 Z" fill="${color}"/>
    <path d="M4,17 L-6,8 L-6,26 Z" fill="${color}"/>
    <circle cx="46" cy="14" r="2.3" fill="#1a1a1a"/>
  </svg>`
const rodColors = ['#2C6E71', '#B97F35', '#6B7A4F', '#D9A054']

export default function Dashboard({ groupId, userId, profile, onSignOut }) {
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [showCatchForm, setShowCatchForm] = useState(false)
  const [pendingCoords, setPendingCoords] = useState(null)
  const [clickMode, setClickMode] = useState(null) // 'session' | 'catch' | null
  const [ticketCatch, setTicketCatch] = useState(null)
  const [inviteInfo, setInviteInfo] = useState(null)

  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markersLayer = useRef(null)

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

  // --- init map once ---
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return
    const map = L.map(mapRef.current).setView([49.8, 15.5], 8)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'Podklad: OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)
    markersLayer.current = L.layerGroup().addTo(map)
    map.on('click', (e) => {
      setPendingCoords((prev) => {
        if (!clickModeRef.current) return prev
        return { lat: e.latlng.lat, lng: e.latlng.lng }
      })
    })
    mapInstance.current = map
    return () => { map.remove(); mapInstance.current = null }
  }, [])

  // keep a ref of clickMode so the map click handler (registered once) can read latest value
  const clickModeRef = useRef(null)
  useEffect(() => { clickModeRef.current = clickMode }, [clickMode])

  // --- render markers whenever active session / filter changes ---
  useEffect(() => {
    if (!mapInstance.current || !markersLayer.current) return
    markersLayer.current.clearLayers()
    if (!activeSession) return

    const map = mapInstance.current
    map.setView([activeSession.lat, activeSession.lng], 14)

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

    if (pendingCoords && (clickMode === 'session' || clickMode === 'catch')) {
      L.marker([pendingCoords.lat, pendingCoords.lng], {
        opacity: 0.85,
      }).bindPopup('Nová pozice').addTo(markersLayer.current).openPopup()
    }
  }, [activeSession, activeCategory, pendingCoords, clickMode])

  async function createInvite() {
    const { data, error } = await supabase
      .from('group_invites')
      .insert({ group_id: groupId, created_by: userId })
      .select()
      .single()
    if (!error) setInviteInfo(data)
  }

  function startAddSession() {
    setClickMode('session')
    setPendingCoords(null)
    setShowSessionForm(true)
  }

  function startAddCatch() {
    setClickMode('catch')
    setPendingCoords({ lat: activeSession.lat, lng: activeSession.lng })
    setShowCatchForm(true)
  }

  const visibleSessions = sessions.filter((s) => {
    if (activeCategory === 'all') return true
    return filteredCatches(s).length > 0
  })

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
            <button className="new-btn" onClick={startAddSession}>+ nová výprava</button>
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
          <div ref={mapRef} id="map" />
          {activeSession && (
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
                  <div className="rod-row" key={r.id}>
                    <div className="rod-dot" style={{ background: rodColors[i % rodColors.length] }} />
                    <div className="rod-name">{r.name}</div>
                    <div className="rod-bait">{r.bait}</div>
                  </div>
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

      {showSessionForm && (
        <SessionFormModal
          groupId={groupId}
          userId={userId}
          pendingCoords={pendingCoords}
          onClose={() => { setShowSessionForm(false); setClickMode(null); setPendingCoords(null) }}
          onCreated={(id) => { setShowSessionForm(false); setClickMode(null); setPendingCoords(null); loadSessions(); setActiveId(id) }}
        />
      )}

      {showCatchForm && activeSession && (
        <CatchFormModal
          session={activeSession}
          groupId={groupId}
          pendingCoords={pendingCoords}
          onClose={() => { setShowCatchForm(false); setClickMode(null) }}
          onCreated={() => { setShowCatchForm(false); setClickMode(null); loadSessions() }}
        />
      )}

      {ticketCatch && (
        <CatchTicket catchData={ticketCatch} session={activeSession} onClose={() => setTicketCatch(null)} />
      )}
    </div>
  )
}

function SessionFormModal({ groupId, userId, pendingCoords, onClose, onCreated }) {
  const [type, setType] = useState('kapr')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [timeFrom, setTimeFrom] = useState('')
  const [timeTo, setTimeTo] = useState('')
  const [temp, setTemp] = useState('')
  const [pressure, setPressure] = useState('')
  const [wind, setWind] = useState('')
  const [desc, setDesc] = useState('')
  const [rods, setRods] = useState([{ name: 'Prut 1', bait: '' }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  function addRod() { setRods([...rods, { name: `Prut ${rods.length + 1}`, bait: '' }]) }
  function updateRod(i, field, value) {
    const next = [...rods]; next[i][field] = value; setRods(next)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!pendingCoords) { setError('Klikni nejdřív na mapu, ať víme, kde jsi chytal.'); return }
    setBusy(true)
    setError(null)
    const { data: session, error: sErr } = await supabase
      .from('sessions')
      .insert({
        group_id: groupId, user_id: userId, type, title,
        session_date: date, time_from: timeFrom || null, time_to: timeTo || null,
        lat: pendingCoords.lat, lng: pendingCoords.lng,
        weather_temp_c: temp || null, weather_pressure_hpa: pressure || null,
        weather_wind: wind || null, weather_desc: desc || null,
      }).select().single()
    if (sErr) { setBusy(false); setError(sErr.message); return }

    const rodRows = rods.filter((r) => r.name).map((r, i) => ({
      session_id: session.id, group_id: groupId, name: r.name, bait: r.bait,
      lat: pendingCoords.lat + i * 0.0003, lng: pendingCoords.lng + i * 0.0002,
    }))
    if (rodRows.length) await supabase.from('rods').insert(rodRows)

    setBusy(false)
    onCreated(session.id)
  }

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ticket" style={{ maxWidth: 460 }}>
        <div className="ticket-top">
          <button className="ticket-close" onClick={onClose}>✕</button>
          <div className="eyebrow">Nová výprava</div>
          <h2>Zápis do deníku</h2>
        </div>
        <div className="perforation"></div>
        <div className="ticket-body">
          <form onSubmit={handleSubmit}>
            <p className="hint-text">
              {pendingCoords ? `Pozice: ${pendingCoords.lat.toFixed(4)}, ${pendingCoords.lng.toFixed(4)}` : 'Klikni na mapu pod tímto oknem, ať nastavíme pozici.'}
            </p>
            <label className="field-label">Typ</label>
            <select className="text-input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="kapr">Kapři</option>
              <option value="privlac">Přívlač</option>
              <option value="muska">Muška</option>
              <option value="plavana">Plavaná</option>
              <option value="jine">Jiné</option>
            </select>
            <label className="field-label">Název výpravy</label>
            <input className="text-input" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="např. Orlík — zátoka pod hrází" />
            <div className="input-row">
              <div>
                <label className="field-label">Datum</label>
                <input className="text-input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Od</label>
                <input className="text-input" type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Do</label>
                <input className="text-input" type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} />
              </div>
            </div>
            <div className="input-row">
              <div>
                <label className="field-label">Teplota °C</label>
                <input className="text-input" type="number" value={temp} onChange={(e) => setTemp(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Tlak hPa</label>
                <input className="text-input" type="number" value={pressure} onChange={(e) => setPressure(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Vítr</label>
                <input className="text-input" value={wind} onChange={(e) => setWind(e.target.value)} placeholder="3 m/s SV" />
              </div>
            </div>
            <label className="field-label">Popis počasí</label>
            <input className="text-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="jasno, ráno mlha" />

            <label className="field-label">Pruty</label>
            {rods.map((r, i) => (
              <div className="input-row" key={i}>
                <input className="text-input" value={r.name} onChange={(e) => updateRod(i, 'name', e.target.value)} placeholder="Prut 1" />
                <input className="text-input" value={r.bait} onChange={(e) => updateRod(i, 'bait', e.target.value)} placeholder="nástraha" style={{ gridColumn: 'span 2' }} />
              </div>
            ))}
            <button type="button" className="new-btn" onClick={addRod} style={{ marginBottom: 12 }}>+ další prut</button>

            {error && <p className="error-text">{error}</p>}
            <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Ukládám…' : 'Uložit výpravu'}</button>
          </form>
        </div>
      </div>
    </div>
  )
}

function CatchFormModal({ session, groupId, pendingCoords, onClose, onCreated }) {
  const [species, setSpecies] = useState('')
  const [category, setCategory] = useState('dravec')
  const [length, setLength] = useState('')
  const [weight, setWeight] = useState('')
  const [bait, setBait] = useState('')
  const [rodId, setRodId] = useState('')
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const caughtAt = time ? `${session.session_date}T${time}:00` : null
    const { error } = await supabase.from('catches').insert({
      session_id: session.id, group_id: groupId, rod_id: rodId || null,
      species, category, length_cm: length || null, weight_kg: weight || null,
      bait, caught_at: caughtAt,
      lat: pendingCoords?.lat ?? session.lat, lng: pendingCoords?.lng ?? session.lng,
    })
    setBusy(false)
    if (error) { setError(error.message); return }
    onCreated()
  }

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ticket" style={{ maxWidth: 420 }}>
        <div className="ticket-top">
          <button className="ticket-close" onClick={onClose}>✕</button>
          <div className="eyebrow">Nový úlovek</div>
          <h2>Zapsat rybu</h2>
        </div>
        <div className="perforation"></div>
        <div className="ticket-body">
          <form onSubmit={handleSubmit}>
            <p className="hint-text">Klidně klikni na mapu pro přesnější pozici úlovku (jinak se použije pozice výpravy).</p>
            <label className="field-label">Druh ryby</label>
            <input className="text-input" required value={species} onChange={(e) => setSpecies(e.target.value)} placeholder="Kapr obecný" />
            <label className="field-label">Kategorie</label>
            <select className="text-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="dravec">Dravec</option>
              <option value="bila">Bílá ryba</option>
            </select>
            <div className="input-row">
              <div>
                <label className="field-label">Délka (cm)</label>
                <input className="text-input" type="number" value={length} onChange={(e) => setLength(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Váha (kg)</label>
                <input className="text-input" type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Čas</label>
                <input className="text-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
            <label className="field-label">Nástraha</label>
            <input className="text-input" value={bait} onChange={(e) => setBait(e.target.value)} placeholder="boilie tuňák 20mm" />
            {session.rods && session.rods.length > 0 && (
              <>
                <label className="field-label">Prut</label>
                <select className="text-input" value={rodId} onChange={(e) => setRodId(e.target.value)}>
                  <option value="">— nevybráno —</option>
                  {session.rods.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </>
            )}
            {error && <p className="error-text">{error}</p>}
            <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Ukládám…' : 'Uložit úlovek'}</button>
          </form>
        </div>
      </div>
    </div>
  )
}
