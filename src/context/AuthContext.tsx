import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Cafe } from '../lib/types'

const ACTIVE_CAFE_KEY = 'qr-menu:active-cafe'

interface AuthState {
  session: Session | null
  user: User | null
  /** Aktif şube (çoklu şube desteğinde `cafes` içindeki seçili satır). */
  cafe: Cafe | null
  cafes: Cafe[]
  loading: boolean
  refreshCafe: () => Promise<void>
  switchCafe: (id: string) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  cafe: null,
  cafes: [],
  loading: true,
  refreshCafe: async () => {},
  switchCafe: () => {},
  signOut: async () => {},
})

function readStoredActiveCafeId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_CAFE_KEY)
  } catch {
    return null
  }
}

function writeStoredActiveCafeId(id: string) {
  try {
    localStorage.setItem(ACTIVE_CAFE_KEY, id)
  } catch {
    // localStorage kullanılamıyorsa (gizli sekme vb.) sessizce yoksay.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [cafes, setCafes] = useState<Cafe[]>([])
  const [activeCafeId, setActiveCafeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadCafes = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setCafes([])
      setActiveCafeId(null)
      return
    }
    const { data } = await supabase
      .from('cafes')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at')
    const list = (data as Cafe[]) ?? []
    setCafes(list)
    setActiveCafeId((prev) => {
      if (prev && list.some((c) => c.id === prev)) return prev
      const stored = readStoredActiveCafeId()
      if (stored && list.some((c) => c.id === stored)) return stored
      return list[0]?.id ?? null
    })
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadCafes(data.session?.user.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      await loadCafes(newSession?.user.id)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadCafes])

  const refreshCafe = useCallback(async () => {
    await loadCafes(session?.user.id)
  }, [loadCafes, session])

  const switchCafe = useCallback((id: string) => {
    setActiveCafeId(id)
    writeStoredActiveCafeId(id)
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const cafe = cafes.find((c) => c.id === activeCafeId) ?? cafes[0] ?? null

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        cafe,
        cafes,
        loading,
        refreshCafe,
        switchCafe,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
