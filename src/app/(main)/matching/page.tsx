'use client'

import { useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { matchingEntries, type MatchingEntry } from '@/data/matching'

// ── helpers ──────────────────────────────────────────────────────────────────

type Tab = '全件' | '自動送信候補' | '高スコア' | '提案済み'
const TABS: Tab[] = ['全件', '自動送信候補', '高スコア', '提案済み']

function scoreColor(score: number): string {
  if (score >= 80) return '#4ade80'
  if (score >= 60) return '#38bdf8'
  return '#a78bfa'
}

function fitIcon(val: 'ok' | 'warn' | 'ng'): { icon: string; cls: string } {
  if (val === 'ok')   return { icon: '✓', cls: 'text-vatch-green' }
  if (val === 'warn') return { icon: '△', cls: 'text-vatch-amber' }
  return { icon: '✗', cls: 'text-vatch-red' }
}

const STATUS_STYLE: Record<MatchingEntry['status'], string> = {
  '未提案':     'bg-slate-700/60 text-slate-300 border border-slate-600',
  '提案中':     'bg-sky-900/60 text-sky-300 border border-sky-700',
  '返答待ち':   'bg-amber-900/60 text-amber-300 border border-amber-700',
  '面談調整中': 'bg-purple-900/60 text-purple-300 border border-purple-700',
  '成約':       'bg-green-900/60 text-green-300 border border-green-700',
}

const SKILL_COLOR: Record<string, string> = {
  Java:     'bg-blue-900/60 text-blue-300 border border-blue-700',
  React:    'bg-cyan-900/60 text-cyan-300 border border-cyan-700',
  PM:       'bg-purple-900/60 text-purple-300 border border-purple-700',
  AWS:      'bg-orange-900/60 text-orange-300 border border-orange-700',
  Flutter:  'bg-sky-900/60 text-sky-300 border border-sky-700',
  Python:   'bg-yellow-900/60 text-yellow-300 border border-yellow-700',
  SAP:      'bg-rose-900/60 text-rose-300 border border-rose-700',
  Security: 'bg-red-900/60 text-red-300 border border-red-700',
  'Vue.js': 'bg-emerald-900/60 text-emerald-300 border border-emerald-700',
  Go:       'bg-teal-900/60 text-teal-300 border border-teal-700',
}

function filterEntries(entries: MatchingEntry[], tab: Tab): MatchingEntry[] {
  switch (tab) {
    case '自動送信候補': return entries.filter((e) => e.isAutoSendCandidate)
    case '高スコア':     return entries.filter((e) => e.score >= 80)
    case '提案済み':     return entries.filter((e) => ['提案中', '返答待ち', '面談調整中', '成約'].includes(e.status))
    default:             return entries
  }
}

// ── ScoreBar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const color = scoreColor(score)
  return (
    <div className="flex flex-col gap-1 min-w-[64px]">
      <span className="text-sm font-bold tabular-nums" style={{ color }}>
        {score}%
      </span>
      <div className="h-1 w-full rounded-full bg-vatch-border overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

// ── FitCell ──────────────────────────────────────────────────────────────────

function FitCell({ val }: { val: 'ok' | 'warn' | 'ng' }) {
  const { icon, cls } = fitIcon(val)
  return <span className={`text-base font-bold ${cls}`}>{icon}</span>
}

// ── MatchingRow ───────────────────────────────────────────────────────────────

function MatchingRow({ entry }: { entry: MatchingEntry }) {
  const skillCls = SKILL_COLOR[entry.talentSkill] ?? 'bg-slate-700/60 text-slate-300 border border-slate-600'

  return (
    <tr className="border-b border-vatch-border hover:bg-[#0a1628] transition-colors group">
      {/* 案件名 */}
      <td className="px-3.5 py-3 align-top">
        <div className="text-[12px] font-semibold text-vatch-text-bright leading-snug">
          {entry.caseName}
        </div>
        <div className="text-[10px] text-vatch-muted mt-0.5">{entry.caseCompany}</div>
      </td>

      {/* 人材名 */}
      <td className="px-3.5 py-3 align-top">
        <div className="text-[12px] font-semibold text-vatch-text-bright">{entry.talentName}</div>
        <span className={`mt-1 inline-block text-[9px] font-bold px-1.5 py-0.5 rounded ${skillCls}`}>
          {entry.talentSkill}
        </span>
      </td>

      {/* AIスコア */}
      <td className="px-3.5 py-3 align-middle">
        <ScoreBar score={entry.score} />
      </td>

      {/* 必須スキル一致率 */}
      <td className="px-3.5 py-3 align-middle">
        <span className="text-[12px] font-semibold tabular-nums text-vatch-text">
          {entry.requiredSkillMatch}%
        </span>
      </td>

      {/* 単価適合 */}
      <td className="px-3.5 py-3 align-middle text-center">
        <FitCell val={entry.unitPriceOk} />
      </td>

      {/* 開始時期適合 */}
      <td className="px-3.5 py-3 align-middle text-center">
        <FitCell val={entry.startTimingOk} />
      </td>

      {/* 勤務形態適合 */}
      <td className="px-3.5 py-3 align-middle text-center">
        <FitCell val={entry.workStyleOk} />
      </td>

      {/* 粗利 */}
      <td className="px-3.5 py-3 align-middle text-center">
        {entry.grossProfitOk ? (
          <span className="text-vatch-green font-bold text-sm">✓</span>
        ) : (
          <span className="text-vatch-amber font-bold text-sm">!</span>
        )}
      </td>

      {/* 推薦理由 */}
      <td className="px-3.5 py-3 align-top max-w-[200px]">
        <p className="text-[10px] text-vatch-text-dim leading-relaxed line-clamp-3">
          {entry.recommendation}
        </p>
      </td>

      {/* 自動送信候補 */}
      <td className="px-3.5 py-3 align-middle text-center">
        {entry.isAutoSendCandidate && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-900/60 text-green-300 border border-green-700">
            ⚡ AUTO
          </span>
        )}
      </td>

      {/* ステータス */}
      <td className="px-3.5 py-3 align-middle">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${STATUS_STYLE[entry.status]}`}>
          {entry.status}
        </span>
      </td>

      {/* 提案ボタン */}
      <td className="px-3.5 py-3 align-middle">
        <button
          className="text-[10px] font-bold px-2.5 py-1 rounded border border-vatch-cyan text-vatch-cyan
                     hover:bg-vatch-cyan/10 transition-colors whitespace-nowrap"
        >
          提案する
        </button>
      </td>
    </tr>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MatchingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('全件')

  const displayed = filterEntries(matchingEntries, activeTab)
  const autoCount = matchingEntries.filter((e) => e.isAutoSendCandidate).length
  const highCount  = matchingEntries.filter((e) => e.score >= 80).length
  const doneCount  = matchingEntries.filter((e) =>
    ['提案中', '返答待ち', '面談調整中', '成約'].includes(e.status),
  ).length

  const tabCount: Record<Tab, number> = {
    '全件':       matchingEntries.length,
    '自動送信候補': autoCount,
    '高スコア':   highCount,
    '提案済み':   doneCount,
  }

  return (
    <>
      <Topbar title="マッチング一覧" subtitle="AIマッチング候補 — 案件 × 人材" />

      <main className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

        {/* ── Summary KPIs ─────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2.5">
          {(
            [
              { label: '総マッチング数',   value: matchingEntries.length, color: '#38bdf8' },
              { label: '自動送信候補',     value: autoCount,               color: '#4ade80' },
              { label: '高スコア (80%+)', value: highCount,               color: '#4ade80' },
              { label: '提案済み',         value: doneCount,               color: '#a78bfa' },
            ] as const
          ).map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-vatch-surface border border-vatch-border rounded-lg px-4 py-3 flex flex-col gap-0.5"
            >
              <span className="text-[10px] font-semibold text-vatch-muted uppercase tracking-widest">
                {label}
              </span>
              <span className="text-2xl font-bold tabular-nums" style={{ color }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* ── Main Panel ───────────────────────────────────────────── */}
        <div className="bg-vatch-surface border border-vatch-border rounded-lg overflow-hidden">

          {/* Panel Header */}
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-vatch-border bg-[#090f1f]">
            <span className="w-1.5 h-1.5 rounded-full bg-vatch-cyan" />
            <span className="text-[11px] font-bold text-vatch-text-dim uppercase tracking-widest">
              AI MATCHING LIST
            </span>
            <span className="ml-1 text-[10px] text-vatch-muted">
              {displayed.length} 件表示
            </span>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0 border-b border-vatch-border px-3.5 bg-[#090f1f]">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={[
                  'relative px-3.5 py-2 text-[11px] font-semibold transition-colors whitespace-nowrap',
                  activeTab === tab
                    ? 'text-vatch-cyan'
                    : 'text-vatch-muted hover:text-vatch-text-dim',
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
                    { label: 'ステータス',   width: 'w-[88px]',  center: false },
                    { label: 'アクション',   width: 'w-[72px]',  center: false },
                  ].map(({ label, width, center }) => (
                    <th
                      key={label}
                      className={`${width} px-3.5 py-2 text-[10px] font-bold text-vatch-muted uppercase tracking-widest ${center ? 'text-center' : ''}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-3.5 py-8 text-center text-vatch-muted text-sm">
                      該当するマッチング候補がありません
                    </td>
                  </tr>
                ) : (
                  displayed.map((entry) => <MatchingRow key={entry.id} entry={entry} />)
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-3.5 py-2 border-t border-vatch-border bg-[#090f1f] flex items-center justify-between">
            <span className="text-[10px] text-vatch-muted">
              最終更新: 2026-03-18 09:42
            </span>
            <button className="text-[10px] font-bold px-3 py-1 rounded bg-vatch-green/10 border border-vatch-green text-vatch-green hover:bg-vatch-green/20 transition-colors">
              ⚡ 自動送信候補を一括送信
            </button>
          </div>
        </div>

      </main>
    </>
  )
}
