import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, forbidden, notFound, serverError, requireAuth } from '@/lib/api'
import { decryptContent } from '@/lib/email-encryptor'

type Params = { params: Promise<{ id: string; jobId: string }> }

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { id, jobId } = await params

  try {
    const job = await prisma.emailJob.findUnique({
      where: { id: jobId },
      include: {
        proposal: {
          include: {
            matching: {
              include: {
                case: true,
              },
            },
          },
        },
      },
    })

    if (!job) return notFound()

    // 提案へのアクセス権確認
    if (job.proposal.id !== id) {
      return notFound()
    }

    if (!isAdmin && job.proposal.matching.case.assignedUserId !== session.user.id) {
      return forbidden()
    }

    // generatedContent を復号化
    let decryptedContent = null
    if (job.generatedContent) {
      try {
        decryptedContent = decryptContent(job.generatedContent)
      } catch (error) {
        console.error('Decryption failed:', error)
      }
    }

    const response = {
      id: job.id,
      proposalId: job.proposalId,
      status: job.status,
      generatedContent: decryptedContent,
      sendType: job.sendType,
      scheduledAt: job.scheduledAt?.toISOString() ?? null,
      sentAt: job.sentAt?.toISOString() ?? null,
      attachmentPath: job.attachmentPath,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    }

    return ok(response)
  } catch (error) {
    console.error('Error in GET email-jobs:', error)
    return serverError()
  }
}

export async function DELETE(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { id, jobId } = await params

  try {
    const job = await prisma.emailJob.findUnique({
      where: { id: jobId },
      include: {
        proposal: {
          include: {
            matching: {
              include: {
                case: true,
              },
            },
          },
        },
      },
    })

    if (!job) return notFound()

    // 提案へのアクセス権確認
    if (job.proposal.id !== id) {
      return notFound()
    }

    if (!isAdmin && job.proposal.matching.case.assignedUserId !== session.user.id) {
      return forbidden()
    }

    // SCHEDULED 状態のみ削除可能
    if (job.status !== 'SCHEDULED') {
      return forbidden()
    }

    await prisma.emailJob.delete({
      where: { id: jobId },
    })

    return ok({ success: true, message: 'ジョブを削除しました' })
  } catch (error) {
    console.error('Error in DELETE email-jobs:', error)
    return serverError()
  }
}
