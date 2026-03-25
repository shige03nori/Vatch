// src/app/api/matchings/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, created, unprocessable, serverError, requireAuth } from '@/lib/api'
import { CreateMatchingSchema, MatchingQuerySchema } from '@/lib/schemas/matching'

export async function GET(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { searchParams } = new URL(request.url)
  const query = MatchingQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!query.success) return unprocessable(query.error.issues)

  const { caseId, talentId, status, page, limit } = query.data

  const where = {
    ...(isAdmin ? {} : { case: { assignedUserId: session.user.id } }),
    ...(caseId ? { caseId } : {}),
    ...(talentId ? { talentId } : {}),
    ...(status ? { status } : {}),
  }

  try {
    const [data, total] = await Promise.all([
      prisma.matching.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          case:   { select: { id: true, title: true, client: true, unitPrice: true, workStyle: true, startDate: true } },
          talent: { select: { id: true, name: true, skills: true, desiredRate: true, agencyEmail: true } },
        },
      }),
      prisma.matching.count({ where }),
    ])
    return ok(data, { total, page, limit })
  } catch {
    return serverError()
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const body = await request.json().catch(() => ({}))
  const parsed = CreateMatchingSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.issues)

  try {
    const record = await prisma.matching.create({ data: parsed.data })
    return created(record)
  } catch {
    return serverError()
  }
}
