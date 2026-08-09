const fishSVG = (color) => `
  <svg viewBox="0 0 64 34" xmlns="http://www.w3.org/2000/svg">
    <path d="M4,17 C4,8 18,3 32,3 C46,3 58,9 60,17 C58,25 46,31 32,31 C18,31 4,26 4,17 Z" fill="${color}"/>
    <path d="M4,17 L-6,8 L-6,26 Z" fill="${color}"/>
    <circle cx="46" cy="14" r="2.3" fill="#1a1a1a"/>
  </svg>`

export default function CatchTicket({ catchData: c, session, onClose }) {
  const color = c.category === 'dravec' ? '#6B7A4F' : '#B97F35'
  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ticket">
        <div className="ticket-top">
          <button className="ticket-close" onClick={onClose}>✕</button>
          <div className="eyebrow">Úlovkový lístek</div>
          <h2>{c.species}</h2>
        </div>
        <div className="perforation"></div>
        <div className="ticket-body">
          <div className="ticket-illustration">
            <div style={{ width: 120 }} dangerouslySetInnerHTML={{ __html: fishSVG(color) }} />
          </div>
          <div className="ticket-stats">
            <div className="stat"><div className="num">{c.length_cm ?? '—'} cm</div><div className="lab">délka</div></div>
            <div className="stat"><div className="num">{c.weight_kg ?? '—'} kg</div><div className="lab">váha</div></div>
          </div>
          <div className="ticket-line"><span className="lab">Nástraha</span><span className="val">{c.bait || '—'}</span></div>
          <div className="ticket-line"><span className="lab">Čas úlovku</span><span className="val">{c.caught_at ? new Date(c.caught_at).toLocaleTimeString('cs-CZ') : '—'}</span></div>
          <div className="ticket-line"><span className="lab">Lokace</span><span className="val">{c.lat?.toFixed(4)}, {c.lng?.toFixed(4)}</span></div>
          {session && <div className="ticket-line"><span className="lab">Výprava</span><span className="val" style={{ fontFamily: 'inherit', fontWeight: 600 }}>{session.title}</span></div>}
        </div>
        <div className="note">📷 foto úlovku — přidá se ve fázi 2 (upload do Supabase Storage)</div>
      </div>
    </div>
  )
}
