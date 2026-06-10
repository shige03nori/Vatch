import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { ok, forbidden, notFound, unprocessable, serverError, requireAuth } from '@/lib/api'
import { SendEmailRequestSchema } from '@/lib/schemas/email-job'
import { generateEmailContent } from '@/lib/email-generator'
import { encryptContent } from '@/lib/email-encryptor'
import { getFileStorage } from '@/lib/file-storage'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { id } = await params

  try {
    const body = await request.json().catch(() => ({}))
    const validation = SendEmailRequestSchema.safeParse(body)
    if (!validation.success) return unprocessable(validation.error.issues)

    // Proposal 取得（with case, talent, contract）
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        matching: {
          include: {
            case: true,
            talent: true,
          },
        },
        contract: true,
      },
    })

    if (!proposal) return notFound()

    // 権限チェック（STAFF は自分の案件のみ）
    if (!isAdmin && proposal.matching.case.assignedUserId !== session.user.id) {
      return forbidden()
    }

    // スケジュール送信の場合、時刻が過去でないか確認
    if (validation.data.sendType === 'SCHEDULED' && validation.data.scheduledAt) {
      const scheduledTime = new Date(validation.data.scheduledAt)
      if (scheduledTime <= new Date()) {
        return unprocessable([{ message: 'スケジュール時刻は現在時刻より後で指定してください' }])
      }
    }

    // ジョブ作成（最初は PENDING）
    const job = await prisma.emailJob.create({
      data: {
        proposalId: proposal.id,
        status: 'PENDING',
        sendType: validation.data.sendType,
        scheduledAt: validation.data.scheduledAt
          ? new Date(validation.data.scheduledAt)
          : null,
      },
    })

    // バックグラウンド処理開始（非同期）
    processEmailJob(job.id, proposal, job.sendType).catch((err) => {
      console.error('Error processing email job:', err)
    })

    return ok({ jobId: job.id, status: job.status })
  } catch (error) {
    console.error('Error in send-email:', error)
    return serverError()
  }
}

async function processEmailJob(
  jobId: string,
  proposal: any,
  sendType: string
): Promise<void> {
  try {
    // Status 更新: GENERATING
    await prisma.emailJob.update({
      where: { id: jobId },
      data: { status: 'GENERATING' },
    })

    // メール生成
    const emailContent = await generateEmailContent({
      proposal: {
        title: proposal.matching.case.title,
        client: proposal.matching.case.client,
        amount: proposal.sellPrice,
        startDate: proposal.matching.case.startDate,
      },
      contract: {
        unitPrice: proposal.contract?.unitPrice || proposal.sellPrice,
        costPrice: proposal.contract?.costPrice || proposal.costPrice,
        grossProfitRate: proposal.contract?.grossProfitRate || proposal.grossProfitRate,
        status: proposal.contract?.status || 'ACTIVE',
      },
      talent: {
        name: proposal.matching.talent.name,
        email: proposal.matching.talent.email,
        skills: proposal.matching.talent.skills || [],
        experience: String(proposal.matching.talent.experience || ''),
        cv: '', // TODO: Talent.cv から取得
      },
    })

    // コンテンツを暗号化して保存
    const encryptedContent = encryptContent(emailContent)

    const resumeKey = proposal.matching.talent.resumeKey
    let attachmentPath: string | null = null
    if (resumeKey && !resumeKey.includes('..') && !path.isAbsolute(resumeKey)) {
      const resolvedPath = getFileStorage().getUrl(resumeKey)
      if (fs.existsSync(resolvedPath)) {
        attachmentPath = resolvedPath
      }
    }

    // SendType が NOW の場合、即座に送信
    if (sendType === 'NOW') {
      // Status 更新: SENDING
      await prisma.emailJob.update({
        where: { id: jobId },
        data: {
          status: 'SENDING',
          generatedContent: encryptedContent,
          attachmentPath,
        },
      })

      // メール送信（バックエンド処理で実装）
      // await sendEmail(...)

      // Status 更新: SENT
      await prisma.emailJob.update({
        where: { id: jobId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
        },
      })
    } else {
      // SCHEDULED の場合
      await prisma.emailJob.update({
        where: { id: jobId },
        data: {
          status: 'SCHEDULED',
          generatedContent: encryptedContent,
          attachmentPath,
        },
      })
    }
  } catch (error) {
    console.error('Error in processEmailJob:', error)
    await prisma.emailJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    })
  }
}
