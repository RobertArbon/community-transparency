# Better Auth Migration Design

**Date:** 2026-04-26
**Status:** Approved

## Summary

Replace Clerk auth with Better Auth (email + password only) in the community-transparency TanStack Start app. Clerk is lightly used — only a provider wrapper and a header user component — so the migration surface is small.

## Architecture

Better Auth is split into three pieces:

**Server config** — `src/lib/auth.ts`
- `betterAuth()` with Prisma adapter (reuses the existing Prisma client from `src/db.ts`)
- `emailAndPassword` plugin enabled
- Reads `process.env.BETTER_AUTH_SECRET` and `process.env.BETTER_AUTH_URL` directly (server-only file; Vite's `import.meta.env` is not used here)

**Client config** — `src/lib/auth-client.ts`
- `createAuthClient()` pointed at the app's base URL
- Exports `useSession`, `signIn`, `signUp`, `signOut`

**API route** — `src/routes/api.auth.$.ts`
- Catch-all TanStack Start server route at `/api/auth/**`
- Passes all requests to Better Auth's fetch handler
- No auth context needed in the handler itself

`ClerkProvider` is removed from `src/routes/__root.tsx`. Better Auth requires no context provider.

## Database Schema

Four tables added to `prisma/schema.prisma` (Better Auth's required shape). Existing `Meeting` and `Tag` models are untouched.

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

Run `prisma migrate dev --name add-better-auth` after updating the schema.

## Environment

`.env.local` changes:
- Remove `VITE_CLERK_PUBLISHABLE_KEY`
- Remove `CLERK_SECRET_KEY`
- Add `BETTER_AUTH_SECRET=<random 32+ char string>`
- Add `BETTER_AUTH_URL=http://localhost:3000`

`src/env.ts` changes:
- Add `BETTER_AUTH_SECRET: z.string().min(1)` to server schema
- Add `BETTER_AUTH_URL: z.string().url()` to server schema

## UI Components

Replace `src/integrations/clerk/` with `src/integrations/better-auth/`:

**`header-user.tsx`**
- Calls `authClient.useSession()`
- Signed in: shows `session.data.user.email` + "Sign out" button (calls `authClient.signOut()`)
- Signed out: shows "Sign in" button that opens the auth modal

**`auth-modal.tsx`**
- Radix UI `Dialog` (already a dep via `radix-ui`)
- Two tabs: Sign In / Sign Up
- Sign In: email + password → `authClient.signIn.email()`
- Sign Up: name + email + password → `authClient.signUp.email()`
- Uses existing shadcn `<Input>`, `<Label>`, `<Button>` components
- Inline error messages on failure
- Modal closes on success

`src/routes/__root.tsx` is updated to:
- Remove `ClerkProvider` import and wrapper
- Import `HeaderUser` from the new location
- Add a `<header>` element inside `<body>` (above `{children}`) that renders `<HeaderUser />`

Note: `header-user.tsx` was defined but never rendered in the existing Clerk integration — this migration wires it up for the first time.

## Cleanup

- Delete `src/integrations/clerk/provider.tsx`
- Delete `src/integrations/clerk/header-user.tsx`
- Remove `@clerk/clerk-react` from `package.json` and run `npm uninstall @clerk/clerk-react`
- Remove Clerk env vars from `.env.local`
