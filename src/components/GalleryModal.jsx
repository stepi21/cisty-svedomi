import { IconClose, IconGallery, IconUlovek, IconNastraha } from '../lib/icons.jsx'
export default function GalleryModal({ sessions, onClose, onOpenCatch, onOpenBait }) {
  const seen = new Set()
  const photos = []

  sessions.forEach((s) => {
    ;(s.catches || []).forEach((c) => {
      if (c.photo_url && !seen.has(c.photo_url)) {
        seen.add(c.photo_url)
        photos.push({ url: c.photo_url, label: c.species, type: 'catch', catchRef: c, date: s.session_date })
      }
      if (c.bait_photo_url && !seen.has(c.bait_photo_url)) {
        seen.add(c.bait_photo_url)
        photos.push({ url: c.bait_photo_url, label: c.bait, type: 'bait', catchRef: c, date: s.session_date })
      }
    })
    ;(s.rods || []).forEach((r) => {
      ;(r.baits || []).forEach((b) => {
        if (b.photo_url && !seen.has(b.photo_url)) {
          seen.add(b.photo_url)
          photos.push({ url: b.photo_url, label: b.name, type: 'bait', catchRef: null, date: s.session_date })
        }
      })
    })
  })

  photos.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ticket" style={{ maxWidth: 560 }}>
        <div className="ticket-top">
          <button className="ticket-close" onClick={onClose}><IconClose size={16} /></button>
          <div className="eyebrow">Galerie</div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconGallery size={20} color="var(--amber)" /> Fotky party</h2>
        </div>
        <div className="perforation"></div>
        <div className="ticket-body">
          {photos.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Zatím žádné fotky.</p>
          ) : (
            <div className="gallery-grid">
              {photos.map((p, i) => (
                <div
                  key={i}
                  className="gallery-item"
                  onClick={() => p.type === 'catch' ? (p.catchRef && onOpenCatch(p.catchRef)) : onOpenBait(p.label)}
                  title={p.label}
                >
                  <img src={p.url} alt={p.label} />
                  <span className={`gallery-tag ${p.type}`}>
                    {p.type === 'catch' ? <IconUlovek size={13} color="var(--water-deep)" /> : <IconNastraha size={13} color="var(--amber-deep)" />}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
