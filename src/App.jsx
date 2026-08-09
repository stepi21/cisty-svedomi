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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
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
