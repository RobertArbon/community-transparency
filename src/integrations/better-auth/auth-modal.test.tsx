import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('#/lib/auth-client', () => ({
  authClient: {
    signIn: { email: vi.fn().mockResolvedValue({ error: null }) },
    signUp: { email: vi.fn().mockResolvedValue({ error: null }) },
  },
}))

import AuthModal from './auth-modal'

describe('AuthModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders sign-in tab with email and password fields by default', () => {
    render(<AuthModal open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(screen.getByLabelText('Password')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy()
  })

  it('renders sign-up tab with name, email, and password fields', () => {
    render(<AuthModal open={true} onOpenChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Sign up' }))
    expect(screen.getByLabelText('Name')).toBeTruthy()
    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(screen.getByLabelText('Password')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeTruthy()
  })

  it('does not render fields when open is false', () => {
    render(<AuthModal open={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByLabelText('Email')).toBeNull()
  })
})
