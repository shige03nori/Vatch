import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, notFound, serverError, requireProper } from '@/lib/api'

export async function GET(_request: Request): Promise<NextResponse> {
  const authResult = await requireProper()
  if (authResult instanceof NextResponse) return authResult
  const { session } = authResult

  try {
    const talent = await prisma.talent.findFirst({
      where: { userId: session.user.id, talentType: 'PROPER' },
    })
    if (!talent) return notFound()

    const [matchings, favorites] = await Promise.all([
      prisma.matching.findMany({
        where: { talentId: talent.id, status: { not: 'REJECTED' } },
        include: { case: true },
        orderBy: { score: 'desc' },
      }),
      prisma.favorite.findMany({
        where: { userId: session.user.id },
        select: { caseId: true },
      }),
    ])

    const favCaseIds = new Set(favorites.map((f) => f.caseId))
    const data = matchings.map((m) => ({ ...m, isFavorited: favCaseIds.has(m.caseId) }))
    return ok(data)
  } catch {
    return serverError()
  }
}
