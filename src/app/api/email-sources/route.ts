// src/app/api/email-sources/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, created, forbidden, unprocessable, serverError, requireAuth } from '@/lib/api'
import { CreateEmailSourceSchema } from '@/lib/schemas/email-source'
import { encrypt } from '@/lib/crypto'

const ENCRYPTION_KEY = process.env.EMAIL_SOURCE_ENCRYPTION_KEY ?? ''

export async function GET(): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  try {
    const sources = await prisma.emailSource.findMany({ orderBy: { createdAt: 'asc' } })
    // imapPass を除外して返す
    const safeData = sources.map(({ imapPass: _, ...rest }) => rest)
    return ok(safeData)
  } catch {
    return serverError()
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  if (!authResult.isAdmin) return forbidden()

  const body = await request.json().catch(() => ({}))
  const parsed = CreateEmailSourceSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.issues)

  try {
    const { imapPass, ...rest } = parsed.data
    const record = await prisma.emailSource.create({
      data: { ...rest, imapPass: encrypt(imapPass, ENCRYPTION_KEY) },
    })
    const { imapPass: _, ...safeRecord } = record
    return created(safeRecord)
  } catch {
    return serverError()
  }
}
