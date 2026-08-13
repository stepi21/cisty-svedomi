import { useState } from 'react'

export default function BaitPicker({ value, category, catalog, onChange, onAddBait, placeholder }) {
  const [open, setOpen] = useState(false)
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  const options = catalog
    .filter((b) => !category || b.category === category)
    .sort((a, b) => a.name.localeCompare(b.name))

  function pick(name) {
    onChange(name)
    setOpen(false)
    setAddingNew(false)
    setNewName('')
  }

  async function handleAddNew() {
    if (!newName.trim()) return
    setBusy(true)
    const created = await onAddBait(newName.trim(), category || 'dravec')
    setBusy(false)
    pick(created?.name || newName.trim())
  }

  return (
    <>
      <button
        type="button"
        className="text-input bait-picker-btn"
        onClick={() => { setOpen(true); setAddingNew(false) }}
      >
        <span>{value || placeholder || 'Vyber nástrahu'}</span>
        <span className="bait-picker-chevron">▾</span>
      </button>

      {open && (
        <div className="modal-bg show bait-picker-modal" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="ticket" style={{ maxWidth: 360 }}>
            <div className="ticket-top">
              <button type="button" className="ticket-close" onClick={() => setOpen(false)}>✕</button>
              <div className="eyebrow">Nástraha</div>
              <h2>{addingNew ? 'Nová nástraha' : 'Vyber nástrahu'}</h2>
            </div>
            <div className="perforation"></div>
            <div className="ticket-body">
              {!addingNew ? (
                <>
                  <div className="bait-picker-modal-list">
                    {options.length === 0 && (
                      <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Katalog je zatím prázdný.</p>
                    )}
                    {options.map((b) => (
                      <div key={b.id} className="bait-picker-item" onClick={() => pick(b.name)}>
                        {b.photo_url && <img src={b.photo_url} alt="" className="bait-thumb" />}
                        <span>{b.name}</span>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="new-btn" onClick={() => setAddingNew(true)} style={{ marginTop: 12 }}>+ Nová nástraha</button>
                </>
              ) : (
                <div>
                  <label className="field-label">Název nové nástrahy</label>
                  <input
                    className="text-input" autoFocus value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddNew() } }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button type="button" className="new-btn" onClick={() => setAddingNew(false)}>Zpět</button>
                    <button type="button" className="btn-primary" style={{ margin: 0 }} onClick={handleAddNew} disabled={busy}>
                      {busy ? 'Ukládám…' : 'Přidat a vybrat'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
