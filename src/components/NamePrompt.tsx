import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

export const NamePrompt = () => {
  const { setHandle } = useAuth()
  const [value, setValue] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    setHandle(value.trim())
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-headline-xl font-black tracking-tighter uppercase leading-none">SLIP</h1>
          <p className="text-label-caps uppercase mt-3 text-muted-foreground">Race-Day Companion</p>
        </div>
        <form onSubmit={submit}>
          <div className="relative border-brutalist">
            <label className="absolute top-[-9px] left-3 bg-background px-2 text-label-caps text-[10px] uppercase z-10">
              YOUR_HANDLE
            </label>
            <input
              autoFocus
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="WHAT DO THEY CALL YOU"
              maxLength={30}
              className="w-full bg-transparent px-4 py-4 text-data-mono uppercase placeholder:text-muted-foreground/40 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!value.trim()}
            className="w-full h-14 bg-primary text-primary-foreground text-headline-md uppercase border-brutalist border-t-0 disabled:opacity-40 transition-none"
          >
            ENTER THE PADDOCK
          </button>
        </form>
      </div>
    </div>
  )
}
