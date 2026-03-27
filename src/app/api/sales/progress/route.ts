// src/app/api/sales/progress/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, serverError, requireAuth } from '@/lib/api'

const STAGE_CONFIG = [
  { status: 'INTERVIEWING', label: '面談調整中', color: '#a78bfa' },
  { status: 'SENT',         label: '提案中',     color: '#38bdf8' },
  { status: 'REPLIED',      label: '返答待ち',   color: '#f59e0b' },
  { status: 'CONTRACTED',   label: '稼働中',     color: '#4ade80' },
] as const

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export async function GET(): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const caseWhere = isAdmin ? {} : { case: { assignedUserId: session.user.id } }
  const userWhere = isAdmin ? {} : { assignedUserId: session.user.id }

  try {
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const [pipelineMatchings, proposals, contracts, proposalsByUser] = await Promise.all([
      // 1. Pipeline: current active matchings
      prisma.matching.findMany({
        where: {
          ...caseWhere,
          status: { in: ['INTERVIEWING', 'SENT', 'REPLIED', 'CONTRACTED'] },
        },
        select: { status: true, sellPrice: true },
      }),
      // 2. Monthly proposals (sent in last 6 months)
      prisma.proposal.findMany({
        where: {
          sentAt: { gte: sixMonthsAgo },
          status: { not: 'DRAFT' },
          matching: caseWhere,
        },
        select: { sentAt: true },
      }),
      // 3. Monthly contracts (created in last 6 months)
      prisma.contract.findMany({
        where: {
          createdAt: { gte: sixMonthsAgo },
          ...userWhere,
        },
        select: {
          createdAt: true,
          unitPrice: true,
          costPrice: true,
          assignedUserId: true,
          assignedUser: { select: { id: true, name: true } },
        },
      }),
      // 4. Proposals grouped by assigned user (for sales reps table)
      prisma.proposal.findMany({
        where: {
          sentAt: { gte: sixMonthsAgo },
          status: { not: 'DRAFT' },
          matching: caseWhere,
        },
        select: {
          matching: {
            select: {
              case: {
                select: {
                  assignedUserId: true,
                  assignedUser: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
    ])

    // ─── Pipeline stages ───────────────────────────────────────────
    const pipelineStages = STAGE_CONFIG.map(({ status, label, color }) => {
      const items = pipelineMatchings.filter((m) => m.status === status)
      return {
        label,
        color,
        count: items.length,
        amount: items.reduce((s, m) => s + m.sellPrice, 0),
      }
    })

    // ─── Monthly data (last 6 months) ─────────────────────────────
    const monthlyData = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      const key = monthKey(d)
      const mp = proposals.filter((p) => p.sentAt && monthKey(new Date(p.sentAt)) === key)
      const mc = contracts.filter((c) => monthKey(new Date(c.createdAt)) === key)
      return {
        month: `${d.getMonth() + 1}月`,
        proposals: mp.length,
        contracts: mc.length,
        grossProfit: mc.reduce((s, c) => s + (c.unitPrice - c.costPrice), 0),
      }
    })

    // ─── Sales reps performance ────────────────────────────────────
    const repMap = new Map<
      string,
      { name: string; proposals: number; contracts: number; grossProfit: number }
    >()

    for (const p of proposalsByUser) {
      const userId = p.matching.case.assignedUserId
      const name = p.matching.case.assignedUser.name ?? userId
      const rep = repMap.get(userId) ?? { name, proposals: 0, contracts: 0, grossProfit: 0 }
      rep.proposals += 1
      repMap.set(userId, rep)
    }

    for (const c of contracts) {
      const userId = c.assignedUserId
      const name = c.assignedUser.name ?? userId
      const rep = repMap.get(userId) ?? { name, proposals: 0, contracts: 0, grossProfit: 0 }
      rep.contracts += 1
      rep.grossProfit += c.unitPrice - c.costPrice
      repMap.set(userId, rep)
    }

    const salesReps = Array.from(repMap.values())
      .map((rep) => ({
        ...rep,
        winRate: rep.proposals > 0 ? (rep.contracts / rep.proposals) * 100 : 0,
      }))
      .sort((a, b) => b.grossProfit - a.grossProfit)

    return ok({ pipelineStages, monthlyData, salesReps })
  } catch {
    return serverError()
  }
}
