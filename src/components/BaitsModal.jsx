import { useState } from 'react'

const fishSVG = (color) => `
  <svg viewBox="0 0 64 34" xmlns="http://www.w3.org/2000/svg">
    <path d="M4,17 C4,8 18,3 32,3 C46,3 58,9 60,17 C58,25 46,31 32,31 C18,31 4,26 4,17 Z" fill="${color}"/>
    <path d="M4,17 L-6,8 L-6,26 Z" fill="${color}"/>
    <circle cx="46" cy="14" r="2.3" fill="#1a1a1a"/>
  </svg>`
const CATEGORY_COLOR = { dravec: '#5C7A85', bila: '#C4A572' }

export default function BaitsModal({ sessions, initialBaitKey, onClose, onOpenCatch }) {
  const [selectedKey, setSelectedKey] = useState(initialBaitKey || null)

  const map = {}
  sessions.forEach((s) => {
    ;(s.catches || []).forEach((c) => {
      if (!c.bait) return
      const key = c.bait.trim().toLowerCase()
      if (!key) return
      if (!map[key]) map[key] = { label: c.bait.trim(), photo_url: null, catches: [], dravec: 0, bila: 0 }
      map[key].catches.push({ ...c, sessionRef: s })
      map[key][c.category] = (map[key][c.category] || 0) + 1
      if (!map[key].photo_url && c.bait_photo_url) map[key].photo_url = c.bait_photo_url
    })
  })

  const baits = Object.entries(map).map(([key, v]) => ({
    key, label: v.label, photo_url: v.photo_url, catches: v.catches,
    category: (v.dravec || 0) >= (v.bila || 0) ? 'dravec' : 'bila',
  }))
  const dravciBaits = baits.filter((b) => b.category === 'dravec').sort((a, b) => b.catches.length - a.catches.length)
  const bilaBaits = baits.filter((b) => b.category === 'bila').sort((a, b) => b.catches.length - a.catches.length)
  const selected = baits.find((b) => b.key === selectedKey)

  if (selected) {
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
            <button className="new-btn" onClick={() => setSelectedKey(null)} style={{ marginBottom: 12 }}>← Zpět na nástrahy</button>
            {selected.photo_url && (
              <div className="ticket-illustration">
                <img src={selected.photo_url} alt={selected.label} className="catch-photo" />
              </div>
            )}
            <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{selected.catches.length} chycených ryb na tuto nástrahu</p>
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
          </div>
        </div>
      </div>
    )
  }

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
          <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 15, margin: '0 0 6px' }}>Dravci</h3>
          {dravciBaits.length === 0 && <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Zatím žádné.</p>}
          {dravciBaits.map((b) => (
            <div key={b.key} className="record-row" onClick={() => setSelectedKey(b.key)}>
              <div className="record-head"><strong>{b.label}</strong><span className="record-length">{b.catches.length}×</span></div>
            </div>
          ))}
          <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 15, margin: '18px 0 6px' }}>Bílá ryba</h3>
          {bilaBaits.length === 0 && <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Zatím žádné.</p>}
          {bilaBaits.map((b) => (
            <div key={b.key} className="record-row" onClick={() => setSelectedKey(b.key)}>
              <div className="record-head"><strong>{b.label}</strong><span className="record-length">{b.catches.length}×</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
