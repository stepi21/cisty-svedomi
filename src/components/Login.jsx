import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [mode, setMode] = useState('link') // 'link' | 'password' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleLinkSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setError('E-mail nebo heslo nesedí.')
  }

  async function handleResetSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  function switchMode(next) {
    setMode(next)
    setSent(false)
    setError(null)
    setPassword('')
  }

  return (
    <div className="center-screen">
      <div className="login-card">
        <div className="login-eyebrow">NAHODIT</div>
        <h1 className="login-title">Deník pro rybáře</h1>
        <p style={{ fontSize: 10, opacity: 0.5, wordBreak: 'break-all', marginBottom: 8 }}>
          DEBUG: {typeof window !== 'undefined' ? window.location.href : ''}
        </p>

        {mode !== 'reset' && (
          <div className="tab-row">
            <button className={`tab-btn ${mode === 'link' ? 'active' : ''}`} onClick={() => switchMode('link')}>Přihlašovací link</button>
            <button className={`tab-btn ${mode === 'password' ? 'active' : ''}`} onClick={() => switchMode('password')}>Heslo</button>
          </div>
        )}

        {mode === 'link' && (
          sent ? (
            <p className="login-text">Poslali jsme přihlašovací link na <strong>{email}</strong>. Zkontroluj schránku a klikni na něj.</p>
          ) : (
            <form onSubmit={handleLinkSubmit}>
              <label className="field-label" htmlFor="email">E-mail</label>
              <input id="email" type="email" required placeholder="tvuj@email.cz" value={email} onChange={(e) => setEmail(e.target.value)} className="text-input" />
              <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Odesílám…' : 'Poslat přihlašovací link'}</button>
              {error && <p className="error-text">{error}</p>}
            </form>
          )
        )}

        {mode === 'password' && (
          <form onSubmit={handlePasswordSubmit}>
            <label className="field-label" htmlFor="email2">E-mail</label>
            <input id="email2" type="email" required placeholder="tvuj@email.cz" value={email} onChange={(e) => setEmail(e.target.value)} className="text-input" />
            <label className="field-label">Heslo</label>
            <input type="password" required placeholder="heslo" value={password} onChange={(e) => setPassword(e.target.value)} className="text-input" />
            <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Přihlašuji…' : 'Přihlásit se'}</button>
            {error && <p className="error-text">{error}</p>}
            <button type="button" className="new-btn" onClick={() => switchMode('reset')} style={{ marginTop: 10 }}>Zapomenuté heslo?</button>
            <p className="help-note" style={{ marginTop: 10 }}>Heslo si nastavíš v appce v ⚙️ Nastavení, jakmile se poprvé přihlásíš přes link.</p>
          </form>
        )}

        {mode === 'reset' && (
          sent ? (
            <>
              <p className="login-text">Poslali jsme odkaz na obnovu hesla na <strong>{email}</strong>. Klikni na něj a nastav si nové heslo.</p>
              <button type="button" className="new-btn" onClick={() => switchMode('password')} style={{ marginTop: 10 }}>← Zpět na přihlášení</button>
            </>
          ) : (
            <form onSubmit={handleResetSubmit}>
              <label className="field-label" htmlFor="email3">E-mail</label>
              <input id="email3" type="email" required placeholder="tvuj@email.cz" value={email} onChange={(e) => setEmail(e.target.value)} className="text-input" />
              <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Odesílám…' : 'Poslat odkaz na obnovu hesla'}</button>
              {error && <p className="error-text">{error}</p>}
              <button type="button" className="new-btn" onClick={() => switchMode('password')} style={{ marginTop: 10 }}>← Zpět</button>
            </form>
          )
        )}
      </div>
    </div>
  )
}
