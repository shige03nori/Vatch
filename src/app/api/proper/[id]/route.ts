import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, notFound, unprocessable, serverError, requireStaff } from '@/lib/api'
import { UpdateProperSchema } from '@/lib/schemas/proper'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authResult = await requireStaff()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params
  try {
    const talent = await prisma.talent.findUnique({
      where: { id, talentType: 'PROPER' },
      include: { properUser: { select: { id: true, email: true, name: true } } },
    })
    if (!talent) return notFound()
    return ok(talent)
  } catch {
    return serverError()
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authResult = await requireStaff()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = UpdateProperSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.issues)

  try {
    const existing = await prisma.talent.findUnique({ where: { id } })
    if (!existing || existing.talentType !== 'PROPER') return notFound()
    const talent = await prisma.talent.update({ where: { id }, data: parsed.data })
    return ok(talent)
  } catch {
    return serverError()
  }
}
