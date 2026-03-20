// src/app/api/emails/fetch/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ok, unauthorized, forbidden, serverError } from '@/lib/api'
import { runIngestion } from '@/lib/email-ingestion'

export async function POST(request: Request): Promise<NextResponse> {
  // セッション認証とAPIキー認証を並行して確認
  const session = await auth()

  // 内部APIキー認証（cronからの呼び出し用）
  const authHeader = request.headers.get('Authorization')
  const internalKey = process.env.INTERNAL_API_KEY
  if (internalKey && authHeader === `Bearer ${internalKey}`) {
    try {
      return ok(await runIngestion())
    } catch {
      return serverError()
    }
  }

  // 通常のセッション認証
  if (!session?.user) return unauthorized()
  if (session.user.role !== 'ADMIN') return forbidden()

  try {
    return ok(await runIngestion())
  } catch {
    return serverError()
  }
}
