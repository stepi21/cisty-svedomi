import { useState } from 'react'

export default function LocationsModal({ locations, userId, onUpdate, onDelete, onClose, onAddArea, onAddPoint }) {
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(false)
  const [choosingNew, setChoosingNew] = useState(false)

  const selected = locations.find((l) => l.id === selectedId)
  const areaLocations = locations.filter((l) => l.area).sort((a, b) => a.name.localeCompare(b.name))
  const pointLocations = locations.filter((l) => !l.area).sort((a, b) => a.name.localeCompare(b.name))

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

    return (
      <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="ticket" style={{ maxWidth: 400 }}>
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
              {canEdit && (
                <button
                  className="new-btn danger-btn"
                  onClick={() => { if (window.confirm(`Smazat místo "${selected.name}" z katalogu?`)) { onDelete(selected.id); setSelectedId(null) } }}
                >🗑 Smazat</button>
              )}
            </div>
            {selected.revir && <p className="hint-text">Revír: {selected.revir}</p>}
            <p className="hint-text">
              {selected.area ? `Uložená oblast (${selected.area.length} ploch)` : 'Orientační bod (jen pro přiblížení mapy)'}
            </p>
            {!canEdit && <p className="help-note" style={{ marginTop: 8 }}>Toto místo přidal jiný člen party — upravit nebo smazat ho může jen on.</p>}
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
            Nová místa přidáš přímo tady, nebo tlačítkem "📌 Uložit toto místo do katalogu" u výpravy. Obojí (oblast i bod) jde použít u jakéhokoli typu výpravy — jen u přívlače se oblast rovnou vykreslí, jinde slouží k přiblížení mapy.
          </p>
          {!choosingNew ? (
            <button className="new-btn" onClick={() => setChoosingNew(true)} style={{ marginBottom: 14 }}>+ Přidat místo</button>
          ) : (
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              <button className="new-btn" onClick={onAddArea}>🎯 Oblast (vyšrafovaná plocha)</button>
              <button className="new-btn" onClick={onAddPoint}>📍 Jen orientační bod</button>
              <button className="new-btn" onClick={() => setChoosingNew(false)}>Zrušit</button>
            </div>
          )}

          <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 15, margin: '0 0 6px' }}>Oblasti (vyšrafovaná plocha)</h3>
          {areaLocations.length === 0 && <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Zatím žádná.</p>}
          {areaLocations.map((l) => (
            <div key={l.id} className="record-row" onClick={() => setSelectedId(l.id)}>
              <div className="record-head"><strong>{l.name}</strong></div>
              {l.revir && <div className="c-sub">{l.revir}</div>}
            </div>
          ))}

          <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 15, margin: '18px 0 6px' }}>Body (jen orientační)</h3>
          {pointLocations.length === 0 && <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Zatím žádný.</p>}
          {pointLocations.map((l) => (
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
