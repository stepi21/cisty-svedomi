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
  }

  async function handleAddNew() {
    if (!newName.trim()) return
    setBusy(true)
    const created = await onAddBait(newName.trim(), category || 'dravec')
    setBusy(false)
    pick(created?.name || newName.trim())
    setNewName('')
  }

  return (
    <div className="bait-picker">
      <button
        type="button"
        className="text-input bait-picker-btn"
        onClick={() => { setOpen((o) => !o); setAddingNew(false) }}
      >
        <span>{value || placeholder || 'Vyber nástrahu'}</span>
        <span className="bait-picker-chevron">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="bait-picker-dropdown">
          {!addingNew ? (
            <>
              <div className="bait-picker-list">
                {options.length === 0 && (
                  <div className="bait-picker-empty">Katalog je zatím prázdný.</div>
                )}
                {options.map((b) => (
                  <div key={b.id} className="bait-picker-item" onClick={() => pick(b.name)}>
                    {b.photo_url && <img src={b.photo_url} alt="" className="bait-thumb" />}
                    <span>{b.name}</span>
                  </div>
                ))}
              </div>
              <div className="bait-picker-item bait-picker-new" onClick={() => setAddingNew(true)}>+ Nová nástraha</div>
            </>
          ) : (
            <div className="bait-picker-add">
              <input
                className="text-input"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="název nové nástrahy"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddNew() } }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button type="button" className="new-btn" onClick={() => setAddingNew(false)}>Zpět</button>
                <button type="button" className="btn-primary" style={{ margin: 0 }} onClick={handleAddNew} disabled={busy}>
                  {busy ? 'Ukládám…' : 'Přidat a vybrat'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
