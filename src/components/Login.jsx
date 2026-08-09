import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="center-screen">
      <div className="login-card">
        <div className="login-eyebrow">ČISTÉ SVĚDOMÍ</div>
        <h1 className="login-title">Deník pro rybáře</h1>
        {sent ? (
          <p className="login-text">
            Poslali jsme přihlašovací link na <strong>{email}</strong>. Zkontroluj schránku a klikni na něj.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              required
              placeholder="tvuj@email.cz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-input"
            />
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Odesílám…' : 'Poslat přihlašovací link'}
            </button>
            {error && <p className="error-text">{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
