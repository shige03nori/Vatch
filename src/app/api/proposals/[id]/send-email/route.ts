import { NextResponse } from 'next/server'
import { access, readFile } from 'fs/promises'
import mammoth from 'mammoth'
import { prisma } from '@/lib/prisma'
import { ok, forbidden, notFound, unprocessable, serverError, requireAuth } from '@/lib/api'
import { SendEmailRequestSchema } from '@/lib/schemas/email-job'
import { generateEmailContent } from '@/lib/email-generator'
import { encryptContent } from '@/lib/email-encryptor'
import { sendEmail } from '@/lib/email-sender'
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

    if (!isAdmin && proposal.matching.case.assignedUserId !== session.user.id) {
      return forbidden()
    }

    if (validation.data.sendType === 'SCHEDULED' && validation.data.scheduledAt) {
      const scheduledTime = new Date(validation.data.scheduledAt)
      if (scheduledTime <= new Date()) {
        return unprocessable([{ message: 'scheduled time must be in the future' }])
      }
    }

    const job = await prisma.emailJob.create({
      data: {
        proposalId: proposal.id,
        status: 'PENDING',
        sendType: validation.data.sendType,
        scheduledAt: validation.data.scheduledAt ? new Date(validation.data.scheduledAt) : null,
      },
    })

    processEmailJob(job.id, proposal, job.sendType).catch((err) => {
      console.error('Error processing email job:', err)
    })

    return ok({ jobId: job.id, status: job.status })
  } catch (error) {
    console.error('Error in send-email:', error)
    return serverError()
  }
}

async function processEmailJob(jobId: string, proposal: any, sendType: string): Promise<void> {
  try {
    await prisma.emailJob.update({ where: { id: jobId }, data: { status: 'GENERATING' } })

    // Extract CV text and attachment path from resume file
    const resumeKey = proposal.matching.talent.resumeKey
    let attachmentPath: string | null = null
    let cvText = ''
    if (resumeKey) {
      const localPath = getFileStorage().getLocalPath(resumeKey)
      if (localPath) {
        try {
          await access(localPath)
          attachmentPath = localPath
          const buffer = await readFile(localPath)
          const { value } = await mammoth.extractRawText({ buffer })
          cvText = value.trim()
        } catch {
          // file not found: proceed without attachment or cv text
        }
      }
    }

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
        cv: cvText,
      },
    })

    const encryptedContent = encryptContent(emailContent)

    if (sendType === 'NOW') {
      await prisma.emailJob.update({
        where: { id: jobId },
        data: { status: 'SENDING', generatedContent: encryptedContent, attachmentPath },
      })

      await sendEmail({
        to: proposal.to,
        subject: proposal.subject,
        body: emailContent,
        attachmentPath: attachmentPath || undefined,
      })

      await prisma.emailJob.update({
        where: { id: jobId },
        data: { status: 'SENT', sentAt: new Date() },
      })
    } else {
      await prisma.emailJob.update({
        where: { id: jobId },
        data: { status: 'SCHEDULED', generatedContent: encryptedContent, attachmentPath },
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
