import { NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { ok, unprocessable, serverError, requireStaff } from '@/lib/api'
import { extractTalentInfo } from '@/lib/resume-extractor'

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireStaff()
  if (authResult instanceof NextResponse) return authResult

  const formData = await request.formData().catch(() => null)
  if (!formData) return unprocessable([{ path: ['body'], message: 'multipart/form-data が必要です' }])

  const file = formData.get('file') as File | null
  if (!file) return unprocessable([{ path: ['file'], message: 'ファイルが必要です' }])

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const { value: text } = await mammoth.extractRawText({ buffer })
    if (!text.trim()) return unprocessable([{ path: ['file'], message: 'ファイルからテキストを抽出できませんでした' }])

    const extracted = await extractTalentInfo(text)
    return ok(extracted)
  } catch {
    return serverError()
  }
}
