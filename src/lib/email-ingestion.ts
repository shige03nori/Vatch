// src/lib/email-ingestion.ts
import * as path from 'path'
import { prisma } from '@/lib/prisma'
import { fetchUnreadEmails } from './email-fetcher'
import { parseEmailBody } from './email-parser'
import { decrypt } from './crypto'
import { getFileStorage } from './file-storage'
import type { FetchedEmail } from './email-fetcher'

const ENCRYPTION_KEY = process.env.EMAIL_SOURCE_ENCRYPTION_KEY ?? ''
const MAX_RESUME_SIZE = 10 * 1024 * 1024 // 10MB

export type IngestionResult = {
  fetched: number
  parsed: number
  errors: number
  unknown: number
}

async function saveResume(
  talentId: string,
  attachment: FetchedEmail['attachments'][number],
): Promise<{ key: string; filename: string } | null> {
  if (attachment.content.length > MAX_RESUME_SIZE) {
    console.warn(`[ingestion] Attachment too large (${attachment.content.length} bytes), skipping: ${attachment.filename}`)
    return null
  }

  const extFromName = path.extname(attachment.filename).toLowerCase()
  const extFromType = (attachment.contentType.includes('wordprocessingml') || attachment.filename.toLowerCase().endsWith('.docx')) ? '.docx' : '.pdf'
  const validExts = new Set(['.pdf', '.docx'])
  const ext = (extFromName && validExts.has(extFromName)) ? extFromName : extFromType
  const key = `resumes/${talentId}-${Date.now()}${ext}`

  const storage = getFileStorage()
  await storage.save(key, attachment.content)
  return { key, filename: attachment.filename }
}

function findFirstResume(attachments: FetchedEmail['attachments']): FetchedEmail['attachments'][number] | null {
  // email-fetcher 側でフィルタ済みだが、防御的に PDF/DOCX のみ採用する
  return attachments.find((att) => {
    const ct = att.contentType
    const fn = att.filename.toLowerCase()
    if (ct === 'application/pdf') return true
    if (ct === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return true
    if ((ct === 'application/octet-stream' || ct === 'application/zip') && fn.endsWith('.docx')) return true
    return false
  }) ?? null
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
      } else {
        const dayStart = new Date(fetched.receivedAt)
        dayStart.setUTCHours(0, 0, 0, 0)
        const dayEnd = new Date(dayStart)
        dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

        const existing = await prisma.email.findFirst({
          where: {
            fromEmail: fetched.fromEmail,
            subject:   fetched.subject,
            receivedAt: { gte: dayStart, lt: dayEnd },
          },
        })
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

          // 添付ファイル（経歴書）の保存
          const resumeAttachment = findFirstResume(fetched.attachments)
          if (resumeAttachment) {
            try {
              const saved = await saveResume(createdTalent.id, resumeAttachment)
              if (saved) {
                try {
                  await prisma.talent.update({
                    where: { id: createdTalent.id },
                    data: { resumeKey: saved.key, resumeFilename: saved.filename },
                  })
                } catch (updateErr) {
                  console.error(`[ingestion] Failed to update Talent resumeKey, cleaning up file:`, updateErr)
                  const storage = getFileStorage()
                  storage.delete(saved.key).catch((e) =>
                    console.error(`[ingestion] Failed to delete orphan file ${saved.key}:`, e)
                  )
                }
              }
            } catch (saveErr) {
              console.error(`[ingestion] Failed to save resume for talent ${createdTalent.id}:`, saveErr)
            }
          }

          await prisma.activityLog.create({
            data: { type: 'TALENT_CREATED', description: `人材登録: ${parsed.talent.name}`, emailId: emailRecord.id, talentId: createdTalent.id },
          })
          result.parsed++

        } else {
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
