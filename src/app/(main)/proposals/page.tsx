'use client'

import { useState, useEffect } from 'react'
import { Topbar } from '@/components/layout/Topbar'

// ── 型定義 ──────────────────────────────────────────────────────────────────

type ProposalStatus = 'DRAFT' | 'PENDING_AUTO' | 'SENT' | 'REPLIED' | 'REJECTED'

type ProposalItem = {
  id: string
  to: string
  cc: string | null
  subject: string
  bodyText: string
  status: ProposalStatus
  isAutoSend: boolean
  costPrice: number       // 万円整数
  sellPrice: number       // 万円整数
  grossProfitRate: number // パーセンテージ値（例: 17.6）
  sentAt: string | null
  createdAt: string
  matching: {
    id: string
    score: number
    reason: string | null
    case: { id: string; title: string; client: string; unitPrice: number }
    talent: { id: string; name: string; skills: string[]; desiredRate: number }
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ProposalStatus, string> = {
  DRAFT:        '下書き',
  PENDING_AUTO: '自動送信待ち',
  SENT:         '提案中',
  REPLIED:      '返答あり',
  REJECTED:     '不採用',
}

const STATUS_STYLES: Record<ProposalStatus, string> = {
  DRAFT:        'bg-slate-700/60 text-slate-300',
  PENDING_AUTO: 'bg-cyan-900/60 text-cyan-300',
  SENT:         'bg-blue-900/60 text-blue-300',
  REPLIED:      'bg-amber-900/60 text-amber-300',
  REJECTED:     'bg-red-900/60 text-red-300',
}

// ── GrossProfitBar ────────────────────────────────────────────────────────────

function GrossProfitBar({ rate }: { rate: number }) {
  // rate はパーセンテージ値（例: 17.6）
  const isOk = rate >= 10
  const capped = Math.min(rate, 30)
  const barWidth = `${(capped / 30) * 100}%`
  return (
    <div className="w-full h-2 rounded-full bg-vatch-border mt-1.5">
      <div
        className={`h-2 rounded-full transition-all ${isOk ? 'bg-vatch-green' : 'bg-vatch-red'}`}
        style={{ width: barWidth }}
      />
    </div>
  )
}

// ── QueueItem ─────────────────────────────────────────────────────────────────

function QueueItem({
  item,
  isActive,
  onClick,
}: {
  item: ProposalItem
  isActive: boolean
  onClick: () => void
}) {
  const pct = Math.round(item.grossProfitRate)
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
        isActive
          ? 'border-vatch-cyan bg-cyan-950/40'
          : 'border-vatch-border hover:border-vatch-border-light hover:bg-vatch-border/30'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-vatch-text-bright truncate">
            {item.matching.case.title}
          </p>
          <p className="text-[10px] text-vatch-muted mt-0.5">
            {item.matching.case.client} / {item.matching.talent.name}
          </p>
        </div>
        <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_STYLES[item.status]}`}>
          {STATUS_LABEL[item.status]}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[10px] text-vatch-cyan font-bold">AI {item.matching.score}%</span>
        <span className={`text-[10px] font-semibold ${item.grossProfitRate >= 10 ? 'text-vatch-green' : 'text-vatch-red'}`}>
          粗利 {pct}%
        </span>
      </div>
    </button>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<ProposalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ProposalItem | null>(null)
  const [toValue, setToValue] = useState('')
  const [ccValue, setCcValue] = useState('')
  const [subjectValue, setSubjectValue] = useState('')
  const [bodyValue, setBodyValue] = useState('')
  const [saving, setSaving] = useState(false)

  function handleSelect(item: ProposalItem) {
    setSelected(item)
    setToValue(item.to)
    setCcValue(item.cc ?? '')
    setSubjectValue(item.subject)
    setBodyValue(item.bodyText)
  }

  async function loadProposals(currentSelectedId?: string) {
    try {
      const res = await fetch('/api/proposals?limit=100')
      const json = await res.json()
      const data: ProposalItem[] = json.data ?? []
      setProposals(data)
      if (currentSelectedId) {
        const refreshed = data.find((p) => p.id === currentSelectedId)
        if (refreshed) handleSelect(refreshed)
      } else if (data.length > 0) {
        handleSelect(data[0])
      }
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadProposals() }, [])

  async function handleSave() {
    if (!selected || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/proposals/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subjectValue, bodyText: bodyValue }),
      })
      if (!res.ok) throw new Error()
      await loadProposals(selected.id)
    } catch {
      alert('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusUpdate(status: 'REPLIED' | 'REJECTED') {
    if (!selected || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/proposals/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      await loadProposals(selected.id)
    } catch {
      alert('ステータスの更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(bodyValue)
    } catch {
      alert('クリップボードへのコピーに失敗しました')
    }
  }

  if (loading) {
    return (
      <>
        <Topbar title="提案メール確認" subtitle="AI生成メール / 粗利チェック / 自動送信" />
        <main className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
          <span className="text-vatch-muted text-sm">読み込み中...</span>
        </main>
      </>
    )
  }

  if (proposals.length === 0 || !selected) {
    return (
      <>
        <Topbar title="提案メール確認" subtitle="AI生成メール / 粗利チェック / 自動送信" />
        <main className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
          <div className="text-center">
            <p className="text-vatch-muted text-sm">提案データがありません</p>
            <p className="text-vatch-muted-dark text-[11px] mt-1">マッチング画面から「提案する」を実行してください</p>
          </div>
        </main>
      </>
    )
  }

  const grossProfitPct = selected.grossProfitRate.toFixed(1)
  const isMarginOk = selected.grossProfitRate >= 10
  const grossProfitAmt = selected.sellPrice - selected.costPrice

  return (
    <>
      <Topbar title="提案メール確認" subtitle="AI生成メール / 粗利チェック / 自動送信" />
      <main className="flex-1 overflow-y-auto p-4">
        <div className="flex gap-3 h-full min-h-0">

          {/* ── Queue sidebar ───────────────────────────────────── */}
          <aside className="w-[200px] flex-shrink-0 flex flex-col gap-2">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] font-bold text-vatch-text-dim uppercase tracking-wider">送信キュー</span>
              <span className="text-[10px] text-vatch-cyan font-semibold">{proposals.length}件</span>
            </div>
            <div className="flex flex-col gap-1.5 overflow-y-auto">
              {proposals.map((item) => (
                <QueueItem
                  key={item.id}
                  item={item}
                  isActive={item.id === selected.id}
                  onClick={() => handleSelect(item)}
                />
              ))}
            </div>
          </aside>

          {/* ── Left: Email composition ─────────────────────────── */}
          <section className="flex-1 min-w-0 flex flex-col gap-3">
            <div className="flex-1 flex flex-col bg-vatch-surface border border-vatch-border rounded-xl overflow-hidden">

              {/* Card header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-vatch-border bg-vatch-bg/60">
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800/60 text-[10px] font-bold text-vatch-cyan">
                    ⚡ AI Generated
                  </span>
                  <span className="text-[10px] text-vatch-muted">
                    作成日: {new Date(selected.createdAt).toLocaleDateString('ja-JP')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-vatch-muted-dark">AIスコア</span>
                  <span className="text-sm font-bold text-vatch-cyan">{selected.matching.score}%</span>
                </div>
              </div>

              {/* Fields */}
              <div className="flex flex-col divide-y divide-vatch-border">
                {/* To */}
                <div className="flex items-center gap-3 px-4 py-2">
                  <span className="text-[11px] font-semibold text-vatch-muted w-12 flex-shrink-0">宛先</span>
                  <input
                    type="text"
                    value={toValue}
                    onChange={(e) => setToValue(e.target.value)}
                    className="flex-1 bg-transparent text-[12px] text-vatch-text outline-none placeholder:text-vatch-muted-dark"
                  />
                  <span className="text-[10px] text-vatch-muted-dark px-2 py-0.5 rounded bg-vatch-border/60">
                    {selected.matching.case.client}
                  </span>
                </div>
                {/* CC */}
                <div className="flex items-center gap-3 px-4 py-2">
                  <span className="text-[11px] font-semibold text-vatch-muted w-12 flex-shrink-0">CC</span>
                  <input
                    type="text"
                    value={ccValue}
                    onChange={(e) => setCcValue(e.target.value)}
                    className="flex-1 bg-transparent text-[12px] text-vatch-text outline-none placeholder:text-vatch-muted-dark"
                  />
                </div>
                {/* Subject */}
                <div className="flex items-center gap-3 px-4 py-2">
                  <span className="text-[11px] font-semibold text-vatch-muted w-12 flex-shrink-0">件名</span>
                  <input
                    type="text"
                    value={subjectValue}
                    onChange={(e) => setSubjectValue(e.target.value)}
                    className="flex-1 bg-transparent text-[12px] text-vatch-text-bright font-medium outline-none"
                  />
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 flex flex-col px-4 py-3 gap-2 min-h-0">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-vatch-muted">本文</span>
                  <span className="flex items-center gap-1 text-[10px] text-vatch-cyan">
                    ⚡ <span>AI生成テキスト</span>
                  </span>
                </div>
                <textarea
                  value={bodyValue}
                  onChange={(e) => setBodyValue(e.target.value)}
                  className="flex-1 w-full bg-vatch-bg/50 border border-vatch-border rounded-lg p-3 text-[12px] text-vatch-text leading-relaxed outline-none resize-none focus:border-vatch-border-light font-mono"
                  style={{ minHeight: '260px' }}
                />
              </div>

              {/* Save footer */}
              <div className="flex items-center justify-end px-4 py-2.5 border-t border-vatch-border bg-vatch-bg/40">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 text-[12px] font-semibold rounded-lg border border-vatch-border-light text-vatch-text-dim hover:text-vatch-text hover:border-vatch-muted transition-colors disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </section>

          {/* ── Right: Gross profit + Controls ──────────────────── */}
          <aside className="w-[260px] flex-shrink-0 flex flex-col gap-3">

            {/* Gross profit panel */}
            <div className="bg-vatch-surface border border-vatch-border rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-vatch-text-dim uppercase tracking-wider">粗利チェック</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isMarginOk ? 'bg-green-900/60 text-vatch-green' : 'bg-red-900/60 text-vatch-red'}`}>
                  {isMarginOk ? '✓ 基準適合' : '✗ 要確認'}
                </span>
              </div>
              {!isMarginOk && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/60 border border-red-800/50">
                  <span className="text-sm">⚠️</span>
                  <span className="text-[11px] font-bold text-vatch-red leading-tight">
                    粗利10%未満 — 要確認
                  </span>
                </div>
              )}
              <div className="flex flex-col items-center py-2">
                <span className="text-[11px] text-vatch-muted mb-1">粗利率</span>
                <span className={`text-4xl font-black tabular-nums ${isMarginOk ? 'text-vatch-green' : 'text-vatch-red'}`}>
                  {grossProfitPct}%
                </span>
                <GrossProfitBar rate={selected.grossProfitRate} />
                <div className="flex justify-between w-full mt-1">
                  <span className="text-[9px] text-vatch-muted-dark">0%</span>
                  <span className="text-[9px] text-vatch-amber">10%</span>
                  <span className="text-[9px] text-vatch-muted-dark">30%</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 bg-vatch-bg/60 rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-vatch-muted">仕入値</span>
                  <span className="text-[12px] text-vatch-text font-mono">{selected.costPrice}万円</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-vatch-muted">売値</span>
                  <span className="text-[12px] text-vatch-text font-mono">{selected.sellPrice}万円</span>
                </div>
                <div className="border-t border-vatch-border pt-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-vatch-text-dim">粗利額</span>
                  <span className={`text-[13px] font-bold font-mono ${isMarginOk ? 'text-vatch-green' : 'text-vatch-red'}`}>
                    {grossProfitAmt}万円
                  </span>
                </div>
              </div>
            </div>

            {/* Match info panel */}
            <div className="bg-vatch-surface border border-vatch-border rounded-xl p-4 flex flex-col gap-2.5">
              <span className="text-[11px] font-bold text-vatch-text-dim uppercase tracking-wider">マッチング情報</span>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] text-vatch-muted flex-shrink-0">案件</span>
                  <span className="text-[11px] text-vatch-text text-right leading-snug">
                    {selected.matching.case.title} / {selected.matching.case.client}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-vatch-muted">人材</span>
                  <span className="text-[11px] text-vatch-text">
                    {selected.matching.talent.name}
                    {selected.matching.talent.skills.length > 0 && (
                      <span className="text-vatch-muted"> ({selected.matching.talent.skills.slice(0, 2).join(', ')})</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-vatch-muted">AIスコア</span>
                  <span className="text-[12px] font-bold text-vatch-cyan">{selected.matching.score}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-vatch-muted">ステータス</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[selected.status]}`}>
                    {STATUS_LABEL[selected.status]}
                  </span>
                </div>
              </div>
            </div>

            {/* Action panel */}
            <div className="bg-vatch-surface border border-vatch-border rounded-xl p-4 flex flex-col gap-3">
              <span className="text-[11px] font-bold text-vatch-text-dim uppercase tracking-wider">アクション</span>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleCopy}
                  className="w-full py-2 rounded-lg border border-vatch-border-light text-[12px] font-semibold text-vatch-text-dim hover:text-vatch-text hover:border-vatch-muted transition-colors"
                >
                  📋 本文コピー
                </button>
                <button
                  onClick={() => handleStatusUpdate('REPLIED')}
                  disabled={saving || selected.status !== 'SENT'}
                  className="w-full py-2 rounded-lg bg-amber-900/40 border border-amber-700/60 text-[12px] font-semibold text-amber-300 hover:bg-amber-900/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ↩ 返答あり
                </button>
                <button
                  onClick={() => handleStatusUpdate('REJECTED')}
                  disabled={saving || !['SENT', 'REPLIED'].includes(selected.status)}
                  className="w-full py-2 rounded-lg bg-red-900/40 border border-red-700/60 text-[12px] font-semibold text-red-300 hover:bg-red-900/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ✗ 不採用
                </button>
              </div>
            </div>

          </aside>
        </div>
      </main>
    </>
  )
}
