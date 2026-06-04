import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { ok, notFound, serverError, requireStaff } from '@/lib/api'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authResult = await requireStaff()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params
  try {
    const talent = await prisma.talent.findUnique({
      where: { id, talentType: 'PROPER' },
      select: { userId: true },
    })
    if (!talent?.userId) return notFound()

    const tempPassword = generateTempPassword()
    await prisma.user.update({
      where: { id: talent.userId },
      data: { password: await bcrypt.hash(tempPassword, 10) },
    })
    return ok({ tempPassword })
  } catch {
    return serverError()
  }
}
