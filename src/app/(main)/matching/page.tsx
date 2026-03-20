'use client'

import { useState, useEffect, useCallback } from 'react'
import { Topbar } from '@/components/layout/Topbar'

// ── 型定義 ──────────────────────────────────────────────────────────────────

type MatchingStatus = 'UNPROPOSED' | 'PENDING_AUTO' | 'SENT' | 'REPLIED' | 'INTERVIEWING' | 'CONTRACTED' | 'REJECTED'

type MatchingItem = {
  id: string
  score: number
  skillMatchRate: number
  unitPriceOk: boolean
  timingOk: boolean
  locationOk: boolean
  grossProfitOk: boolean
  reason: string | null
  isAutoSend: boolean
  status: MatchingStatus
  case: { id: string; title: string; client: string; unitPrice: number; workStyle: string; startDate: string }
  talent: { id: string; name: string; skills: string[]; desiredRate: number; agencyEmail: string | null }
}

type Tab = '全件' | '自動送信候補' | '高スコア' | '提案済み'
const TABS: Tab[] = ['全件', '自動送信候補', '高スコア', '提案済み']

// ── helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return '#4ade80'
  if (score >= 60) return '#38bdf8'
  return '#a78bfa'
}

function fitIcon(val: boolean): { icon: string; cls: string } {
  return val
    ? { icon: '✓', cls: 'text-vatch-green' }
    : { icon: '✗', cls: 'text-vatch-red' }
}

const STATUS_LABEL: Record<MatchingStatus, string> = {
  UNPROPOSED:  '未提案',
  PENDING_AUTO: '自動送信待ち',
  SENT:        '提案中',
  REPLIED:     '返答待ち',
  INTERVIEWING: '面談調整中',
  CONTRACTED:  '成約',
  REJECTED:    '不採用',
}

const STATUS_STYLE: Record<MatchingStatus, string> = {
  UNPROPOSED:   'bg-slate-700/60 text-slate-300 border border-slate-600',
  PENDING_AUTO: 'bg-green-900/60 text-green-300 border border-green-700 animate-pulse',
  SENT:         'bg-sky-900/60 text-sky-300 border border-sky-700',
  REPLIED:      'bg-amber-900/60 text-amber-300 border border-amber-700',
  INTERVIEWING: 'bg-purple-900/60 text-purple-300 border border-purple-700',
  CONTRACTED:   'bg-green-900/60 text-green-300 border border-green-700',
  REJECTED:     'bg-red-900/60 text-red-300 border border-red-700',
}

function filterItems(items: MatchingItem[], tab: Tab): MatchingItem[] {
  switch (tab) {
    case '自動送信候補': return items.filter((i) => i.isAutoSend)
    case '高スコア':     return items.filter((i) => i.score >= 80)
    case '提案済み':     return items.filter((i) => ['SENT','REPLIED','INTERVIEWING','CONTRACTED'].includes(i.status))
    default:             return items
  }
}

