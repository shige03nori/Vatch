// src/app/api/proposals/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, forbidden, notFound, unprocessable, serverError, requireAuth } from '@/lib/api'
import { UpdateProposalSchema } from '@/lib/schemas/proposal'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { id } = await params
  try {
    const record = await prisma.proposal.findUnique({
      where: { id },
      include: { matching: { include: { case: true, talent: true } } },
    })
    if (!record) return notFound()
    if (!isAdmin && record.matching.case.assignedUserId !== session.user.id) return forbidden()
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
    const existing = await prisma.proposal.findUnique({
      where: { id },
      include: { matching: { include: { case: true } } },
    })
    if (!existing) return notFound()
    if (!isAdmin && existing.matching.case.assignedUserId !== session.user.id) return forbidden()

    const body = await request.json().catch(() => ({}))
    const parsed = UpdateProposalSchema.safeParse(body)
    if (!parsed.success) return unprocessable(parsed.error.errors)

    const record = await prisma.proposal.update({ where: { id }, data: parsed.data })
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
    const existing = await prisma.proposal.findUnique({ where: { id } })
    if (!existing) return notFound()
    if (existing.status !== 'DRAFT') {
      return unprocessable([{ message: 'Only DRAFT proposals can be deleted' }])
    }
    const record = await prisma.proposal.delete({ where: { id } })
    return ok(record)
  } catch {
    return serverError()
  }
}
