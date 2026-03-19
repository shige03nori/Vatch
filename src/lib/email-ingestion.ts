// src/lib/email-ingestion.ts
import { prisma } from '@/lib/prisma'
import { fetchUnreadEmails } from './email-fetcher'
import { parseEmailBody } from './email-parser'
import { decrypt } from './crypto'

const ENCRYPTION_KEY = process.env.EMAIL_SOURCE_ENCRYPTION_KEY ?? ''

export type IngestionResult = {
  fetched: number
  parsed: number
  errors: number
  unknown: number
}

export async function runIngestion(): Promise<IngestionResult> {
  const result: IngestionResult = { fetched: 0, parsed: 0, errors: 0, unknown: 0 }

  const sources = await prisma.emailSource.findMany({ where: { isActive: true } })

  for (const source of sources) {
    let emails: Awaited<ReturnType<typeof fetchUnreadEmails>> = []

    try {
      emails = await fetchUnreadEmails({
        imapHost: source.imapHost,
        imapPort: source.imapPort,
        imapUser: source.imapUser,
        imapPass: decrypt(source.imapPass, ENCRYPTION_KEY),
      })
    } catch (err) {
      console.error(`[ingestion] IMAP fetch failed for ${source.imapUser}:`, err)
      continue
    }

    for (const fetched of emails) {
      // 重複チェック（Message-ID）
      if (fetched.messageId) {
        const existing = await prisma.email.findUnique({ where: { messageId: fetched.messageId } })
        if (existing) continue
      }

      // Email を PENDING/UNKNOWN で保存
      const emailRecord = await prisma.email.create({
        data: {
          receivedAt:   fetched.receivedAt,
          from:         fetched.from,
          fromEmail:    fetched.fromEmail,
          subject:      fetched.subject,
          bodyText:     fetched.bodyText,
          type:         'UNKNOWN',
          status:       'PENDING',
          skills:       [],
          messageId:    fetched.messageId,
        },
      })
      result.fetched++

      await prisma.activityLog.create({
        data: { type: 'EMAIL_RECEIVED', description: `メール取込: ${fetched.subject}`, emailId: emailRecord.id },
      })

      // AI解析
      await prisma.email.update({ where: { id: emailRecord.id }, data: { status: 'PARSING' } })

      try {
        const parsed = await parseEmailBody(fetched.bodyText)

        await prisma.email.update({
          where: { id: emailRecord.id },
          data: {
            type:          parsed.type,
            status:        'PARSED',
            skills:        parsed.skills,
            extractedName: parsed.extractedName,
            confidence:    parsed.confidence,
          },
        })

        // 解析完了ログ（種別問わず常に記録）
        await prisma.activityLog.create({
          data: { type: 'EMAIL_PARSED', description: `AI解析完了: ${parsed.type} (信頼度${parsed.confidence}%)`, emailId: emailRecord.id },
        })

        if (parsed.type === 'CASE' && parsed.case) {
          const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } })
          if (!adminUser) throw new Error('No ADMIN user found')

          const createdCase = await prisma.case.create({
            data: {
              title:          parsed.case.title,
              client:         parsed.case.client,
              clientEmail:    parsed.case.clientEmail,
              skills:         parsed.skills,
              unitPrice:      parsed.case.unitPrice,
              startDate:      new Date(parsed.case.startDate),
              workStyle:      parsed.case.workStyle,
              status:         'OPEN',
              assignedUserId: adminUser.id,
              sourceEmailId:  emailRecord.id,
            },
          })
          await prisma.activityLog.create({
            data: { type: 'CASE_CREATED', description: `案件登録: ${parsed.case.title}`, emailId: emailRecord.id, caseId: createdCase.id },
          })
          result.parsed++
        } else if (parsed.type === 'TALENT' && parsed.talent) {
          const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } })
          if (!adminUser) throw new Error('No ADMIN user found')

          const createdTalent = await prisma.talent.create({
            data: {
              name:           parsed.talent.name,
              skills:         parsed.skills,
              experience:     parsed.talent.experience,
              desiredRate:    parsed.talent.desiredRate,
              location:       parsed.talent.location,
              workStyle:      parsed.talent.workStyle,
              status:         'AVAILABLE',
              assignedUserId: adminUser.id,
              sourceEmailId:  emailRecord.id,
              agencyEmail:    fetched.fromEmail,
            },
          })
          await prisma.activityLog.create({
            data: { type: 'TALENT_CREATED', description: `人材登録: ${parsed.talent.name}`, emailId: emailRecord.id, talentId: createdTalent.id },
          })
          result.parsed++
        } else {
          // UNKNOWN は EMAIL_PARSED のみ記録済み（CASE/TALENT作成なし）
          result.unknown++
        }
      } catch (err) {
        console.error(`[ingestion] Parse/create failed for email ${emailRecord.id}:`, err)
        await prisma.email.update({ where: { id: emailRecord.id }, data: { status: 'ERROR' } })
        await prisma.activityLog.create({
          data: { type: 'EMAIL_PARSED', description: `解析エラー: ${fetched.subject}`, emailId: emailRecord.id },
        })
        result.errors++
      }
    }
  }

  return result
}
