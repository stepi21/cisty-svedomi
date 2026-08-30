import { useState } from 'react'
import { supabase } from '../supabaseClient'

// Pokud appku otevřeš přes odkaz s ?invite=KOD, rovnou přepneme na
// záložku "Mám kód pozvánky" a pole předvyplníme.
function getInviteFromUrl() {
  if (typeof window === 'undefined') return ''
  const params = new URLSearchParams(window.location.search)
  return params.get('invite') || ''
}

export default function Onboarding({ userId, onDone }) {
  const initialInvite = getInviteFromUrl()
  const [mode, setMode] = useState(initialInvite ? 'join' : 'create') // 'create' | 'join'
  const [groupName, setGroupName] = useState('')
  const [inviteCode, setInviteCode] = useState(initialInvite)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleCreate(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { data, error } = await supabase
      .from('groups')
      .insert({ name: groupName, created_by: userId })
      .select()
      .single()
    setBusy(false)
    if (error) { setError(error.message); return }
    onDone(data.id)
  }

  async function handleJoin(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('accept_group_invite', {
      invite_code: inviteCode.trim(),
    })
    setBusy(false)
    if (error) { setError(error.message); return }
    onDone(data)
  }

  return (
    <div className="center-screen">
      <div className="login-card">
        <div className="login-eyebrow">ČISTÝ SVĚDOMÍ</div>
        <h1 className="login-title">Ještě jeden krok</h1>

        {initialInvite && (
          <p className="invite-hint">
            Kód pozvánky jsme ti předvyplnili — jen ho níže potvrď.
          </p>
        )}

        <div className="tab-row">
          <button
            className={`tab-btn ${mode === 'create' ? 'active' : ''}`}
            onClick={() => setMode('create')}
          >Založit skupinu</button>
          <button
            className={`tab-btn ${mode === 'join' ? 'active' : ''}`}
            onClick={() => setMode('join')}
          >Mám kód pozvánky</button>
        </div>

        {mode === 'create' ? (
          <form onSubmit={handleCreate}>
            <label className="field-label" htmlFor="gname">Název skupiny</label>
            <input
              id="gname"
              required
              placeholder="např. Naše parta"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="text-input"
            />
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Zakládám…' : 'Založit skupinu'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin}>
            <label className="field-label" htmlFor="code">Kód pozvánky</label>
            <input
              id="code"
              required
              placeholder="např. a1b2c3d4"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="text-input"
            />
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Ověřuji…' : 'Přidat se do skupiny'}
            </button>
          </form>
        )}
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  )
}
