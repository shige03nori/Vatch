// src/app/api/sales/pipeline/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, unprocessable, serverError, requireAuth } from '@/lib/api'
import { PipelineQuerySchema } from '@/lib/schemas/sales'

export async function GET(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { searchParams } = new URL(request.url)
  const query = PipelineQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!query.success) return unprocessable(query.error.issues)

  const { status } = query.data

  const where = {
    ...(isAdmin ? {} : { case: { assignedUserId: session.user.id } }),
    ...(status ? { status } : {}),
  }

  try {
    const data = await prisma.matching.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        case: {
          include: {
            assignedUser: { select: { id: true, name: true } },
          },
        },
        talent: {
          select: { id: true, name: true, skills: true, experience: true, desiredRate: true },
        },
        proposal: {
          select: { id: true, status: true, to: true, cc: true, subject: true, bodyText: true, sentAt: true, grossProfitRate: true, costPrice: true, sellPrice: true },
        },
      },
    })
    return ok(data)
  } catch {
    return serverError()
  }
}
