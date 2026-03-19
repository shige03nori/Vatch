// src/app/api/matchings/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, forbidden, notFound, unprocessable, serverError, requireAuth } from '@/lib/api'
import { UpdateMatchingSchema } from '@/lib/schemas/matching'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { id } = await params
  try {
    const record = await prisma.matching.findUnique({
      where: { id },
      include: { case: true, talent: true, proposal: true },
    })
    if (!record) return notFound()
    if (!isAdmin && record.case.assignedUserId !== session.user.id) return forbidden()
    return ok(record)
  } catch {
    return serverError()
  }
}

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { id } = await params
  try {
    const existing = await prisma.matching.findUnique({ where: { id }, include: { case: true } })
    if (!existing) return notFound()
    if (!isAdmin && existing.case.assignedUserId !== session.user.id) return forbidden()

    const body = await request.json().catch(() => ({}))
    const parsed = UpdateMatchingSchema.safeParse(body)
    if (!parsed.success) return unprocessable(parsed.error.issues)

    const record = await prisma.matching.update({ where: { id }, data: parsed.data })
    return ok(record)
  } catch {
    return serverError()
  }
}

export async function DELETE(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { isAdmin } = authResult

  if (!isAdmin) return forbidden()

  const { id } = await params
  try {
    const existing = await prisma.matching.findUnique({ where: { id } })
    if (!existing) return notFound()
    const record = await prisma.matching.delete({ where: { id } })
    return ok(record)
  } catch {
    return serverError()
  }
}
