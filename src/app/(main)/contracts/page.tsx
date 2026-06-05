'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Topbar } from '@/components/layout/Topbar'
import { Modal } from '@/components/ui/Modal'

type ContractStatus = 'ACTIVE' | 'ENDING_SOON' | 'ENDED' | 'RENEWAL_PENDING'

type ContractItem = {
  id: string
  startDate: string
  endDate: string | null
  unitPrice: number
  costPrice: number
  grossProfitRate: number
  status: ContractStatus
  case: { title: string; client: string }
  talent: { name: string }
}

type MonthlySummary = {
  month: string
  revenue: number
  cost: number
  grossProfit: number
}

type CaseOption = { id: string; title: string; client: string }
type TalentOption = { id: string; name: string }

const STATUS_CONFIG: Record<ContractStatus, { label: string; color: string; bg: string }> = {
  ACTIVE:          { label: '稼働中',     color: 'text-[#4ade80]', bg: 'bg-[#4ade80]/10' },
  ENDING_SOON:     { label: '終了間近',   color: 'text-[#f87171]', bg: 'bg-[#f87171]/10' },
  ENDED:           { label: '終了',       color: 'text-[#64748b]', bg: 'bg-[#64748b]/10' },
  RENEWAL_PENDING: { label: '更新検討中', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
}

function calcDaysLeft(endDate: string | null): number | null {
  if (!endDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((new Date(endDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function formatMonth(month: string): string {
  const [y, m] = month.split('-')
  return `${y}年${parseInt(m)}月`
}

function calcGrossRate(unitPrice: number, costPrice: number): number {
  if (unitPrice === 0) return 0
  return ((unitPrice - costPrice) / unitPrice) * 100
}

function KpiCard({ label, value, unit, color, sub }: {
  label: string; value: string | number; unit?: string; color: string; sub?: string
}) {
  return (
    <div className="bg-vatch-surface border border-vatch-border rounded-lg p-4">
      <div className={`text-xs font-medium mb-2 ${color}`}>{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-white">{value}</span>
        {unit && <span className="text-xs text-vatch-muted">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-vatch-muted mt-1">{sub}</div>}
    </div>
  )
}

export default function ContractsPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'

  const [contracts, setContracts] = useState<ContractItem[]>([])
  const [summary, setSummary] = useState<MonthlySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all')

  // 新規作成モーダル
  const [creating, setCreating] = useState(false)
  const [cases, setCases] = useState<CaseOption[]>([])
  const [talents, setTalents] = useState<TalentOption[]>([])
  const [createForm, setCreateForm] = useState({
    caseId: '', talentId: '', unitPrice: 80, costPrice: 65, startDate: '', endDate: '',
  })
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // 編集モーダル
  const [selectedContract, setSelectedContract] = useState<ContractItem | null>(null)
  const [editForm, setEditForm] = useState({
    unitPrice: 0, costPrice: 0, endDate: '', status: 'ACTIVE' as ContractStatus,
  })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // 削除確認
  const [rowDeleteId, setRowDeleteId] = useState<string | null>(null)

  const fetchContracts = useCallback(() => {
    setLoading(true)
    fetch('/api/contracts?limit=200')
      .then(r => r.json())
      .then(j => { if (j.success) setContracts(j.data) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchContracts()
    fetch('/api/contracts/summary')
      .then(r => r.json())
      .then(j => { if (j.success) setSummary(j.data) })
  }, [fetchContracts])

  useEffect(() => {
    if (!selectedContract) return
    setEditForm({
      unitPrice: selectedContract.unitPrice,
      costPrice: selectedContract.costPrice,
      endDate: selectedContract.endDate?.slice(0, 10) ?? '',
      status: selectedContract.status,
    })
    setEditError(null)
  }, [selectedContract])

  async function openCreate() {
    setCreating(true)
    setCreateError(null)
    setCreateForm({ caseId: '', talentId: '', unitPrice: 80, costPrice: 65, startDate: '', endDate: '' })
    const [casesRes, talentsRes] = await Promise.all([
      fetch('/api/cases?limit=100').then(r => r.json()),
      fetch('/api/talents?limit=100').then(r => r.json()),
    ])
    if (casesRes.success) setCases(casesRes.data)
    if (talentsRes.success) setTalents(talentsRes.data)
  }

  async function handleCreate() {
    if (!createForm.caseId || !createForm.talentId || !createForm.startDate) {
      setCreateError('案件・人材・開始日は必須です')
      return
    }
    setCreateSaving(true)
    setCreateError(null)
    try {
      const grossProfitRate = calcGrossRate(createForm.unitPrice, createForm.costPrice)
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: createForm.caseId,
          talentId: createForm.talentId,
          unitPrice: createForm.unitPrice,
          costPrice: createForm.costPrice,
          grossProfitRate,
          startDate: new Date(createForm.startDate).toISOString(),
          ...(createForm.endDate ? { endDate: new Date(createForm.endDate).toISOString() } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? '登録に失敗しました')
      setCreating(false)
      fetchContracts()
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : '登録に失敗しました')
    } finally {
      setCreateSaving(false)
    }
  }

  async function handleSave() {
    if (!selectedContract) return
    setEditSaving(true)
    setEditError(null)
    try {
      const grossProfitRate = calcGrossRate(editForm.unitPrice, editForm.costPrice)
      const res = await fetch(`/api/contracts/${selectedContract.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitPrice: editForm.unitPrice,
          costPrice: editForm.costPrice,
          grossProfitRate,
          status: editForm.status,
          ...(editForm.endDate ? { endDate: new Date(editForm.endDate).toISOString() } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? '保存に失敗しました')
      setContracts(prev => prev.map(c => c.id === selectedContract.id ? { ...c, ...json.data } : c))
      setSelectedContract(null)
    } catch (e) {
      setEditError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/contracts/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(json.error?.message ?? '削除に失敗しました')
      }
      setContracts(prev => prev.filter(c => c.id !== id))
      setRowDeleteId(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : '削除に失敗しました')
      setRowDeleteId(null)
    }
  }

  const filtered = useMemo(() =>
    contracts.filter(c => statusFilter === 'all' || c.status === statusFilter),
    [contracts, statusFilter]
  )

  const kpi = useMemo(() => {
    const active = contracts.filter(c => c.status === 'ACTIVE')
    const current = contracts.filter(c => c.status === 'ACTIVE' || c.status === 'ENDING_SOON')
    const revenue = current.reduce((s, c) => s + c.unitPrice, 0)
    const cost = current.reduce((s, c) => s + c.costPrice, 0)
    const avgRate = active.length > 0
      ? active.reduce((s, c) => s + c.grossProfitRate, 0) / active.length : 0
    return { activeCount: active.length, revenue, grossProfit: revenue - cost, avgRate }
  }, [contracts])

  return (
    <div className="flex flex-col h-full bg-vatch-bg">
      <Topbar title="契約・売上" />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">

          {/* 新規作成ボタン */}
          <div className="flex justify-end mb-6">
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-[#38bdf8] text-black text-xs font-bold rounded-lg hover:bg-[#38bdf8]/90 transition-colors"
            >
              ＋ 新規作成
            </button>
          </div>

          {/* KPI */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <KpiCard label="稼働中契約数" value={kpi.activeCount} unit="件" color="text-[#38bdf8]" sub="現在稼働中" />
            <KpiCard label="今月売上" value={kpi.revenue.toLocaleString()} unit="万円" color="text-[#4ade80]" sub="稼働中 + 終了間近" />
            <KpiCard
              label="今月粗利"
              value={kpi.grossProfit.toLocaleString()}
              unit="万円"
              color="text-[#4ade80]"
              sub={kpi.revenue > 0 ? `粗利率 ${((kpi.grossProfit / kpi.revenue) * 100).toFixed(1)}%` : '—'}
            />
            <KpiCard
              label="平均粗利率"
              value={kpi.avgRate.toFixed(1)}
              unit="%"
              color={kpi.avgRate >= 10 ? 'text-[#4ade80]' : 'text-[#f59e0b]'}
              sub="稼働中契約の平均"
            />
          </div>

          {/* 月別サマリー */}
          {summary.length > 0 && (
            <div className="bg-vatch-surface border border-vatch-border rounded-lg overflow-hidden mb-6">
              <div className="px-4 py-3 border-b border-vatch-border">
                <h2 className="text-sm font-semibold text-white">月別売上サマリー（直近6ヶ月）</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-vatch-border text-vatch-muted text-xs uppercase tracking-wide">
                      <th className="text-left px-4 py-3 font-medium">月</th>
                      <th className="text-right px-4 py-3 font-medium">売上（万円）</th>
                      <th className="text-right px-4 py-3 font-medium">原価（万円）</th>
                      <th className="text-right px-4 py-3 font-medium">粗利（万円）</th>
                      <th className="text-right px-4 py-3 font-medium">粗利率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((row, idx) => {
                      const rate = row.revenue > 0 ? (row.grossProfit / row.revenue) * 100 : 0
                      return (
                        <tr key={row.month} className={`border-b border-vatch-border/50 hover:bg-white/[0.02] ${idx === summary.length - 1 ? 'border-b-0' : ''}`}>
                          <td className="px-4 py-3 text-white font-medium">{formatMonth(row.month)}</td>
                          <td className="px-4 py-3 text-right text-white">{row.revenue.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-vatch-muted">{row.cost.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-[#4ade80] font-semibold">{row.grossProfit.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={rate >= 10 ? 'text-[#4ade80] font-semibold' : 'text-[#f59e0b] font-semibold'}>
                              {rate.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 契約一覧 */}
          <div className="bg-vatch-surface border border-vatch-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-vatch-border flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white shrink-0">契約一覧</h2>
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as ContractStatus | 'all')}
                  className="bg-vatch-bg border border-vatch-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#38bdf8] transition-colors cursor-pointer"
                >
                  <option value="all">全ステータス</option>
                  {(Object.keys(STATUS_CONFIG) as ContractStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
                <span className="text-xs text-vatch-muted">{filtered.length} 件</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-vatch-border text-vatch-muted text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">人材 / 案件</th>
                    <th className="text-left px-4 py-3 font-medium">クライアント</th>
                    <th className="text-left px-4 py-3 font-medium">期間</th>
                    <th className="text-right px-4 py-3 font-medium">売値</th>
                    <th className="text-right px-4 py-3 font-medium">仕入値</th>
                    <th className="text-right px-4 py-3 font-medium">粗利率</th>
                    <th className="text-left px-4 py-3 font-medium">ステータス</th>
                    <th className="text-right px-4 py-3 font-medium">残日数</th>
                    <th className="text-center px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="text-center py-12 text-vatch-muted">読み込み中...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-12 text-vatch-muted">契約がありません</td></tr>
                  ) : filtered.map((item, idx) => {
                    const sc = STATUS_CONFIG[item.status]
                    const daysLeft = item.status !== 'ENDED' ? calcDaysLeft(item.endDate) : null
                    const isLow = item.grossProfitRate < 10
                    const isConfirming = rowDeleteId === item.id
                    return (
                      <tr key={item.id} className={`border-b border-vatch-border/50 hover:bg-white/[0.02] transition-colors ${idx === filtered.length - 1 ? 'border-b-0' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{item.talent.name}</div>
                          <div className="text-xs text-vatch-muted mt-0.5">{item.case.title}</div>
                        </td>
                        <td className="px-4 py-3 text-vatch-muted whitespace-nowrap">{item.case.client}</td>
                        <td className="px-4 py-3 text-vatch-muted whitespace-nowrap text-xs">
                          <div>{item.startDate.slice(0, 10).replace(/-/g, '/')}</div>
                          <div className="mt-0.5">〜 {item.endDate ? item.endDate.slice(0, 10).replace(/-/g, '/') : '未定'}</div>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className="text-white font-semibold">{item.unitPrice}</span>
                          <span className="text-vatch-muted text-xs ml-1">万円</span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className="text-vatch-muted">{item.costPrice}</span>
                          <span className="text-vatch-muted text-xs ml-1">万円</span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={`font-semibold ${isLow ? 'text-[#f59e0b]' : 'text-[#4ade80]'}`}>
                            {item.grossProfitRate.toFixed(1)}%
                          </span>
                          {isLow && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-[#f59e0b] bg-[#f59e0b]/10">要確認</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sc.color} ${sc.bg}`}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {daysLeft === null ? (
                            <span className="text-vatch-muted text-xs">—</span>
                          ) : daysLeft <= 0 ? (
                            <span className="text-[#f87171] font-semibold text-xs">終了</span>
                          ) : (
                            <span className={`font-semibold text-xs ${daysLeft <= 30 ? 'text-[#f87171]' : 'text-vatch-muted'}`}>
                              {daysLeft}日
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => { setRowDeleteId(null); setSelectedContract(item) }}
                              className="px-3 py-1 text-xs border border-vatch-border rounded hover:border-[#38bdf8] hover:text-[#38bdf8] text-vatch-muted transition-colors"
                            >
                              編集
                            </button>
                            {isAdmin && (
                              isConfirming ? (
                                <>
                                  <button onClick={() => handleDelete(item.id)} className="px-3 py-1 text-xs bg-red-500/20 border border-red-500 text-red-400 rounded hover:bg-red-500/30 transition-colors">確認</button>
                                  <button onClick={() => setRowDeleteId(null)} className="px-3 py-1 text-xs border border-vatch-border text-vatch-muted rounded hover:text-white transition-colors">✕</button>
                                </>
                              ) : (
                                <button onClick={() => setRowDeleteId(item.id)} className="px-3 py-1 text-xs border border-vatch-border rounded hover:border-red-500 hover:text-red-400 text-vatch-muted transition-colors">削除</button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* 新規作成モーダル */}
      <Modal open={creating} onClose={() => setCreating(false)}>
        <div className="bg-vatch-surface border border-vatch-border rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-vatch-border">
            <h2 className="text-base font-bold text-white">新規契約登録</h2>
            <button onClick={() => setCreating(false)} className="text-vatch-muted hover:text-white transition-colors text-lg leading-none">✕</button>
          </div>
          <div className="px-5 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">案件（必須）</label>
                <select value={createForm.caseId} onChange={e => setCreateForm(f => ({ ...f, caseId: e.target.value }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors cursor-pointer">
                  <option value="">案件を選択...</option>
                  {cases.map(c => <option key={c.id} value={c.id}>{c.title}（{c.client}）</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">人材（必須）</label>
                <select value={createForm.talentId} onChange={e => setCreateForm(f => ({ ...f, talentId: e.target.value }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors cursor-pointer">
                  <option value="">人材を選択...</option>
                  {talents.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">売値（万円）</label>
                <input type="number" min={1} value={createForm.unitPrice} onChange={e => setCreateForm(f => ({ ...f, unitPrice: Number(e.target.value) }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">仕入値（万円）</label>
                <input type="number" min={1} value={createForm.costPrice} onChange={e => setCreateForm(f => ({ ...f, costPrice: Number(e.target.value) }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors" />
              </div>
              <div className="col-span-2">
                <p className="text-xs text-vatch-muted">
                  粗利率:{' '}
                  <span className={`font-semibold ${calcGrossRate(createForm.unitPrice, createForm.costPrice) >= 10 ? 'text-[#4ade80]' : 'text-[#f59e0b]'}`}>
                    {calcGrossRate(createForm.unitPrice, createForm.costPrice).toFixed(1)}%
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">開始日（必須）</label>
                <input type="date" value={createForm.startDate} onChange={e => setCreateForm(f => ({ ...f, startDate: e.target.value }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">終了日（任意）</label>
                <input type="date" value={createForm.endDate} onChange={e => setCreateForm(f => ({ ...f, endDate: e.target.value }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors" />
              </div>
              {createError && <p className="col-span-2 text-red-400 text-xs">{createError}</p>}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setCreating(false)} className="flex-1 py-2.5 border border-vatch-border text-vatch-muted text-sm rounded-lg hover:border-[#38bdf8] hover:text-[#38bdf8] transition-colors">キャンセル</button>
              <button onClick={handleCreate} disabled={createSaving} className="flex-1 py-2.5 bg-[#38bdf8] text-black text-sm font-bold rounded-lg disabled:opacity-50">{createSaving ? '登録中...' : '登録'}</button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 編集モーダル */}
      <Modal open={selectedContract !== null} onClose={() => setSelectedContract(null)}>
        <div className="bg-vatch-surface border border-vatch-border rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-vatch-border">
            <div>
              <h2 className="text-base font-bold text-white">{selectedContract?.talent.name}</h2>
              <p className="text-xs text-vatch-muted mt-0.5">{selectedContract?.case.title}</p>
            </div>
            <button onClick={() => setSelectedContract(null)} className="text-vatch-muted hover:text-white transition-colors text-lg leading-none">✕</button>
          </div>
          <div className="px-5 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">売値（万円）</label>
                <input type="number" min={1} value={editForm.unitPrice} onChange={e => setEditForm(f => ({ ...f, unitPrice: Number(e.target.value) }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">仕入値（万円）</label>
                <input type="number" min={1} value={editForm.costPrice} onChange={e => setEditForm(f => ({ ...f, costPrice: Number(e.target.value) }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors" />
              </div>
              <div className="col-span-2">
                <p className="text-xs text-vatch-muted">
                  粗利率:{' '}
                  <span className={`font-semibold ${calcGrossRate(editForm.unitPrice, editForm.costPrice) >= 10 ? 'text-[#4ade80]' : 'text-[#f59e0b]'}`}>
                    {calcGrossRate(editForm.unitPrice, editForm.costPrice).toFixed(1)}%
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">終了日</label>
                <input type="date" value={editForm.endDate} onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">ステータス</label>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as ContractStatus }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors cursor-pointer">
                  {(Object.keys(STATUS_CONFIG) as ContractStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
              </div>
              {editError && <p className="col-span-2 text-red-400 text-xs">{editError}</p>}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setSelectedContract(null)} className="flex-1 py-2.5 border border-vatch-border text-vatch-muted text-sm rounded-lg hover:border-[#38bdf8] hover:text-[#38bdf8] transition-colors">キャンセル</button>
              <button onClick={handleSave} disabled={editSaving} className="flex-1 py-2.5 bg-[#38bdf8] text-black text-sm font-bold rounded-lg disabled:opacity-50">{editSaving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
