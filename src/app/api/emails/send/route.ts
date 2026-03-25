import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, unprocessable, requireAuth } from '@/lib/api'

const SendEmailSchema = z.object({
  to:       z.string().email(),
  cc:       z.string().email().optional(),
  subject:  z.string().min(1),
  bodyText: z.string().min(1),
})

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const body = await request.json().catch(() => null)
  const parsed = SendEmailSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.issues)

  const { to, cc, subject, bodyText } = parsed.data

  // TODO: 実際のメール送信（Gmail API等）に差し替える
  console.log('=== [EMAIL SEND] ===========================')
  console.log(`To:      ${to}`)
  if (cc) console.log(`CC:      ${cc}`)
  console.log(`Subject: ${subject}`)
  console.log('--------------------------------------------')
  console.log(bodyText)
  console.log('============================================')

  return ok({ sent: true })
}
