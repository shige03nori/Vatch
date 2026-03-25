// src/app/api/matchings/generate/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, serverError, requireAuth } from '@/lib/api'
import { evaluateMatching } from '@/lib/matching-generator'

export async function POST(_request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  try {
    // OPEN案件 と AVAILABLE人材 を全件取得
    const [cases, talents, existingMatchings] = await Promise.all([
      prisma.case.findMany({ where: { status: 'OPEN' } }),
      prisma.talent.findMany({ where: { status: 'AVAILABLE' } }),
      prisma.matching.findMany({ select: { caseId: true, talentId: true } }),
    ])

    // 既存マッチングのキーセット
    const existingKeys = new Set(existingMatchings.map((m) => `${m.caseId}:${m.talentId}`))

    let generated = 0
    let skipped = 0

    for (const caseRecord of cases) {
      for (const talent of talents) {
        const key = `${caseRecord.id}:${talent.id}`
        if (existingKeys.has(key)) {
          skipped++
          continue
        }

        const evaluation = await evaluateMatching(caseRecord, talent)
        await prisma.matching.create({
          data: {
            caseId:          caseRecord.id,
            talentId:        talent.id,
            score:           evaluation.score,
            skillMatchRate:  evaluation.skillMatchRate,
            unitPriceOk:     evaluation.unitPriceOk,
            timingOk:        evaluation.timingOk,
            locationOk:      evaluation.locationOk,
            costPrice:       evaluation.costPrice,
            sellPrice:       evaluation.sellPrice,
            grossProfitRate: evaluation.grossProfitRate,
            grossProfitOk:   evaluation.grossProfitOk,
            reason:          evaluation.reason,
            isAutoSend:      evaluation.isAutoSend,
            status:          evaluation.isAutoSend ? 'PENDING_AUTO' : 'UNPROPOSED',
          },
        })
        generated++
      }
    }

    return ok({ generated, skipped })
  } catch {
    return serverError()
  }
}
