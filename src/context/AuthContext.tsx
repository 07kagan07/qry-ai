import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Cafe } from '../lib/types'

interface AuthState {
  session: Session | null
  user: User | null
  cafe: Cafe | null
  loading: boolean
  refreshCafe: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  cafe: null,
  loading: true,
  refreshCafe: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [cafe, setCafe] = useState<Cafe | null>(null)
  const [loading, setLoading] = useState(true)

  const loadCafe = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setCafe(null)
      return
    }
    const { data } = await supabase
      .from('cafes')
      .select('*')
      .eq('owner_id', userId)
      .maybeSingle()
    setCafe((data as Cafe) ?? null)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadCafe(data.session?.user.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      await loadCafe(newSession?.user.id)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadCafe])

  const refreshCafe = useCallback(async () => {
    await loadCafe(session?.user.id)
  }, [loadCafe, session])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, cafe, loading, refreshCafe, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
