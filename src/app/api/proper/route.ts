import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { ok, created, unprocessable, serverError, requireStaff } from '@/lib/api'
import { CreateProperSchema, ProperQuerySchema } from '@/lib/schemas/proper'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function GET(request: Request): Promise<NextResponse> {
  const authResult = await requireStaff()
  if (authResult instanceof NextResponse) return authResult

  const { searchParams } = new URL(request.url)
  const query = ProperQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!query.success) return unprocessable(query.error.issues)

  const { office, status, page, limit } = query.data
  const where = {
    talentType: 'PROPER' as const,
    ...(office ? { office } : {}),
    ...(status ? { status } : {}),
  }

  try {
    const [data, total] = await Promise.all([
      prisma.talent.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.talent.count({ where }),
    ])
    return ok(data, { total, page, limit })
  } catch {
    return serverError()
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireStaff()
  if (authResult instanceof NextResponse) return authResult
  const { session } = authResult

  const body = await request.json().catch(() => ({}))
  const parsed = CreateProperSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.issues)

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    return NextResponse.json(
      { success: false, error: { code: 'CONFLICT', message: 'このメールアドレスは既に登録されています' } },
      { status: 409 }
    )
  }

  const tempPassword = generateTempPassword()
  const hashedPassword = await bcrypt.hash(tempPassword, 10)

  try {
    const { user, talent } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: parsed.data.name, email: parsed.data.email, role: 'PROPER', password: hashedPassword },
      })
      const talent = await tx.talent.create({
        data: {
          name:           parsed.data.name,
          skills:         parsed.data.skills,
          experience:     parsed.data.experience,
          desiredRate:    parsed.data.desiredRate,
          location:       parsed.data.location,
          workStyle:      parsed.data.workStyle,
          talentType:     'PROPER',
          office:         parsed.data.office,
          userId:         user.id,
          assignedUserId: session.user.id,
          ...(parsed.data.availableFrom ? { availableFrom: parsed.data.availableFrom } : {}),
        },
      })
      return { user, talent }
    })
    return created({ talent, user: { id: user.id, email: user.email, name: user.name }, tempPassword })
  } catch {
    return serverError()
  }
}
