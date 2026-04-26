import { useState } from 'react'
import { Dialog } from 'radix-ui'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Button } from '#/components/ui/button'
import { authClient } from '#/lib/auth-client'

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Tab = 'signin' | 'signup'

export default function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [tab, setTab] = useState<Tab>('signin')
  const [error, setError] = useState<string | null>(null)

  function switchTab(next: Tab) {
    setTab(next)
    setError(null)
  }

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const email = (form.elements.namedItem('email') as HTMLInputElement).value
    const password = (form.elements.namedItem('password') as HTMLInputElement).value
    const { error } = await authClient.signIn.email({ email, password })
    if (error) {
      setError(error.message ?? 'Sign in failed')
    } else {
      onOpenChange(false)
    }
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const name = (form.elements.namedItem('name') as HTMLInputElement).value
    const email = (form.elements.namedItem('email') as HTMLInputElement).value
    const password = (form.elements.namedItem('password') as HTMLInputElement).value
    const { error } = await authClient.signUp.email({ name, email, password })
    if (error) {
      setError(error.message ?? 'Sign up failed')
    } else {
      onOpenChange(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
          <Dialog.Title className="text-xl font-semibold mb-4">Account</Dialog.Title>

          <div role="tablist" className="flex gap-4 mb-4 border-b">
            <button
              role="tab"
              aria-selected={tab === 'signin'}
              onClick={() => switchTab('signin')}
              className="pb-2 aria-selected:border-b-2 aria-selected:border-black"
            >
              Sign in
            </button>
            <button
              role="tab"
              aria-selected={tab === 'signup'}
              onClick={() => switchTab('signup')}
              className="pb-2 aria-selected:border-b-2 aria-selected:border-black"
            >
              Sign up
            </button>
          </div>

          {tab === 'signin' && (
            <form onSubmit={handleSignIn} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="signin-email">Email</Label>
                <Input id="signin-email" name="email" type="email" required />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="signin-password">Password</Label>
                <Input id="signin-password" name="password" type="password" required />
              </div>
              {error && <p className="text-red-500 text-sm" role="alert">{error}</p>}
              <Button type="submit">Sign in</Button>
            </form>
          )}

          {tab === 'signup' && (
            <form onSubmit={handleSignUp} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="signup-name">Name</Label>
                <Input id="signup-name" name="name" type="text" required />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="signup-email">Email</Label>
                <Input id="signup-email" name="email" type="email" required />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="signup-password">Password</Label>
                <Input id="signup-password" name="password" type="password" required />
              </div>
              {error && <p className="text-red-500 text-sm" role="alert">{error}</p>}
              <Button type="submit">Sign up</Button>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
