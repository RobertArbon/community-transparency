# Better Auth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Clerk auth with Better Auth (email + password) in the community-transparency TanStack Start app.

**Architecture:** Better Auth is split into a server instance (`src/lib/auth.ts` with Prisma adapter), a browser client (`src/lib/auth-client.ts`), and a TanStack Start catch-all API route (`src/routes/api.auth.$.ts`). Auth UI is a Radix Dialog modal rendered from the header; no provider wrapper is required.

**Tech Stack:** better-auth, Prisma (PostgreSQL), TanStack Start, Radix UI (`radix-ui` barrel package), Tailwind CSS, Vitest + Testing Library

---

## File Map

**Create:**
- `src/lib/auth.ts` — Better Auth server instance (Prisma adapter, email+password)
- `src/lib/auth-client.ts` — Better Auth browser client
- `src/routes/api.auth.$.ts` — Catch-all API route forwarding to Better Auth handler
- `src/integrations/better-auth/auth-modal.tsx` — Radix Dialog modal with sign-in / sign-up tabs
- `src/integrations/better-auth/auth-modal.test.tsx` — Component tests
- `src/integrations/better-auth/header-user.tsx` — Shows sign-in button or email + sign-out
- `src/integrations/better-auth/header-user.test.tsx` — Component tests
- `src/test/setup.ts` — Vitest cleanup hook
- `vitest.config.ts` — Vitest configuration (standalone, jsdom, `#/` alias)

**Modify:**
- `prisma/schema.prisma` — Append four Better Auth models
- `src/env.ts` — Add `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` to server schema
- `.env.local` — Replace Clerk vars with Better Auth vars
- `src/routes/__root.tsx` — Remove `ClerkProvider`, add `<header>` with `HeaderUser`
- `package.json` — Remove `@clerk/clerk-react`

**Delete:**
- `src/integrations/clerk/provider.tsx`
- `src/integrations/clerk/header-user.tsx`

---

### Task 1: Install better-auth and update environment

**Files:**
- Modify: `.env.local`
- Modify: `src/env.ts`

- [ ] **Step 1: Install better-auth**

Run from `community-transparency/`:
```bash
npm install better-auth
```
Expected: `better-auth` appears in `dependencies` in `package.json`.

- [ ] **Step 2: Generate a secret and update .env.local**

Generate a secret:
```bash
openssl rand -base64 32
```
Copy the output. Replace the entire contents of `.env.local` with:
```
# Better Auth
BETTER_AUTH_SECRET=<paste output here>
BETTER_AUTH_URL=http://localhost:3000

# Database URL for PostgreSQL
DATABASE_URL="postgres://postgres:postgresql@localhost:5432/postgres?sslmode=disable&connection_limit=10&connect_timeout=0&max_idle_connection_lifetime=0&pool_timeout=0&socket_timeout=0"
```

- [ ] **Step 3: Update src/env.ts**

Replace the contents of `src/env.ts`:
```typescript
import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  server: {
    SERVER_URL: z.string().url().optional(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),
  },
  clientPrefix: 'VITE_',
  client: {
    VITE_APP_TITLE: z.string().min(1).optional(),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
})
```

- [ ] **Step 4: Commit**

```bash
git add .env.local src/env.ts package.json package-lock.json
git commit -m "chore: install better-auth and configure env"
```

---

### Task 2: Update Prisma schema and migrate

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Append Better Auth models to prisma/schema.prisma**

Add these four models at the end of the file (after the `Source` enum):
```prisma
model User {
  id            String    @id
  name          String
  email         String    @unique
  emailVerified Boolean
  image         String?
  createdAt     DateTime
  updatedAt     DateTime
  sessions      Session[]
  accounts      Account[]
}

model Session {
  id        String   @id
  expiresAt DateTime
  token     String   @unique
  createdAt DateTime
  updatedAt DateTime
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime
  updatedAt             DateTime
}

model Verification {
  id         String    @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime?
  updatedAt  DateTime?
}
```

- [ ] **Step 2: Regenerate Prisma client and run migration**

```bash
dotenv -e .env.local -- prisma generate
dotenv -e .env.local -- prisma migrate dev --name add-better-auth
```
Expected: a new migration file under `prisma/migrations/`, four new tables created in the database.

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat: add Better Auth tables to Prisma schema"
```

---

### Task 3: Create Better Auth server instance

**Files:**
- Create: `src/lib/auth.ts`

- [ ] **Step 1: Create src/lib/auth.ts**

```typescript
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '#/db'

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
})
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors in `src/lib/auth.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: add Better Auth server instance"
```

---

### Task 4: Create Better Auth API route

**Files:**
- Create: `src/routes/api.auth.$.ts`

- [ ] **Step 1: Create src/routes/api.auth.$.ts**

```typescript
import { auth } from '#/lib/auth'
import { createFileRoute } from '@tanstack/react-router'

async function handle({ request }: { request: Request }) {
  return auth.handler(request)
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PUT: handle,
      PATCH: handle,
      DELETE: handle,
    },
  },
})
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/api.auth.$.ts
git commit -m "feat: add Better Auth API route"
```

---

### Task 5: Create Better Auth browser client

**Files:**
- Create: `src/lib/auth-client.ts`

