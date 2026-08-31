import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './components/Login.jsx'
import Onboarding from './components/Onboarding.jsx'
import Dashboard from './components/Dashboard.jsx'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [groupId, setGroupId] = useState(null)
  const [isDemoGroup, setIsDemoGroup] = useState(false)
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

    // Pokud appka běží s ?invite=KOD v adrese, appka se o pozvánku vždy
    // pokusí -- i když už uživatel nějakou skupinu má (typicky: má
    // vlastní partu, ale klikl na demo odkaz). Bez tohohle appka dřív
    // vzala jen "první nalezené" členství a pozvánku z URL úplně
    // ignorovala, takže uživatel skončil ve své vlastní skupině místo
    // v demu.
    const inviteCode = new URLSearchParams(window.location.search).get('invite')
    let activeGroupId = null
    let activeIsDemo = false

    if (inviteCode) {
      const { data: joinedGroupId, error: joinError } = await supabase.rpc(
        'accept_group_invite',
        { invite_code: inviteCode }
      )
      if (!joinError && joinedGroupId) {
        activeGroupId = joinedGroupId
        const { data: g } = await supabase
          .from('groups')
          .select('is_demo')
          .eq('id', joinedGroupId)
          .single()
        activeIsDemo = g?.is_demo === true
        // Kód z adresy appka po úspěšném zpracování smaže -- ať appka
        // nezkouší invite znovu při každém refreshi stránky.
        window.history.replaceState({}, '', window.location.pathname)
      }
      // Pokud pozvánka selže (neplatná/vypršelá), appka potichu spadne
      // na běžné hledání členství níž -- uživatel uvidí svou vlastní
      // skupinu, pokud nějakou má, místo aby appka zůstala viset.
    }

    if (!activeGroupId) {
      const { data: membership } = await supabase
        .from('group_members')
        .select('group_id, groups(name, is_demo)')
        .eq('user_id', session.user.id)
        .limit(1)
        .maybeSingle()
      activeGroupId = membership ? membership.group_id : null
      activeIsDemo = membership?.groups?.is_demo === true
    }

    setGroupId(activeGroupId)
    setIsDemoGroup(activeIsDemo)
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
      isDemoGroup={isDemoGroup}
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
        <div className="login-eyebrow">NAHODIT</div>
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

