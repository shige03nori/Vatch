import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, serverError, requireAuth } from '@/lib/api'

export async function GET(): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  try {
    const today = new Date()
    const months: { label: string; start: Date; end: Date }[] = []

    for (let i = 5; i >= 0; i--) {
      const year = today.getFullYear()
      const month = today.getMonth() - i
      const start = new Date(year, month, 1)
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999)
      const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
      months.push({ label, start, end })
    }

    const baseWhere = isAdmin ? {} : { assignedUserId: session.user.id }

    const result = await Promise.all(
      months.map(async ({ label, start, end }) => {
        const contracts = await prisma.contract.findMany({
          where: {
            ...baseWhere,
            startDate: { lte: end },
            OR: [
              { endDate: null },
              { endDate: { gte: start } },
            ],
          },
          select: { unitPrice: true, costPrice: true },
        })
        const revenue = contracts.reduce((s, c) => s + c.unitPrice, 0)
        const cost = contracts.reduce((s, c) => s + c.costPrice, 0)
        return { month: label, revenue, cost, grossProfit: revenue - cost }
      })
    )

    return ok(result)
  } catch {
    return serverError()
  }
}
