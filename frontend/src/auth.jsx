import { createContext, useContext, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { supabase } from './lib/supabase'

const AuthContext = createContext({ session: null, ready: false })

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(!supabase)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ session, ready }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

export function displayName(session) {
  const meta = session?.user?.user_metadata || {}
  return meta.full_name || meta.name || session?.user?.email?.split('@')[0] || ''
}

export async function accessToken() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

export function signOut() {
  return supabase?.auth.signOut()
}

// Inside pages: send signed-out visitors to sign in, then bring them back.
export function RequireAuth({ children }) {
  const { session, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <main className="grid min-h-svh place-items-center text-ink-soft">Loading…</main>
  if (!session) return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  return children
}
