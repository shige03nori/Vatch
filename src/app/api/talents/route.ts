// src/app/api/talents/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, created, unprocessable, serverError, requireAuth } from '@/lib/api'
import { CreateTalentSchema, TalentQuerySchema } from '@/lib/schemas/talent'

export async function GET(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { searchParams } = new URL(request.url)
  const query = TalentQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!query.success) return unprocessable(query.error.errors)

  const { status, skills, workStyle, page, limit } = query.data
  const skillsArr = skills ? skills.split(',').map(s => s.trim()) : undefined

  const where = {
    ...(isAdmin ? {} : { assignedUserId: session.user.id }),
    ...(status ? { status } : {}),
    ...(workStyle ? { workStyle } : {}),
    ...(skillsArr ? { skills: { hasEvery: skillsArr } } : {}),
  }

  try {
    const [data, total] = await Promise.all([
      prisma.talent.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.talent.count({ where }),
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
  const parsed = CreateTalentSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.errors)

  const data = {
    ...parsed.data,
    assignedUserId: isAdmin ? parsed.data.assignedUserId : session.user.id,
  }

  try {
    const record = await prisma.talent.create({ data })
    return created(record)
  } catch {
    return serverError()
  }
}
