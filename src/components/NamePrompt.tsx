import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const NamePrompt = () => {
  const { setHandle } = useAuth()
  const [value, setValue] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    setHandle(value.trim())
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-display text-6xl brass-text font-black tracking-tight">SLIP</h1>
          <p className="text-muted-foreground mt-2 text-sm uppercase tracking-[0.2em]">Race-Day Companion</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground text-center">What do they call you at the track?</p>
            <Input
              autoFocus
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="your name or nickname"
              className="text-center text-lg"
              maxLength={30}
            />
          </div>
          <Button type="submit" disabled={!value.trim()} className="w-full font-display tracking-wide" size="lg">
            Enter the Paddock
          </Button>
        </form>
      </div>
    </div>
  )
}
