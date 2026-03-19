// src/app/api/contracts/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, forbidden, notFound, unprocessable, serverError, requireAuth } from '@/lib/api'
import { UpdateContractSchema } from '@/lib/schemas/contract'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { id } = await params
  try {
    const record = await prisma.contract.findUnique({ where: { id } })
    if (!record) return notFound()
    if (!isAdmin && record.assignedUserId !== session.user.id) return forbidden()
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
    const existing = await prisma.contract.findUnique({ where: { id } })
    if (!existing) return notFound()
    if (!isAdmin && existing.assignedUserId !== session.user.id) return forbidden()

    const body = await request.json().catch(() => ({}))
    const parsed = UpdateContractSchema.safeParse(body)
    if (!parsed.success) return unprocessable(parsed.error.errors)

    const record = await prisma.contract.update({ where: { id }, data: parsed.data })
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
    const existing = await prisma.contract.findUnique({ where: { id } })
    if (!existing) return notFound()
    const record = await prisma.contract.delete({ where: { id } })
    return ok(record)
  } catch {
    return serverError()
  }
}
