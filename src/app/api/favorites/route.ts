import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, created, unprocessable, serverError, requireProper } from '@/lib/api'

export async function GET(_request: Request): Promise<NextResponse> {
  const authResult = await requireProper()
  if (authResult instanceof NextResponse) return authResult
  const { session } = authResult

  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: session.user.id },
      include: { case: true },
      orderBy: { createdAt: 'desc' },
    })
    return ok(favorites)
  } catch {
    return serverError()
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireProper()
  if (authResult instanceof NextResponse) return authResult
  const { session } = authResult

  const body = await request.json().catch(() => ({}))
  const parsed = z.object({ caseId: z.string().cuid() }).safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.issues)

  try {
    const record = await prisma.favorite.create({
      data: { userId: session.user.id, caseId: parsed.data.caseId },
    })
    return created(record)
  } catch {
    return serverError()
  }
}
