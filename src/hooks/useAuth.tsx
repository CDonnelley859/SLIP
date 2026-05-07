import { createContext, useContext, useState, ReactNode, useEffect } from 'react'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getOrCreateUserId(): string {
  let id = localStorage.getItem('slip_user_id')
  if (!id || !UUID_RE.test(id)) {
    id = crypto.randomUUID()
    localStorage.setItem('slip_user_id', id)
  }
  return id
}

interface AuthCtx {
  userId: string
  handle: string
  hasHandle: boolean
  setHandle: (name: string) => void
  loading: boolean
}

const Ctx = createContext<AuthCtx>({
  userId: '',
  handle: '',
  hasHandle: false,
  setHandle: () => {},
  loading: true,
})

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [userId] = useState(() => getOrCreateUserId())
  const [handle, setHandleState] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('slip_handle') ?? ''
    setHandleState(saved)
    setLoading(false)
  }, [])

  function setHandle(name: string) {
    const trimmed = name.trim()
    localStorage.setItem('slip_handle', trimmed)
    setHandleState(trimmed)
  }

  return (
    <Ctx.Provider value={{ userId, handle, hasHandle: handle.length > 0, setHandle, loading }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
