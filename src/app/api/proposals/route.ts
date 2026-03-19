// src/app/api/proposals/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, created, unprocessable, serverError, requireAuth } from '@/lib/api'
import { CreateProposalSchema, ProposalQuerySchema } from '@/lib/schemas/proposal'

export async function GET(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { searchParams } = new URL(request.url)
  const query = ProposalQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!query.success) return unprocessable(query.error.errors)

  const { status, page, limit } = query.data

  const where = {
    ...(isAdmin ? {} : { matching: { case: { assignedUserId: session.user.id } } }),
    ...(status ? { status } : {}),
  }

  try {
    const [data, total] = await Promise.all([
      prisma.proposal.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.proposal.count({ where }),
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
  const parsed = CreateProposalSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.errors)

  try {
    const record = await prisma.proposal.create({ data: parsed.data })
    return created(record)
  } catch {
    return serverError()
  }
}
