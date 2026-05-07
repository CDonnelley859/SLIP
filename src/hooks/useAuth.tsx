import { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

interface AuthCtx {
  userId: string
  handle: string
  hasHandle: boolean
  setHandle: (name: string) => Promise<void>
  loading: boolean
}

const Ctx = createContext<AuthCtx>({
  userId: '',
  handle: '',
  hasHandle: false,
  setHandle: async () => {},
  loading: true,
})

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [userId, setUserId] = useState('')
  const [handle, setHandleState] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      let uid = session?.user?.id

      if (!uid) {
        const { data } = await supabase.auth.signInAnonymously()
        uid = data.user?.id ?? ''
      }

      setUserId(uid)

      if (uid) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('handle')
          .eq('id', uid)
          .single()

        // Auto-generated handles start with 'jockey_' — treat as unset
        const h = profile?.handle ?? ''
        if (h && !h.startsWith('jockey_')) {
          setHandleState(h)
        }
      }

      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) setUserId(session.user.id)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function setHandle(name: string) {
    const trimmed = name.trim()
    await supabase.from('profiles').update({ handle: trimmed }).eq('id', userId)
    setHandleState(trimmed)
  }

  return (
    <Ctx.Provider value={{ userId, handle, hasHandle: handle.length > 0, setHandle, loading }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
