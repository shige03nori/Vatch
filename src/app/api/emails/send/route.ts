import { NextResponse } from 'next/server'
import { z } from 'zod'
import * as fs from 'fs/promises'
import { ok, unprocessable, notFound, forbidden, serverError, requireAuth } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { getFileStorage } from '@/lib/file-storage'

const SendEmailSchema = z.object({
  proposalId: z.string().cuid(),
})

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const body = await request.json().catch(() => null)
  const parsed = SendEmailSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.issues)

  const { proposalId } = parsed.data

  try {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        matching: {
          include: {
            case:   { select: { assignedUserId: true } },
            talent: { select: { resumeKey: true, resumeFilename: true } },
          },
        },
      },
    })
    if (!proposal) return notFound()
    if (!isAdmin && proposal.matching.case.assignedUserId !== session.user.id) return forbidden()

    // 経歴書添付（スタブ: ファイルの存在確認とログ出力のみ）
    let attachmentFilename: string | null = null
    const { resumeKey, resumeFilename } = proposal.matching.talent
    if (resumeKey) {
      try {
        // LocalStorage.getUrl() returns a filesystem path; will need stream-based reading when S3 is added
        const filePath = getFileStorage().getUrl(resumeKey)
        await fs.readFile(filePath)
        attachmentFilename = resumeFilename ?? resumeKey
      } catch {
        console.warn(`[EMAIL SEND] 経歴書ファイルの読み取り失敗: ${resumeKey}`)
      }
    }

    console.log('=== [EMAIL SEND] ===========================')
    console.log(`To:      ${proposal.to}`)
    if (proposal.cc) console.log(`CC:      ${proposal.cc}`)
    console.log(`Subject: ${proposal.subject}`)
    if (attachmentFilename) console.log(`Attachment: ${attachmentFilename}`)
    console.log('--------------------------------------------')
    console.log(proposal.bodyText)
    console.log('============================================')

    await Promise.all([
      prisma.proposal.update({
        where: { id: proposalId },
        data:  { status: 'SENT', sentAt: new Date() },
      }),
      prisma.matching.update({
        where: { id: proposal.matchingId },
        data:  { status: 'SENT' },
      }),
    ])

    return ok({ sent: true })
  } catch {
    return serverError()
  }
}