- [ ] **Step 1: Create src/lib/auth-client.ts**

```typescript
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: 'http://localhost:3000',
})
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth-client.ts
git commit -m "feat: add Better Auth browser client"
```

---

### Task 6: Configure Vitest for component testing

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Create vitest.config.ts**

A standalone config (does not inherit `tanstackStart()`, which is build-only). Uses an explicit alias for the `#/` path prefix.

```typescript
import path from 'path'
import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [viteReact()],
  resolve: {
    alias: {
      '#': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

- [ ] **Step 2: Create src/test/setup.ts**

```typescript
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 3: Run tests to confirm setup works**

```bash
npm test
```
Expected: exits cleanly (zero tests is fine at this point — no errors about missing config or environment).

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts src/test/setup.ts
git commit -m "chore: configure vitest for component testing"
```

---

### Task 7: Write and pass auth-modal component tests

**Files:**
- Create: `src/integrations/better-auth/auth-modal.test.tsx`
- Create: `src/integrations/better-auth/auth-modal.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/integrations/better-auth/auth-modal.test.tsx`:

```typescript
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
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
npm test -- src/integrations/better-auth/auth-modal.test.tsx
```
Expected: FAIL — "Cannot find module '#/integrations/better-auth/auth-modal'".

- [ ] **Step 3: Create src/integrations/better-auth/auth-modal.tsx**

```typescript
import { useState } from 'react'
import { Dialog, Tabs } from 'radix-ui'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Button } from '#/components/ui/button'
import { authClient } from '#/lib/auth-client'

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [error, setError] = useState<string | null>(null)

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
          <Tabs.Root defaultValue="signin" onValueChange={() => setError(null)}>
            <Tabs.List className="flex gap-4 mb-4 border-b">
              <Tabs.Trigger
                value="signin"
                className="pb-2 data-[state=active]:border-b-2 data-[state=active]:border-black"
              >
                Sign in
              </Tabs.Trigger>
              <Tabs.Trigger
                value="signup"
                className="pb-2 data-[state=active]:border-b-2 data-[state=active]:border-black"
              >
                Sign up
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="signin">
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
            </Tabs.Content>

            <Tabs.Content value="signup">
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
            </Tabs.Content>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npm test -- src/integrations/better-auth/auth-modal.test.tsx
```
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/integrations/better-auth/auth-modal.tsx src/integrations/better-auth/auth-modal.test.tsx
git commit -m "feat: add auth modal component with sign-in and sign-up tabs"
```

---

### Task 8: Write and pass header-user component tests

**Files:**
- Create: `src/integrations/better-auth/header-user.test.tsx`
- Create: `src/integrations/better-auth/header-user.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/integrations/better-auth/header-user.test.tsx`:

```typescript
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
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
npm test -- src/integrations/better-auth/header-user.test.tsx
```
Expected: FAIL — "Cannot find module '#/integrations/better-auth/header-user'".

- [ ] **Step 3: Create src/integrations/better-auth/header-user.tsx**

```typescript
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
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npm test -- src/integrations/better-auth/header-user.test.tsx
```
Expected: 3 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```
Expected: all 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/integrations/better-auth/header-user.tsx src/integrations/better-auth/header-user.test.tsx
git commit -m "feat: add Better Auth header user component"
```

---

### Task 9: Update __root.tsx

**Files:**
- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Replace the contents of src/routes/__root.tsx**

```typescript
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import HeaderUser from '../integrations/better-auth/header-user'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'TanStack Start Starter' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header className="flex items-center justify-end px-4 py-2 border-b">
          <HeaderUser />
        </header>
        {children}
        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[
            { name: 'Tanstack Router', render: <TanStackRouterDevtoolsPanel /> },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "feat: wire HeaderUser into root layout, remove ClerkProvider"
```

---

### Task 10: Remove Clerk

**Files:**
- Delete: `src/integrations/clerk/provider.tsx`
- Delete: `src/integrations/clerk/header-user.tsx`
- Modify: `package.json`

- [ ] **Step 1: Delete Clerk integration files**

```bash
rm src/integrations/clerk/provider.tsx src/integrations/clerk/header-user.tsx
rmdir src/integrations/clerk
```

- [ ] **Step 2: Uninstall @clerk/clerk-react**

```bash
npm uninstall @clerk/clerk-react
```
Expected: `@clerk/clerk-react` no longer in `package.json`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors (no remaining Clerk imports anywhere).

- [ ] **Step 4: Run full test suite**

```bash
npm test
```
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove Clerk auth"
```

---

### Task 11: Verify dev server

**Files:** none

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```
Expected: server starts on http://localhost:3000 with no console errors.

- [ ] **Step 2: Manual smoke test**

1. Open http://localhost:3000 — header shows "Sign in" button
2. Click "Sign in" — modal opens with Sign in / Sign up tabs
3. Switch to "Sign up" tab — name, email, password fields appear
4. Register with a test email and password — modal closes, header shows email + "Sign out"
5. Click "Sign out" — header returns to "Sign in" button
6. Click "Sign in", log in with the same credentials — header shows email again

- [ ] **Step 3: Commit any fixes**

If any issues surfaced during smoke testing, fix them and commit:
```bash
git add -A
git commit -m "fix: <describe fix>"
```
