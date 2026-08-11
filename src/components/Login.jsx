import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email') // 'email' | 'code'
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSendCode(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setStep('code')
  }

  async function handleVerifyCode(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email',
    })
    setBusy(false)
    if (error) setError('Kód nesedí nebo vypršel. Zkontroluj ho, nebo si vyžádej nový.')
    // při úspěchu appka sama přepne obrazovku díky onAuthStateChange v App.jsx
  }

  async function handleResend() {
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    setBusy(false)
    if (error) setError(error.message)
  }

  return (
    <div className="center-screen">
      <div className="login-card">
        <div className="login-eyebrow">ČISTÝ SVĚDOMÍ</div>
        <h1 className="login-title">Deník pro rybáře</h1>

        {step === 'email' ? (
          <form onSubmit={handleSendCode}>
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
              {busy ? 'Odesílám…' : 'Poslat přihlašovací kód'}
            </button>
            {error && <p className="error-text">{error}</p>}
          </form>
        ) : (
          <form onSubmit={handleVerifyCode}>
            <p className="login-text">
              Poslali jsme 6místný kód na <strong>{email}</strong>. Napiš ho sem.
            </p>
            <label className="field-label" htmlFor="code">Kód z e-mailu</label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="text-input"
              style={{ fontSize: 20, letterSpacing: '0.15em', textAlign: 'center' }}
            />
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Ověřuji…' : 'Přihlásit se'}
            </button>
            {error && <p className="error-text">{error}</p>}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <button type="button" className="new-btn" onClick={() => { setStep('email'); setCode(''); setError(null) }}>
                ← Jiný e-mail
              </button>
              <button type="button" className="new-btn" onClick={handleResend} disabled={busy}>
                Poslat kód znovu
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
