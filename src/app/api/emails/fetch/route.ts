// src/app/api/emails/fetch/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ok, unauthorized, forbidden, serverError } from '@/lib/api'
import { runIngestion } from '@/lib/email-ingestion'

function triggerMatchingGenerate() {
  const internalKey = process.env.INTERNAL_API_KEY
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  fetch(`${baseUrl}/api/matchings/generate`, {
    method: 'POST',
    headers: internalKey ? { Authorization: `Bearer ${internalKey}` } : {},
  }).catch(() => { /* 失敗しても取込結果に影響させない */ })
}

export async function POST(request: Request): Promise<NextResponse> {
  // セッション認証とAPIキー認証を並行して確認
  const session = await auth()

  // 内部APIキー認証（cronからの呼び出し用）
  const authHeader = request.headers.get('Authorization')
  const internalKey = process.env.INTERNAL_API_KEY
  if (internalKey && authHeader === `Bearer ${internalKey}`) {
    try {
      const result = await runIngestion()
      triggerMatchingGenerate()
      return ok(result)
    } catch {
      return serverError()
    }
  }

  // 通常のセッション認証
  if (!session?.user) return unauthorized()
  if (session.user.role !== 'ADMIN') return forbidden()

  try {
    const result = await runIngestion()
    triggerMatchingGenerate()
    return ok(result)
  } catch {
    return serverError()
  }
}
