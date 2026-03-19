// src/app/api/cases/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, created, unprocessable, serverError, requireAuth } from '@/lib/api'
import { CreateCaseSchema, CaseQuerySchema } from '@/lib/schemas/case'

export async function GET(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { searchParams } = new URL(request.url)
  const query = CaseQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!query.success) return unprocessable(query.error.errors)

  const { status, skills, dateFrom, dateTo, page, limit } = query.data
  const skillsArr = skills ? skills.split(',').map(s => s.trim()) : undefined

  const where = {
    ...(isAdmin ? {} : { assignedUserId: session.user.id }),
    ...(status ? { status } : {}),
    ...(skillsArr ? { skills: { hasEvery: skillsArr } } : {}),
    ...(dateFrom || dateTo ? { startDate: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
  }

  try {
    const [data, total] = await Promise.all([
      prisma.case.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.case.count({ where }),
    ])
    return ok(data, { total, page, limit })
  } catch {
    return serverError()
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const body = await request.json().catch(() => ({}))
  const parsed = CreateCaseSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.errors)

  const data = {
    ...parsed.data,
    assignedUserId: isAdmin ? parsed.data.assignedUserId : session.user.id,
  }

  try {
    const record = await prisma.case.create({ data })
    return created(record)
  } catch {
    return serverError()
  }
}
