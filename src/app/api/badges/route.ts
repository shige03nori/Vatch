import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, serverError, requireAuth } from '@/lib/api'

export async function GET(): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  try {
    const matchingWhere = isAdmin
      ? { status: 'PENDING_AUTO' as const }
      : { status: 'PENDING_AUTO' as const, case: { assignedUserId: session.user.id } }

    const [emails, matchings] = await Promise.all([
      prisma.email.count({ where: { status: 'PENDING' } }),
      prisma.matching.count({ where: matchingWhere }),
    ])

    return ok({ emails, matchings })
  } catch {
    return serverError()
  }
}
