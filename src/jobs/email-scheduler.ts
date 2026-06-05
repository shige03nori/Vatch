import cron from 'node-cron'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-sender'
import { decryptContent } from '@/lib/email-encryptor'

export function initEmailScheduler(): void {
  // 毎分実行
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date()
      const jobs = await prisma.emailJob.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { lte: now }
        },
        include: {
          proposal: {
            include: {
              matching: {
                include: {
                  case: true,
                  talent: true
                }
              }
            }
          }
        }
      })

      for (const job of jobs) {
        await executeEmailJob(job)
      }
    } catch (error) {
      console.error('Error in email scheduler:', error)
    }
  })

  console.log('Email scheduler initialized')
}

async function executeEmailJob(job: any): Promise<void> {
  let retryCount = 0
  const maxRetries = 3

  while (retryCount < maxRetries) {
    try {
      // Status 更新: SENDING
      await prisma.emailJob.update({
        where: { id: job.id },
        data: { status: 'SENDING' }
      })

      // メール内容を復号化
      const emailContent = job.generatedContent ? decryptContent(job.generatedContent) : ''

      // メール送信
      await sendEmail({
        to: job.proposal.matching.case.clientEmail,
        subject: `【提案】${job.proposal.matching.case.title}`,
        body: emailContent,
        attachmentPath: job.attachmentPath || undefined
      })

      // Status 更新: SENT
      await prisma.emailJob.update({
        where: { id: job.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          errorMessage: null
        }
      })

      return
    } catch (error) {
      retryCount++
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      if (retryCount >= maxRetries) {
        // 最大リトライ回数に達した
        await prisma.emailJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            errorMessage: `Max retries reached: ${errorMessage}`
          }
        })
        console.error(`Email job ${job.id} failed after ${maxRetries} retries:`, errorMessage)
        return
      }

      // リトライ前に待機（指数バックオフ）
      const waitTime = (1 << (retryCount - 1)) * 60 * 1000 // 1min, 2min, 4min
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }
}
