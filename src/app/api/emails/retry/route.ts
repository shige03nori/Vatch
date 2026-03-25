// src/app/api/emails/retry/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseEmailBody } from '@/lib/email-parser'
import { ok, forbidden, serverError, requireAuth } from '@/lib/api'
import type { Email } from '@prisma/client'

export type RetryResult = {
  retried: number
  parsed: number
  errors: number
}

const CONCURRENCY = 5

async function processOne(email: Email, result: RetryResult): Promise<void> {
  await prisma.email.update({ where: { id: email.id }, data: { status: 'PARSING' } })

  try {
    const parsed = await parseEmailBody(email.bodyText)

    await prisma.email.update({
      where: { id: email.id },
      data: {
        type:          parsed.type,
        status:        'PARSED',
        skills:        parsed.skills,
        extractedName: parsed.extractedName,
        confidence:    parsed.confidence,
      },
    })

    await prisma.activityLog.create({
      data: { type: 'EMAIL_PARSED', description: `再解析完了: ${parsed.type} (信頼度${parsed.confidence}%)`, emailId: email.id },
    })

    if (parsed.type === 'CASE' && parsed.case) {
      const existing = await prisma.case.findFirst({ where: { sourceEmailId: email.id } })
      if (!existing) {
        const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } })
        if (adminUser) {
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
              sourceEmailId:  email.id,
            },
          })
          await prisma.activityLog.create({
            data: { type: 'CASE_CREATED', description: `案件登録(再解析): ${parsed.case.title}`, emailId: email.id, caseId: createdCase.id },
          })
        }
      }
    } else if (parsed.type === 'TALENT' && parsed.talent) {
      const existing = await prisma.talent.findFirst({ where: { sourceEmailId: email.id } })
      if (!existing) {
        const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } })
        if (adminUser) {
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
              sourceEmailId:  email.id,
              agencyEmail:    email.fromEmail,
            },
          })
          await prisma.activityLog.create({
            data: { type: 'TALENT_CREATED', description: `人材登録(再解析): ${parsed.talent.name}`, emailId: email.id, talentId: createdTalent.id },
          })
        }
      }
    }

    result.parsed++
  } catch (err) {
    console.error(`[retry] Parse failed for email ${email.id}:`, err)
    await prisma.email.update({ where: { id: email.id }, data: { status: 'ERROR' } })
    result.errors++
  }
}

export async function POST(): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { isAdmin } = authResult

  if (!isAdmin) return forbidden()

  let errorEmails: Email[]
  try {
    errorEmails = await prisma.email.findMany({
      where: { status: 'ERROR' },
      orderBy: { receivedAt: 'desc' },
    })
  } catch {
    return serverError()
  }

  const result: RetryResult = { retried: errorEmails.length, parsed: 0, errors: 0 }

  // CONCURRENCY件ずつ並列処理
  for (let i = 0; i < errorEmails.length; i += CONCURRENCY) {
    const batch = errorEmails.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map((email) => processOne(email, result)))
  }

  return ok(result)
}
