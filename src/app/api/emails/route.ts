// src/app/api/emails/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, created, forbidden, unprocessable, serverError, requireAuth } from '@/lib/api'
import { CreateEmailSchema, EmailQuerySchema } from '@/lib/schemas/email'

export async function GET(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  // Email は共有受信箱（assignedUserId なし）— STAFF/ADMIN ともにフィルタなしで全件参照可

  const { searchParams } = new URL(request.url)
  const query = EmailQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!query.success) return unprocessable(query.error.errors)

  const { type, status, page, limit } = query.data
  const where = {
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
  }

  try {
    const [data, total] = await Promise.all([
      prisma.email.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { receivedAt: 'desc' } }),
      prisma.email.count({ where }),
    ])
    return ok(data, { total, page, limit })
  } catch {
    return serverError()
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { isAdmin } = authResult

  if (!isAdmin) return forbidden()

  const body = await request.json().catch(() => ({}))
  const parsed = CreateEmailSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.errors)

  try {
    const record = await prisma.email.create({ data: parsed.data })
    return created(record)
  } catch {
    return serverError()
  }
}
