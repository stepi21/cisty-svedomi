import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './components/Login.jsx'
import Onboarding from './components/Onboarding.jsx'
import Dashboard from './components/Dashboard.jsx'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [groupId, setGroupId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      // Appka tu dřív vypínala "Načítám…" hned, jakmile zjistila přihlášení --
      // ale to je jen půlka odpovědi. Skupina (groupId) se dozví až
      // loadMembership() o kus níž (spuštěné z efektu na "session"), a než
      // doběhne, appka na zlomek vteřiny myslela "nemáš skupinu" a bleskla
      // Onboarding, i když uživatel skupinu dávno měl. Řešení: pokud session
      // existuje, appka nechá loading zapnuté -- vypne ho až loadMembership(),
      // teprve když zná i groupId. Bez session logicky nic dalšího čekat netřeba.
      if (!data.session) setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (!sess) setLoading(false)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setGroupId(null); setProfile(null); return }
    loadMembership()
  }, [session])

  async function loadMembership() {
    setLoading(true)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    setProfile(profileData)

    const { data: membership } = await supabase
      .from('group_members')
      .select('group_id, groups(name)')
      .eq('user_id', session.user.id)
      .limit(1)
      .maybeSingle()

    setGroupId(membership ? membership.group_id : null)
    setLoading(false)
  }

  if (loading) {
    return <div className="center-screen"><div className="loader-text">Načítám…</div></div>
  }

  if (recovering) {
    return <SetNewPassword onDone={() => setRecovering(false)} />
  }

  if (!session) {
    return <Login />
  }

  if (!groupId) {
    return <Onboarding userId={session.user.id} onDone={(gid) => setGroupId(gid)} />
  }

  return (
    <Dashboard
      groupId={groupId}
      userId={session.user.id}
      profile={profile}
      onSignOut={() => supabase.auth.signOut()}
    />
  )
}

function SetNewPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) { setError('Heslo musí mít aspoň 6 znaků.'); return }
    if (password !== password2) { setError('Hesla se neshodují.'); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) { setError(error.message); return }
    onDone()
  }

  return (
    <div className="center-screen">
      <div className="login-card">
        <div className="login-eyebrow">ČISTÝ SVĚDOMÍ</div>
        <h1 className="login-title">Nové heslo</h1>
        <form onSubmit={handleSubmit}>
          <label className="field-label">Nové heslo</label>
          <input className="text-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="aspoň 6 znaků" />
          <label className="field-label">Zopakuj heslo</label>
          <input className="text-input" type="password" required value={password2} onChange={(e) => setPassword2(e.target.value)} />
          <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Ukládám…' : 'Uložit nové heslo'}</button>
          {error && <p className="error-text">{error}</p>}
        </form>
      </div>
    </div>
  )
}

