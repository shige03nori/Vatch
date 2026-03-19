// src/lib/api.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import type { Session } from 'next-auth'

export type PaginationMeta = { total: number; page: number; limit: number }

export function ok(data: unknown, meta?: PaginationMeta): NextResponse {
  const body = meta ? { success: true, data, meta } : { success: true, data }
  return NextResponse.json(body, { status: 200 })
}

export function created(data: unknown): NextResponse {
  return NextResponse.json({ success: true, data }, { status: 201 })
}

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 }
  )
}

export function forbidden(): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } },
    { status: 403 }
  )
}

export function notFound(): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } },
    { status: 404 }
  )
}

export function unprocessable(errors: unknown): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', errors } },
    { status: 422 }
  )
}

export function serverError(): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
    { status: 500 }
  )
}

export async function requireAuth(): Promise<{ session: Session; isAdmin: boolean } | NextResponse> {
  const session = await auth()
  if (!session?.user) return unauthorized()
  const isAdmin = session.user.role === 'ADMIN'
  return { session, isAdmin }
}
