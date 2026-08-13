import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { uploadPhoto } from '../lib/storage.js'

const fishSVG = (color) => `
  <svg viewBox="0 0 64 34" xmlns="http://www.w3.org/2000/svg">
    <path d="M4,17 C4,8 18,3 32,3 C46,3 58,9 60,17 C58,25 46,31 32,31 C18,31 4,26 4,17 Z" fill="${color}"/>
    <path d="M4,17 L-6,8 L-6,26 Z" fill="${color}"/>
    <circle cx="46" cy="14" r="2.3" fill="#1a1a1a"/>
  </svg>`
const CATEGORY_COLOR = { dravec: '#5C7A85', bila: '#C4A572' }
const TYPE_CATEGORY = { kapr: 'bila', privlac: 'dravec', muska: 'dravec', plavana: 'bila', jine: null }

export default function BaitsModal({ sessions, baitCatalog, groupId, userId, initialBaitKey, onCatalogChanged, onRenamePropagate, onClose, onOpenCatch }) {
  const [selectedKey, setSelectedKey] = useState(initialBaitKey || null)
  const [adding, setAdding] = useState(false)
  const [editingCatalogId, setEditingCatalogId] = useState(null)
  const [filter, setFilter] = useState('all')

  // --- spočítat úlovky na jednotlivé nástrahy z existujících dat ---
  const catchMap = {}
  sessions.forEach((s) => {
    ;(s.catches || []).forEach((c) => {
      if (!c.bait) return
      const key = c.bait.trim().toLowerCase()
      if (!key) return
      if (!catchMap[key]) catchMap[key] = { catches: [], dravec: 0, bila: 0, photo_url: null }
      catchMap[key].catches.push({ ...c, sessionRef: s })
      catchMap[key][c.category] = (catchMap[key][c.category] || 0) + 1
      if (!catchMap[key].photo_url && c.bait_photo_url) catchMap[key].photo_url = c.bait_photo_url
    })
  })

  // --- doplnit nástrahy zadané u prutů, i když na ně ještě nic nechytlo ---
  const rodBaitMap = {}
  sessions.forEach((s) => {
    const guessCategory = TYPE_CATEGORY[s.type] || null
    ;(s.rods || []).forEach((r) => {
      const names = []
      ;(r.baits || []).forEach((b) => { if (b.name) names.push({ name: b.name.trim(), photo_url: b.photo_url || null }) })
      if (r.bait) r.bait.split(',').forEach((n) => { const t = n.trim(); if (t) names.push({ name: t, photo_url: r.bait_photo_url || null }) })
      names.forEach(({ name, photo_url }) => {
        const key = name.toLowerCase()
        if (!key) return
        if (!rodBaitMap[key]) rodBaitMap[key] = { label: name, photo_url, category: guessCategory }
        if (!rodBaitMap[key].photo_url && photo_url) rodBaitMap[key].photo_url = photo_url
      })
    })
  })

  // --- sloučit vše: pruty (bez úlovku) -> úlovky -> katalog (katalog vyhrává, pokud je zadaný) ---
  const merged = {}
  Object.entries(rodBaitMap).forEach(([key, v]) => {
    merged[key] = { key, label: v.label, photo_url: v.photo_url, catches: [], category: v.category || 'dravec', catalogEntry: null }
  })
  Object.entries(catchMap).forEach(([key, v]) => {
    const existing = merged[key]
    merged[key] = {
      key, label: v.catches[0]?.bait?.trim() || existing?.label || key,
      photo_url: v.photo_url || existing?.photo_url || null, catches: v.catches,
      category: (v.dravec || 0) >= (v.bila || 0) ? 'dravec' : (existing?.category || 'bila'),
      catalogEntry: null,
    }
  })
  baitCatalog.forEach((b) => {
    const key = b.name.trim().toLowerCase()
    const existing = merged[key]
    merged[key] = {
      key, label: b.name.trim(),
      photo_url: b.photo_url || existing?.photo_url || null,
      catches: existing?.catches || [],
      category: b.category || existing?.category || 'dravec',
      catalogEntry: b,
    }
  })

  const baits = Object.values(merged)
  const filteredBaits = baits
    .filter((b) => filter === 'all' || b.category === filter)
    .sort((a, b) => b.catches.length - a.catches.length)
  const selected = baits.find((b) => b.key === selectedKey)

  async function handleCatalogChanged() {
    await onCatalogChanged?.()
  }

  // ---------- detail nástrahy ----------
  if (selected) {
    const canEditCatalog = selected.catalogEntry && selected.catalogEntry.created_by === userId
    if (editingCatalogId) {
      return (
        <EditBaitForm
          bait={selected}
          groupId={groupId}
          userId={userId}
          onRenamePropagate={onRenamePropagate}
          onCancel={() => setEditingCatalogId(null)}
          onSaved={async () => { setEditingCatalogId(null); await handleCatalogChanged() }}
        />
      )
    }
    return (
      <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="ticket" style={{ maxWidth: 440 }}>
          <div className="ticket-top">
            <button className="ticket-close" onClick={onClose}>✕</button>
            <div className="eyebrow">Nástraha</div>
            <h2>{selected.label}</h2>
          </div>
          <div className="perforation"></div>
          <div className="ticket-body">
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <button className="new-btn" onClick={() => setSelectedKey(null)}>← Zpět na nástrahy</button>
              {(selected.catalogEntry ? canEditCatalog : true) && (
                <button className="new-btn" onClick={() => setEditingCatalogId(selected.key)}>✏️ Upravit</button>
              )}
            </div>
            {selected.photo_url ? (
              <div className="ticket-illustration">
                <img src={selected.photo_url} alt={selected.label} className="catch-photo" />
              </div>
            ) : (
              <div className="ticket-illustration">
                <div style={{ width: 100 }} dangerouslySetInnerHTML={{ __html: fishSVG(CATEGORY_COLOR[selected.category]) }} />
              </div>
            )}
            <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              {selected.catches.length === 0 ? 'Zatím na tuto nástrahu nic nechyceno.' : `${selected.catches.length} chycených ryb na tuto nástrahu`}
            </p>
            {selected.catches.length > 0 && (
              <div className="catch-list" style={{ maxHeight: 'none' }}>
                {selected.catches
                  .sort((a, b) => (b.caught_at || b.sessionRef.session_date || '').localeCompare(a.caught_at || a.sessionRef.session_date || ''))
                  .map((c) => (
                    <div key={c.id} className="catch-row" onClick={() => onOpenCatch(c, selected.key)}>
                      <div className="fish-mini" dangerouslySetInnerHTML={{ __html: fishSVG(CATEGORY_COLOR[c.category]) }} />
                      <div>
                        <div className="c-name">{c.species}</div>
                        <div className="c-sub">{c.length_cm ?? '—'} cm · {c.sessionRef.session_date}</div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ---------- formulář na novou nástrahu ----------
  if (adding) {
    return (
      <AddBaitForm
        groupId={groupId}
        userId={userId}
        onCancel={() => setAdding(false)}
        onSaved={async () => { setAdding(false); await handleCatalogChanged() }}
      />
    )
  }

  // ---------- seznam nástrah ----------
  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ticket" style={{ maxWidth: 440 }}>
        <div className="ticket-top">
          <button className="ticket-close" onClick={onClose}>✕</button>
          <div className="eyebrow">Přehled</div>
          <h2>🪱 Nástrahy</h2>
        </div>
        <div className="perforation"></div>
        <div className="ticket-body">
          <button className="new-btn" onClick={() => setAdding(true)} style={{ marginBottom: 14 }}>+ Přidat nástrahu</button>

          <div className="filter-row" style={{ padding: 0, marginBottom: 12 }}>
            {['all', 'dravec', 'bila'].map((cat) => (
              <button
                key={cat}
                className={`filter-chip ${filter === cat ? `active ${cat}` : ''}`}
                onClick={() => setFilter(cat)}
              >
                {cat === 'all' ? 'Vše' : cat === 'dravec' ? 'Dravci' : 'Bílá ryba'}
              </button>
            ))}
          </div>

          {filteredBaits.length === 0 && <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Zatím žádné.</p>}
          {filteredBaits.map((b) => (
            <div key={b.key} className="record-row" onClick={() => setSelectedKey(b.key)}>
              <div className="record-head"><strong>{b.label}</strong><span className="record-length">{b.catches.length}×</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AddBaitForm({ groupId, userId, onCancel, onSaved }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('dravec')
  const [photoFile, setPhotoFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    let photo_url = null
    if (photoFile) photo_url = await uploadPhoto(photoFile, `baits/catalog`)
    const { error } = await supabase.from('baits').insert({
      group_id: groupId, created_by: userId, name, category, photo_url,
    })
    setBusy(false)
    if (error) { setError(error.message); return }
    onSaved()
  }

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="ticket" style={{ maxWidth: 380 }}>
        <div className="ticket-top">
          <button className="ticket-close" onClick={onCancel}>✕</button>
          <div className="eyebrow">Nová nástraha</div>
          <h2>Přidat do katalogu</h2>
        </div>
        <div className="perforation"></div>
        <div className="ticket-body">
          <form onSubmit={handleSubmit}>
            <label className="field-label">Název</label>
            <input className="text-input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="např. Boilie tuňák 20mm" autoFocus />
            <label className="field-label">Kategorie</label>
            <select className="text-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="dravec">Dravec</option>
              <option value="bila">Bílá ryba</option>
            </select>
            <label className="field-label">Foto (nepovinné)</label>
            <label className="photo-label" style={{ display: 'inline-block', marginTop: 4 }}>
              📷 {photoFile ? photoFile.name : 'vybrat foto'}
              <input type="file" accept="image/*" hidden onChange={(e) => setPhotoFile(e.target.files[0])} />
            </label>
            {error && <p className="error-text">{error}</p>}
            <button className="btn-primary" type="submit" disabled={busy} style={{ marginTop: 14 }}>{busy ? 'Ukládám…' : 'Přidat nástrahu'}</button>
          </form>
        </div>
      </div>
    </div>
  )
}

function EditBaitForm({ bait, groupId, userId, onRenamePropagate, onCancel, onSaved }) {
  const [name, setName] = useState(bait.label)
  const [category, setCategory] = useState(bait.category)
  const [photoFile, setPhotoFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    let photo_url = bait.photo_url
    if (photoFile) {
      const url = await uploadPhoto(photoFile, `baits/catalog`)
      if (url) photo_url = url
    }
    const renamed = name.trim().toLowerCase() !== bait.label.trim().toLowerCase()
    let error
    if (bait.catalogEntry) {
      ;({ error } = await supabase.from('baits').update({ name, category, photo_url }).eq('id', bait.catalogEntry.id))
    } else {
      ;({ error } = await supabase.from('baits').insert({ group_id: groupId, created_by: userId, name, category, photo_url }))
    }
    if (!error && renamed) {
      await onRenamePropagate?.(bait.label, name)
    }
    setBusy(false)
    if (error) { setError(error.message); return }
    onSaved()
  }

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="ticket" style={{ maxWidth: 380 }}>
        <div className="ticket-top">
          <button className="ticket-close" onClick={onCancel}>✕</button>
          <div className="eyebrow">Úprava</div>
          <h2>{bait.label}</h2>
        </div>
        <div className="perforation"></div>
        <div className="ticket-body">
          {!bait.catalogEntry && (
            <p className="help-note" style={{ marginBottom: 10 }}>
              Appka tuhle nástrahu zatím jen "odhadla" z tvé výpravy — nemá svůj vlastní záznam v katalogu. Uložením ho vytvoříš.
            </p>
          )}
          <form onSubmit={handleSubmit}>
            <label className="field-label">Název</label>
            <input className="text-input" required value={name} onChange={(e) => setName(e.target.value)} />
            <p className="help-note">Přejmenování se propíše i do výprav a úlovků, kde je tahle nástraha zapsaná — ale jen u tvých vlastních (kamarádovy záznamy nemůžeš upravovat).</p>
            <label className="field-label">Kategorie</label>
            <select className="text-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="dravec">Dravec</option>
              <option value="bila">Bílá ryba</option>
            </select>
            <label className="field-label">Foto</label>
            <label className="photo-label" style={{ display: 'inline-block', marginTop: 4 }}>
              📷 {photoFile ? photoFile.name : (bait.photo_url ? 'změnit foto' : 'vybrat foto')}
              <input type="file" accept="image/*" hidden onChange={(e) => setPhotoFile(e.target.files[0])} />
            </label>
            {bait.photo_url && !photoFile && <img src={bait.photo_url} alt="" className="bait-thumb" />}
            {error && <p className="error-text">{error}</p>}
            <button className="btn-primary" type="submit" disabled={busy} style={{ marginTop: 14 }}>{busy ? 'Ukládám…' : 'Uložit'}</button>
          </form>
        </div>
      </div>
    </div>
  )
}
