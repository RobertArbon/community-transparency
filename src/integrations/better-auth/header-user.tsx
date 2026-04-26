import { useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { Button } from '#/components/ui/button'
import AuthModal from './auth-modal'

export default function HeaderUser() {
  const { data: session } = authClient.useSession()
  const [modalOpen, setModalOpen] = useState(false)

  if (session) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm">{session.user.email}</span>
        <Button variant="outline" size="sm" onClick={() => void authClient.signOut()}>
          Sign out
        </Button>
      </div>
    )
  }

  return (
    <>
      <Button size="sm" onClick={() => setModalOpen(true)}>
        Sign in
      </Button>
      <AuthModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  )
}
