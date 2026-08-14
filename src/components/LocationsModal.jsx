import { useState, useEffect, useRef } from 'react'
import L from 'leaflet'

const fishSVG = (color) => `
  <svg viewBox="0 0 64 34" xmlns="http://www.w3.org/2000/svg">
    <path d="M4,17 C4,8 18,3 32,3 C46,3 58,9 60,17 C58,25 46,31 32,31 C18,31 4,26 4,17 Z" fill="${color}"/>
    <path d="M4,17 L-6,8 L-6,26 Z" fill="${color}"/>
    <circle cx="46" cy="14" r="2.3" fill="#1a1a1a"/>
  </svg>`
const CATEGORY_COLOR = { dravec: '#5C7A85', bila: '#C4A572' }

export default function LocationsModal({ locations, sessions, userId, initialLocationId, onUpdate, onDelete, onClose, onAddArea, onManageAreas, onOpenCatch, onOpenSession }) {
  const [selectedId, setSelectedId] = useState(initialLocationId || null)
  const [editing, setEditing] = useState(false)

  const selected = locations.find((l) => l.id === selectedId)
  const sorted = [...locations].sort((a, b) => a.name.localeCompare(b.name))

  if (selected) {
    const canEdit = selected.created_by === userId

    if (editing) {
      return (
        <EditLocationForm
          location={selected}
          onCancel={() => setEditing(false)}
          onSaved={async (fields) => { await onUpdate(selected.id, fields); setEditing(false) }}
        />
      )
    }

    const linkedSessions = sessions.filter((s) => (s.session_locations || []).some((sl) => sl.location_id === selected.id))
    const catches = []
    linkedSessions.forEach((s) => {
      ;(s.catches || []).forEach((c) => catches.push({ ...c, sessionRef: s }))
    })
    const sessionsWithoutCatch = linkedSessions.filter((s) => (s.catches || []).length === 0)

    return (
      <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="ticket" style={{ maxWidth: 440 }}>
          <div className="ticket-top">
            <button className="ticket-close" onClick={onClose}>✕</button>
            <div className="eyebrow">Místo</div>
            <h2>{selected.name}</h2>
          </div>
          <div className="perforation"></div>
          <div className="ticket-body">
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <button className="new-btn" onClick={() => setSelectedId(null)}>← Zpět na místa</button>
              {canEdit && <button className="new-btn" onClick={() => setEditing(true)}>✏️ Upravit</button>}
              {canEdit && <button className="new-btn" onClick={() => onManageAreas(selected)}>🗺 Upravit oblasti</button>}
              {canEdit && (
                <button
                  className="new-btn danger-btn"
                  onClick={() => { if (window.confirm(`Smazat místo "${selected.name}" z katalogu?`)) { onDelete(selected.id); setSelectedId(null) } }}
                >🗑 Smazat</button>
              )}
            </div>
            {selected.revir && <p className="hint-text">Revír: {selected.revir}</p>}
            <LocationPreviewMap location={selected} />

            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 14 }}>
              {catches.length === 0 ? 'Zatím na tomto místě nic nechyceno.' : `${catches.length} chycených ryb na tomto místě`}
            </p>
            {catches.length > 0 && (
              <div className="catch-list" style={{ maxHeight: 'none' }}>
                {catches
                  .sort((a, b) => (b.caught_at || b.sessionRef.session_date || '').localeCompare(a.caught_at || a.sessionRef.session_date || ''))
                  .map((c) => (
                    <div key={c.id} className="catch-row" onClick={() => onOpenCatch(c, selected.id)}>
                      <div className="fish-mini" dangerouslySetInnerHTML={{ __html: fishSVG(CATEGORY_COLOR[c.category]) }} />
                      <div>
                        <div className="c-name">{c.species}</div>
                        <div className="c-sub">{c.length_cm ?? '—'} cm · {c.sessionRef.session_date}</div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {sessionsWithoutCatch.length > 0 && (
              <>
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 14 }}>
                  Použito i na těchto výpravách, bez zaznamenaného úlovku:
                </p>
                <div className="catch-list" style={{ maxHeight: 'none' }}>
                  {sessionsWithoutCatch
                    .sort((a, b) => (b.session_date || '').localeCompare(a.session_date || ''))
                    .map((s) => (
                      <div key={s.id} className="record-row" onClick={() => onOpenSession(s.id)}>
                        <div className="record-head"><strong>{s.title}</strong><span className="c-sub">{s.session_date}</span></div>
                      </div>
                    ))}
                </div>
              </>
            )}

            {!canEdit && <p className="help-note" style={{ marginTop: 12 }}>Toto místo přidal jiný člen party — upravit nebo smazat ho může jen on.</p>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ticket" style={{ maxWidth: 400 }}>
        <div className="ticket-top">
          <button className="ticket-close" onClick={onClose}>✕</button>
          <div className="eyebrow">Přehled</div>
          <h2>📍 Revíry</h2>
        </div>
        <div className="perforation"></div>
        <div className="ticket-body">
          <p className="help-note" style={{ marginBottom: 10 }}>
            Nová místa přidáš přímo tady, nebo tlačítkem "📌 Uložit toto místo do katalogu" u výpravy. Použitelné u jakéhokoli typu výpravy — u přívlače se oblast rovnou vykreslí, u ostatních typů jen doplní název/revír a přiblíží mapu.
          </p>
          <button className="new-btn" onClick={onAddArea} style={{ marginBottom: 14 }}>+ Přidat místo</button>

          {sorted.length === 0 && <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Zatím žádné.</p>}
          {sorted.map((l) => (
            <div key={l.id} className="record-row" onClick={() => setSelectedId(l.id)}>
              <div className="record-head"><strong>{l.name}</strong></div>
              {l.revir && <div className="c-sub">{l.revir}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LocationPreviewMap({ location }) {
  const mapEl = useRef(null)
  const mapInst = useRef(null)

  useEffect(() => {
    if (!mapEl.current || !location.area) return
    const map = L.map(mapEl.current, { zoomControl: false, attributionControl: false, dragging: true, scrollWheelZoom: false })
    mapInst.current = map
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
    const bounds = []
    location.area
      .filter((pts) => Array.isArray(pts))
      .map((pts) => pts.filter((p) => p && typeof p.lat === 'number' && typeof p.lng === 'number'))
      .filter((pts) => pts.length >= 3)
      .forEach((pts) => {
        L.polygon(pts.map((p) => [p.lat, p.lng]), { color: '#6B7A4F', weight: 2, fillColor: '#6B7A4F', fillOpacity: 0.18 }).addTo(map)
        pts.forEach((p) => bounds.push([p.lat, p.lng]))
      })
    if (bounds.length) map.fitBounds(bounds, { padding: [24, 24] })
    setTimeout(() => map.invalidateSize(), 50)
    return () => { map.remove(); mapInst.current = null }
  }, [location.id])

  if (!location.area) return null
  return <div ref={mapEl} style={{ width: '100%', height: 200, borderRadius: 10, marginTop: 8, border: '1px solid var(--paper-line)' }} />
}

function EditLocationForm({ location, onCancel, onSaved }) {
  const [name, setName] = useState(location.name)
  const [revir, setRevir] = useState(location.revir || '')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    await onSaved({ name, revir: revir || null })
    setBusy(false)
  }

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="ticket" style={{ maxWidth: 380 }}>
        <div className="ticket-top">
          <button className="ticket-close" onClick={onCancel}>✕</button>
          <div className="eyebrow">Úprava</div>
          <h2>{location.name}</h2>
        </div>
        <div className="perforation"></div>
        <div className="ticket-body">
          <form onSubmit={handleSubmit}>
            <label className="field-label">Název</label>
            <input className="text-input" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            <label className="field-label">Revír</label>
            <input className="text-input" value={revir} onChange={(e) => setRevir(e.target.value)} />
            <button className="btn-primary" type="submit" disabled={busy} style={{ marginTop: 10 }}>{busy ? 'Ukládám…' : 'Uložit'}</button>
          </form>
        </div>
      </div>
    </div>
  )
}