// ── ScoreBar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const color = scoreColor(score)
  return (
    <div className="flex flex-col gap-1 min-w-[64px]">
      <span className="text-sm font-bold tabular-nums" style={{ color }}>{score}%</span>
      <div className="h-1 w-full rounded-full bg-vatch-border overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

// ── FitCell ──────────────────────────────────────────────────────────────────

function FitCell({ val }: { val: boolean }) {
  const { icon, cls } = fitIcon(val)
  return <span className={`text-base font-bold ${cls}`}>{icon}</span>
}

// ── MatchingRow ───────────────────────────────────────────────────────────────

function MatchingRow({
  item,
  onPropose,
}: {
  item: MatchingItem
  onPropose: (item: MatchingItem) => void
}) {
  const canPropose = item.status === 'UNPROPOSED' || item.status === 'PENDING_AUTO'
  return (
    <tr className="border-b border-vatch-border hover:bg-[#0a1628] transition-colors group">
      <td className="px-3.5 py-3 align-top">
        <div className="text-[12px] font-semibold text-vatch-text-bright leading-snug">{item.case.title}</div>
        <div className="text-[10px] text-vatch-muted mt-0.5">{item.case.client}</div>
      </td>
      <td className="px-3.5 py-3 align-top">
        <div className="text-[12px] font-semibold text-vatch-text-bright">{item.talent.name}</div>
        <div className="text-[10px] text-vatch-muted mt-0.5">{item.talent.skills.slice(0, 2).join(', ')}</div>
      </td>
      <td className="px-3.5 py-3 align-middle"><ScoreBar score={item.score} /></td>
      <td className="px-3.5 py-3 align-middle">
        <span className="text-[12px] font-semibold tabular-nums text-vatch-text">{item.skillMatchRate}%</span>
      </td>
      <td className="px-3.5 py-3 align-middle text-center"><FitCell val={item.unitPriceOk} /></td>
      <td className="px-3.5 py-3 align-middle text-center"><FitCell val={item.timingOk} /></td>
      <td className="px-3.5 py-3 align-middle text-center"><FitCell val={item.locationOk} /></td>
      <td className="px-3.5 py-3 align-middle text-center">
        {item.grossProfitOk
          ? <span className="text-vatch-green font-bold text-sm">✓</span>
          : <span className="text-vatch-amber font-bold text-sm">!</span>
        }
      </td>
      <td className="px-3.5 py-3 align-top max-w-[200px]">
        <p className="text-[10px] text-vatch-text-dim leading-relaxed line-clamp-3">{item.reason ?? '—'}</p>
      </td>
      <td className="px-3.5 py-3 align-middle text-center">
        {item.isAutoSend && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-900/60 text-green-300 border border-green-700">
            ⚡ AUTO
          </span>
        )}
      </td>
      <td className="px-3.5 py-3 align-middle">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${STATUS_STYLE[item.status]}`}>
          {STATUS_LABEL[item.status]}
        </span>
      </td>
      <td className="px-3.5 py-3 align-middle">
        {canPropose && (
          <button
            onClick={() => onPropose(item)}
            className="text-[10px] font-bold px-2.5 py-1 rounded border border-vatch-cyan text-vatch-cyan hover:bg-vatch-cyan/10 transition-colors whitespace-nowrap"
          >
            提案する
          </button>
        )}
      </td>
    </tr>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MatchingPage() {
  const [matchings, setMatchings] = useState<MatchingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('全件')

  // 提案モーダル
  const [proposalTarget, setProposalTarget] = useState<MatchingItem | null>(null)
  const [proposalTo, setProposalTo] = useState('')
  const [proposalSubject, setProposalSubject] = useState('')
  const [proposalBody, setProposalBody] = useState('')
  const [proposalSending, setProposalSending] = useState(false)

  // 一括送信モーダル
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkSending, setBulkSending] = useState(false)

  async function loadMatchings() {
    try {
      const res = await fetch('/api/matchings?limit=500')
      const json = await res.json()
      if (json.success) setMatchings(json.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMatchings() }, [])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/matchings/generate', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        alert(`${json.data.generated}件のマッチングを生成しました（${json.data.skipped}件スキップ）`)
        await loadMatchings()
      } else {
        alert('マッチング生成に失敗しました')
      }
    } catch {
      alert('マッチング生成中にエラーが発生しました')
    } finally {
      setGenerating(false)
    }
  }

  function openProposalModal(item: MatchingItem) {
    setProposalTarget(item)
    setProposalTo(item.talent.agencyEmail ?? '')
    setProposalSubject(`【ご提案】${item.case.title} × ${item.talent.name}`)
    setProposalBody(
      `いつもお世話になっております。\n\n以下の案件についてご提案させていただきます。\n\n【案件概要】\n案件名: ${item.case.title}\n単価: ${item.case.unitPrice}万円\n\n【人材概要】\n氏名: ${item.talent.name}\nスキル: ${item.talent.skills.join(', ')}\n\n${item.reason ?? ''}\n\nご検討のほどよろしくお願いいたします。`
    )
  }

  const closeProposalModal = useCallback(() => setProposalTarget(null), [])

  async function handleProposalSend() {
    if (!proposalTarget) return
    setProposalSending(true)
    try {
      await navigator.clipboard.writeText(
        `宛先: ${proposalTo}\n件名: ${proposalSubject}\n\n${proposalBody}`
      )
      await fetch(`/api/matchings/${proposalTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SENT' }),
      })
      closeProposalModal()
      await loadMatchings()
    } catch (err) {
      alert(`エラーが発生しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      setProposalSending(false)
    }
  }

  const autoSendCandidates = matchings.filter((m) => m.isAutoSend)

  function openBulkModal() {
    setBulkSelected(new Set(autoSendCandidates.map((m) => m.id)))
    setBulkModalOpen(true)
  }

  const closeBulkModal = useCallback(() => setBulkModalOpen(false), [])

  async function handleBulkSend() {
    setBulkSending(true)
    try {
      const targets = autoSendCandidates.filter((m) => bulkSelected.has(m.id))
      const text = targets.map((m) =>
        `【${m.case.title} × ${m.talent.name}】\n${m.reason ?? ''}`
      ).join('\n\n---\n\n')
      await navigator.clipboard.writeText(text)
      await Promise.all(
        targets.map((m) =>
          fetch(`/api/matchings/${m.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'SENT' }),
          })
        )
      )
      closeBulkModal()
      await loadMatchings()
    } catch (err) {
      alert(`エラーが発生しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      setBulkSending(false)
    }
  }

  const displayed = filterItems(matchings, activeTab)
  const tabCount: Record<Tab, number> = {
    '全件':       matchings.length,
    '自動送信候補': matchings.filter((m) => m.isAutoSend).length,
    '高スコア':   matchings.filter((m) => m.score >= 80).length,
    '提案済み':   matchings.filter((m) => ['SENT','REPLIED','INTERVIEWING','CONTRACTED'].includes(m.status)).length,
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="マッチング一覧" subtitle="AIマッチング候補 — 案件 × 人材" />

      <main className="flex-1 overflow-y-auto">
        <div className="p-5 flex flex-col gap-4">

        {/* ── Summary KPIs ───────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2.5">
          {([
            { label: '総マッチング数',   value: matchings.length,                                          color: '#38bdf8' },
            { label: '自動送信候補',     value: matchings.filter((m) => m.isAutoSend).length,              color: '#4ade80' },
            { label: '高スコア (80%+)', value: matchings.filter((m) => m.score >= 80).length,             color: '#4ade80' },
            { label: '提案済み',         value: matchings.filter((m) => ['SENT','REPLIED','INTERVIEWING','CONTRACTED'].includes(m.status)).length, color: '#a78bfa' },
          ] as const).map(({ label, value, color }) => (
            <div key={label} className="bg-vatch-surface border border-vatch-border rounded-lg px-4 py-3 flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-vatch-muted uppercase tracking-widest">{label}</span>
              <span className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</span>
            </div>
          ))}
        </div>

        {/* ── Main Panel ─────────────────────────────────────────── */}
        <div className="bg-vatch-surface border border-vatch-border rounded-lg overflow-hidden">

          {/* Panel Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-vatch-border bg-[#090f1f]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-vatch-cyan" />
              <span className="text-[11px] font-bold text-vatch-text-dim uppercase tracking-widest">AI MATCHING LIST</span>
              <span className="ml-1 text-[10px] text-vatch-muted">{displayed.length} 件表示</span>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="text-[10px] font-bold px-3 py-1 rounded bg-vatch-cyan/10 border border-vatch-cyan text-vatch-cyan hover:bg-vatch-cyan/20 transition-colors disabled:opacity-50"
            >
              {generating ? '生成中...' : '⚡ AIマッチング生成'}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0 border-b border-vatch-border px-3.5 bg-[#090f1f]">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={[
                  'relative px-3.5 py-2 text-[11px] font-semibold transition-colors whitespace-nowrap',
                  activeTab === tab ? 'text-vatch-cyan' : 'text-vatch-muted hover:text-vatch-text-dim',
                ].join(' ')}
              >
                {tab}
                <span className="ml-1 text-[9px] opacity-70">({tabCount[tab]})</span>
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-vatch-cyan rounded-t" />
                )}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-vatch-border bg-[#060c1c]">
                  {[
                    { label: '案件名',       width: 'w-[180px]', center: false },
                    { label: '人材名',       width: 'w-[130px]', center: false },
                    { label: 'AIスコア',     width: 'w-[90px]',  center: false },
                    { label: 'スキル一致率', width: 'w-[80px]',  center: false },
                    { label: '単価',         width: 'w-[48px]',  center: true  },
                    { label: '時期',         width: 'w-[48px]',  center: true  },
                    { label: '勤務',         width: 'w-[48px]',  center: true  },
                    { label: '粗利',         width: 'w-[40px]',  center: true  },
                    { label: '推薦理由',     width: 'w-[200px]', center: false },
                    { label: '自動送信',     width: 'w-[72px]',  center: true  },
                    { label: 'ステータス',   width: 'w-[100px]', center: false },
                    { label: 'アクション',   width: 'w-[72px]',  center: false },
                  ].map(({ label, width, center }) => (
                    <th key={label} className={`${width} px-3.5 py-2 text-[10px] font-bold text-vatch-muted uppercase tracking-widest ${center ? 'text-center' : ''}`}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="px-3.5 py-8 text-center text-vatch-muted text-sm">読み込み中...</td>
                  </tr>
                ) : displayed.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-3.5 py-8 text-center text-vatch-muted text-sm">該当するマッチング候補がありません</td>
                  </tr>
                ) : (
                  displayed.map((item) => (
                    <MatchingRow key={item.id} item={item} onPropose={openProposalModal} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-3.5 py-2 border-t border-vatch-border bg-[#090f1f] flex items-center justify-between">
            <span className="text-[10px] text-vatch-muted">{matchings.length} 件</span>
            {autoSendCandidates.length > 0 && (
              <button
                onClick={openBulkModal}
                className="text-[10px] font-bold px-3 py-1 rounded bg-vatch-green/10 border border-vatch-green text-vatch-green hover:bg-vatch-green/20 transition-colors"
              >
                ⚡ 自動送信候補を一括送信 ({autoSendCandidates.length}件)
              </button>
            )}
          </div>
        </div>

        {/* ── 提案モーダル ────────────────────────────────────────── */}
        {proposalTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={closeProposalModal}>
            <div className="absolute inset-0 bg-black/60" />
            <div
              className="relative z-10 w-full max-w-2xl mx-4 bg-vatch-surface border border-vatch-border rounded-xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-vatch-border">
                <h2 className="text-base font-bold text-white">提案メール作成</h2>
                <button onClick={closeProposalModal} className="text-vatch-muted hover:text-white transition-colors text-lg leading-none" aria-label="閉じる">✕</button>
              </div>
              <div className="px-5 py-4 space-y-3 max-h-[80vh] overflow-y-auto">
                <div>
                  <label className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1 block">宛先</label>
                  <input
                    type="text"
                    value={proposalTo}
                    onChange={(e) => setProposalTo(e.target.value)}
                    className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-vatch-cyan"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1 block">件名</label>
                  <input
                    type="text"
                    value={proposalSubject}
                    onChange={(e) => setProposalSubject(e.target.value)}
                    className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-vatch-cyan"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1 block">本文</label>
                  <textarea
                    value={proposalBody}
                    onChange={(e) => setProposalBody(e.target.value)}
                    rows={10}
                    className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-vatch-cyan resize-none font-mono"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={closeProposalModal} className="px-4 py-2 text-sm text-vatch-muted hover:text-white transition-colors">キャンセル</button>
                  <button
                    onClick={handleProposalSend}
                    disabled={proposalSending}
                    className="px-4 py-2 text-sm font-bold rounded-lg bg-vatch-cyan text-vatch-bg hover:bg-vatch-cyan/90 transition-colors disabled:opacity-50"
                  >
                    {proposalSending ? '処理中...' : 'コピーして送信済みにする'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 一括送信モーダル ─────────────────────────────────────── */}
        {bulkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={closeBulkModal}>
            <div className="absolute inset-0 bg-black/60" />
            <div
              className="relative z-10 w-full max-w-2xl mx-4 bg-vatch-surface border border-vatch-border rounded-xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-vatch-border">
                <h2 className="text-base font-bold text-white">⚡ 自動送信候補 一括送信</h2>
                <button onClick={closeBulkModal} className="text-vatch-muted hover:text-white transition-colors text-lg leading-none" aria-label="閉じる">✕</button>
              </div>
              <div className="px-5 py-4 space-y-2 max-h-[60vh] overflow-y-auto">
                {autoSendCandidates.map((m) => (
                  <label key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-vatch-border hover:bg-vatch-bg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkSelected.has(m.id)}
                      onChange={(e) => {
                        const next = new Set(bulkSelected)
                        if (e.target.checked) next.add(m.id)
                        else next.delete(m.id)
                        setBulkSelected(next)
                      }}
                      className="accent-vatch-cyan"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{m.case.title} × {m.talent.name}</div>
                      <div className="text-[10px] text-vatch-muted mt-0.5">スコア {m.score}% · {m.case.client}</div>
                    </div>
                    <span className="text-[10px] text-vatch-green font-bold">{m.score}%</span>
                  </label>
                ))}
              </div>
              <div className="px-5 py-4 border-t border-vatch-border flex items-center justify-between">
                <span className="text-[11px] text-vatch-muted">{bulkSelected.size}件を選択中</span>
                <div className="flex gap-2">
                  <button onClick={closeBulkModal} className="px-4 py-2 text-sm text-vatch-muted hover:text-white transition-colors">キャンセル</button>
                  <button
                    onClick={handleBulkSend}
                    disabled={bulkSending || bulkSelected.size === 0}
                    className="px-4 py-2 text-sm font-bold rounded-lg bg-vatch-green text-vatch-bg hover:bg-vatch-green/90 transition-colors disabled:opacity-50"
                  >
                    {bulkSending ? '処理中...' : 'コピーして一括送信済みにする'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        </div>
      </main>
    </div>
  )
}
