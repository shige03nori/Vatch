import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, serverError, requireProper } from '@/lib/api'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> }
): Promise<NextResponse> {
  const authResult = await requireProper()
  if (authResult instanceof NextResponse) return authResult
  const { session } = authResult

  const { caseId } = await params
  try {
    await prisma.favorite.deleteMany({ where: { userId: session.user.id, caseId } })
    return ok({ deleted: true })
  } catch {
    return serverError()
  }
}
