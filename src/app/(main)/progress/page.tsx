import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Topbar } from '@/components/layout/Topbar'

// ─── Stage config ─────────────────────────────────────────────────────────────
const STAGE_CONFIG = [
  { status: 'INTERVIEWING', label: '面談調整中', color: '#a78bfa' },
  { status: 'SENT',         label: '提案中',     color: '#38bdf8' },
  { status: 'REPLIED',      label: '返答待ち',   color: '#f59e0b' },
  { status: 'CONTRACTED',   label: '稼働中',     color: '#4ade80' },
] as const

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function fmtDiff(val: number, unit: string): string {
  return `前月比 ${val >= 0 ? '+' : ''}${val.toLocaleString()}${unit}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function ProgressPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const isAdmin = session.user.role === 'ADMIN'
  const caseWhere = isAdmin ? {} : { case: { assignedUserId: session.user.id } }
  const userWhere = isAdmin ? {} : { assignedUserId: session.user.id }

  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  // ─── Fetch data ─────────────────────────────────────────────────────────────
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

  // ─── Pipeline stages ─────────────────────────────────────────────────────────
  const pipelineStages = STAGE_CONFIG.map(({ status, label, color }) => {
    const items = pipelineMatchings.filter((m) => m.status === status)
    return {
      label,
      color,
      count: items.length,
      amount: items.reduce((s, m) => s + m.sellPrice, 0),
    }
  })
  const maxAmount = Math.max(...pipelineStages.map((s) => s.amount), 1)

  // ─── Monthly data (last 6 months) ───────────────────────────────────────────
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

  // ─── KPI (current month vs previous month) ───────────────────────────────────
  const latest = monthlyData[5]
  const prev   = monthlyData[4]
  const latestWinRate = latest.proposals > 0 ? (latest.contracts / latest.proposals) * 100 : 0
  const prevWinRate   = prev.proposals   > 0 ? (prev.contracts   / prev.proposals)   * 100 : 0

  const kpis = [
    {
      label: '今月提案数',
      value: `${latest.proposals}件`,
      sub: fmtDiff(latest.proposals - prev.proposals, '件'),
      color: '#38bdf8',
    },
    {
      label: '今月成約数',
      value: `${latest.contracts}件`,
      sub: fmtDiff(latest.contracts - prev.contracts, '件'),
      color: '#4ade80',
    },
    {
      label: '成約率',
      value: `${latestWinRate.toFixed(1)}%`,
      sub: `前月比 ${(latestWinRate - prevWinRate) >= 0 ? '+' : ''}${(latestWinRate - prevWinRate).toFixed(1)}pt`,
      color: '#a78bfa',
    },
    {
      label: '今月粗利',
      value: `¥${latest.grossProfit.toLocaleString()}万`,
      sub: fmtDiff(latest.grossProfit - prev.grossProfit, '万'),
      color: '#f59e0b',
    },
  ]

  // ─── Sales reps ──────────────────────────────────────────────────────────────
  const repMap = new Map<
    string,
    { name: string; proposals: number; contracts: number; grossProfit: number }
  >()

  for (const p of proposalsByUser) {
    const userId = p.matching.case.assignedUserId
    const name   = p.matching.case.assignedUser.name ?? userId
    const rep    = repMap.get(userId) ?? { name, proposals: 0, contracts: 0, grossProfit: 0 }
    rep.proposals += 1
    repMap.set(userId, rep)
  }

  for (const c of contracts) {
    const userId = c.assignedUserId
    const name   = c.assignedUser.name ?? userId
    const rep    = repMap.get(userId) ?? { name, proposals: 0, contracts: 0, grossProfit: 0 }
    rep.contracts    += 1
    rep.grossProfit  += c.unitPrice - c.costPrice
    repMap.set(userId, rep)
  }

  const salesReps = Array.from(repMap.values())
    .map((rep) => ({
      ...rep,
      winRate: rep.proposals > 0 ? (rep.contracts / rep.proposals) * 100 : 0,
    }))
    .sort((a, b) => b.grossProfit - a.grossProfit)

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <Topbar title="営業進捗" />

      <main className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">

        {/* KPI サマリー */}
        <div className="grid grid-cols-4 gap-3">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="bg-vatch-surface border border-vatch-border rounded-lg p-4 flex flex-col gap-1"
            >
              <span className="text-[11px] text-vatch-muted uppercase tracking-wider">
                {kpi.label}
              </span>
              <span className="text-2xl font-bold" style={{ color: kpi.color }}>
                {kpi.value}
              </span>
              <span className="text-[11px] text-vatch-text-dim">{kpi.sub}</span>
            </div>
          ))}
        </div>

        {/* 営業パイプライン */}
        <section className="bg-vatch-surface border border-vatch-border rounded-lg p-5 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-vatch-text-bright">営業パイプライン</h2>
          <div className="flex flex-col gap-3">
            {pipelineStages.map((stage) => {
              const barPct = Math.round((stage.amount / maxAmount) * 100)
              return (
                <div key={stage.label} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: stage.color }}
                      />
                      <span className="text-vatch-text font-medium w-24">{stage.label}</span>
                      <span className="font-semibold tabular-nums" style={{ color: stage.color }}>
                        {stage.count}件
                      </span>
                    </div>
                    <span className="text-vatch-text-dim tabular-nums">
                      ¥{stage.amount.toLocaleString()}万
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-vatch-border overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${barPct}%`, background: stage.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex justify-end pt-1 border-t border-vatch-border text-[12px] text-vatch-muted gap-4">
            <span>
              合計:{' '}
              <span className="text-vatch-text font-semibold">
                {pipelineStages.reduce((s, d) => s + d.count, 0)}件
              </span>
            </span>
            <span>
              見込み:{' '}
              <span className="text-vatch-cyan font-semibold">
                ¥{pipelineStages.reduce((s, d) => s + d.amount, 0).toLocaleString()}万
              </span>
            </span>
          </div>
        </section>

        {/* 月別推移テーブル + 担当者別実績テーブル */}
        <div className="grid grid-cols-[1fr_1fr] gap-4">

          {/* 月別推移 */}
          <section className="bg-vatch-surface border border-vatch-border rounded-lg p-5 flex flex-col gap-3">
            <h2 className="text-sm font-bold text-vatch-text-bright">月別推移（直近6ヶ月）</h2>
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="border-b border-vatch-border">
                  <th className="text-left py-2 text-vatch-muted font-medium">月</th>
                  <th className="text-right py-2 text-vatch-muted font-medium">提案数</th>
                  <th className="text-right py-2 text-vatch-muted font-medium">成約数</th>
                  <th className="text-right py-2 text-vatch-muted font-medium">粗利 (万)</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((row, i) => {
                  const isLatest = i === monthlyData.length - 1
                  return (
                    <tr
                      key={row.month}
                      className={`border-b border-vatch-border/50 ${isLatest ? 'bg-vatch-border/20' : ''}`}
                    >
                      <td className="py-2 text-vatch-text font-medium">
                        {row.month}
                        {isLatest && (
                          <span className="ml-1.5 text-[10px] text-vatch-cyan font-semibold">
                            今月
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right text-vatch-cyan tabular-nums">
                        {row.proposals}
                      </td>
                      <td className="py-2 text-right text-vatch-green tabular-nums">
                        {row.contracts}
                      </td>
                      <td className="py-2 text-right text-vatch-amber tabular-nums">
                        {row.grossProfit.toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          {/* 担当者別実績 */}
          <section className="bg-vatch-surface border border-vatch-border rounded-lg p-5 flex flex-col gap-3">
            <h2 className="text-sm font-bold text-vatch-text-bright">担当者別実績</h2>
            {salesReps.length === 0 ? (
              <p className="text-[12px] text-vatch-muted py-4 text-center">
                直近6ヶ月のデータがありません
              </p>
            ) : (
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="border-b border-vatch-border">
                    <th className="text-left py-2 text-vatch-muted font-medium">担当者</th>
                    <th className="text-right py-2 text-vatch-muted font-medium">提案</th>
                    <th className="text-right py-2 text-vatch-muted font-medium">成約</th>
                    <th className="text-right py-2 text-vatch-muted font-medium">粗利 (万)</th>
                    <th className="text-right py-2 text-vatch-muted font-medium">成約率</th>
                  </tr>
                </thead>
                <tbody>
                  {salesReps.map((rep) => (
                    <tr key={rep.name} className="border-b border-vatch-border/50">
                      <td className="py-2 text-vatch-text font-medium">{rep.name}</td>
                      <td className="py-2 text-right text-vatch-cyan tabular-nums">
                        {rep.proposals}
                      </td>
                      <td className="py-2 text-right text-vatch-green tabular-nums">
                        {rep.contracts}
                      </td>
                      <td className="py-2 text-right text-vatch-amber tabular-nums">
                        {rep.grossProfit.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        <span
                          className={`font-semibold ${
                            rep.winRate >= 50
                              ? 'text-vatch-green'
                              : rep.winRate >= 40
                              ? 'text-vatch-amber'
                              : 'text-vatch-red'
                          }`}
                        >
                          {rep.winRate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-vatch-border">
                    <td className="py-2 text-vatch-muted font-semibold">合計</td>
                    <td className="py-2 text-right text-vatch-cyan font-semibold tabular-nums">
                      {salesReps.reduce((s, r) => s + r.proposals, 0)}
                    </td>
                    <td className="py-2 text-right text-vatch-green font-semibold tabular-nums">
                      {salesReps.reduce((s, r) => s + r.contracts, 0)}
                    </td>
                    <td className="py-2 text-right text-vatch-amber font-semibold tabular-nums">
                      {salesReps.reduce((s, r) => s + r.grossProfit, 0).toLocaleString()}
                    </td>
                    <td className="py-2 text-right text-vatch-text-dim font-semibold tabular-nums">
                      {(() => {
                        const totalP = salesReps.reduce((s, r) => s + r.proposals, 0)
                        const totalC = salesReps.reduce((s, r) => s + r.contracts, 0)
                        return totalP > 0 ? `${((totalC / totalP) * 100).toFixed(1)}%` : '—'
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </section>

        </div>
      </main>
    </>
  )
}
