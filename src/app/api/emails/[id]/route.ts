// src/app/api/emails/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, forbidden, notFound, unprocessable, serverError, requireAuth } from '@/lib/api'
import { UpdateEmailSchema } from '@/lib/schemas/email'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params
  try {
    const record = await prisma.email.findUnique({ where: { id } })
    if (!record) return notFound()
    return ok(record)
  } catch {
    return serverError()
  }
}

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { isAdmin } = authResult

  if (!isAdmin) return forbidden()

  const { id } = await params
  try {
    const existing = await prisma.email.findUnique({ where: { id } })
    if (!existing) return notFound()

    const body = await request.json().catch(() => ({}))
    const parsed = UpdateEmailSchema.safeParse(body)
    if (!parsed.success) return unprocessable(parsed.error.errors)

    const record = await prisma.email.update({ where: { id }, data: parsed.data })
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
    const existing = await prisma.email.findUnique({ where: { id } })
    if (!existing) return notFound()
    const record = await prisma.email.delete({ where: { id } })
    return ok(record)
  } catch {
    return serverError()
  }
}
