import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUseSession = vi.hoisted(() => vi.fn())
const mockSignOut = vi.hoisted(() => vi.fn())

vi.mock('#/lib/auth-client', () => ({
  authClient: {
    useSession: mockUseSession,
    signOut: mockSignOut,
  },
}))

import HeaderUser from './header-user'

describe('HeaderUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue(undefined)
  })

  it('shows Sign in button when no session', () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false })
    render(<HeaderUser />)
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy()
  })

  it('shows user email and Sign out button when session exists', () => {
    mockUseSession.mockReturnValue({
      data: { user: { email: 'test@example.com', name: 'Test User' } },
      isPending: false,
    })
    render(<HeaderUser />)
    expect(screen.getByText('test@example.com')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
  })

  it('calls signOut when Sign out button is clicked', () => {
    mockUseSession.mockReturnValue({
      data: { user: { email: 'test@example.com', name: 'Test User' } },
      isPending: false,
    })
    render(<HeaderUser />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(mockSignOut).toHaveBeenCalledOnce()
  })
})
