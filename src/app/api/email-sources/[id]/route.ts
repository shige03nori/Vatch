// src/app/api/email-sources/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, forbidden, notFound, unprocessable, serverError, requireAuth } from '@/lib/api'
import { UpdateEmailSourceSchema } from '@/lib/schemas/email-source'
import { encrypt } from '@/lib/crypto'

const ENCRYPTION_KEY = process.env.EMAIL_SOURCE_ENCRYPTION_KEY ?? ''

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  if (!authResult.isAdmin) return forbidden()

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = UpdateEmailSourceSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.issues)

  try {
    const { imapPass, ...rest } = parsed.data
    const data = {
      ...rest,
      ...(imapPass !== undefined ? { imapPass: encrypt(imapPass, ENCRYPTION_KEY) } : {}),
    }
    const record = await prisma.emailSource.update({ where: { id }, data })
    const { imapPass: _, ...safeRecord } = record
    return ok(safeRecord)
  } catch {
    return serverError()
  }
}

export async function DELETE(_request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  if (!authResult.isAdmin) return forbidden()

  const { id } = await params
  try {
    await prisma.emailSource.delete({ where: { id } })
    return ok({ deleted: true })
  } catch (err: unknown) {
    // Prismaの「レコードが見つからない」エラー（P2025）のみ404
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code: string }).code === 'P2025'
    ) {
      return notFound()
    }
    return serverError()
  }
}
