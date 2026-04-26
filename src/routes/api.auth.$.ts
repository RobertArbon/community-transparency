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
