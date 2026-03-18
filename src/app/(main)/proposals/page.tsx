'use client'

import { useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { proposalQueue, currentProposal, type ProposalItem } from '@/data/proposals'

const EMAIL_BODY = `件名: 【ご提案】Javaエンジニア ご紹介の件

○○株式会社
採用担当 △△様

お世話になっております。
VICENT株式会社の山田でございます。

この度は、貴社のJavaエンジニア案件に対して、
弊社にてご支援できる人材をご紹介させていただきたく、
ご連絡いたしました。

【ご紹介人材】
氏名: 田中 K. 様
スキル: Java / Spring Boot / AWS / PostgreSQL
経験年数: 8年
直近実績: 大手金融系システム開発（3年）

【マッチングポイント】
・必須スキル（Java/Spring）を保有
・金融系システム経験あり（エンド業界適合）
・フルリモート対応可能
・参画可能日: 2026年4月1日〜

ご検討のほど、よろしくお願いいたします。
詳細につきましては、添付の経歴書をご確認ください。

VICENT株式会社
山田 太郎`

const STATUS_STYLES: Record<ProposalItem['status'], string> = {
  '下書き': 'bg-vatch-muted-dark text-vatch-text-dim',
  '提案中': 'bg-blue-900/60 text-blue-300',
  '自動送信待ち': 'bg-cyan-900/60 text-vatch-cyan',
  '返答待ち': 'bg-amber-900/60 text-vatch-amber',
  '提案済み': 'bg-green-900/60 text-vatch-green',
}

function GrossProfitBar({ rate }: { rate: number }) {
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

function AttachmentChip({ name, type }: { name: string; type: 'pdf' | 'xlsx' }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-vatch-border-light bg-vatch-bg text-[11px] text-vatch-text-dim">
      {type === 'pdf' ? (
        <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      )}
      <span>{name}</span>
    </div>
  )
}

function QueueItem({
  item,
  isActive,
  onClick,
}: {
  item: ProposalItem
  isActive: boolean
  onClick: () => void
}) {
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
          <p className="text-[11px] font-semibold text-vatch-text-bright truncate">{item.caseName}</p>
          <p className="text-[10px] text-vatch-muted mt-0.5">{item.caseCompany} / {item.talentName}</p>
        </div>
        <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_STYLES[item.status]}`}>
          {item.status}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[10px] text-vatch-cyan font-bold">AI {item.score}%</span>
        <span className={`text-[10px] font-semibold ${item.grossProfitRate >= 10 ? 'text-vatch-green' : 'text-vatch-red'}`}>
          粗利 {item.grossProfitRate}%
        </span>
      </div>
    </button>
  )
}

export default function ProposalsPage() {
  const [selected, setSelected] = useState<ProposalItem>(currentProposal)
  const [autoSend, setAutoSend] = useState(selected.isAutoSend)
  const [toValue, setToValue] = useState(selected.to)
  const [ccValue, setCcValue] = useState('yamada@vicent.co.jp')
  const [subjectValue, setSubjectValue] = useState(selected.subject)
  const [bodyValue, setBodyValue] = useState(EMAIL_BODY)

  const handleSelect = (item: ProposalItem) => {
    setSelected(item)
    setAutoSend(item.isAutoSend)
    setToValue(item.to)
    setSubjectValue(item.subject)
  }

  const grossProfit = selected.sellPrice - selected.costPrice
  const isMarginOk = selected.grossProfitRate >= 10

  return (
    <>
      <Topbar title="提案メール確認" subtitle="AI生成メール / 粗利チェック / 自動送信" />
      <main className="flex-1 overflow-y-auto p-4">
        <div className="flex gap-3 h-full min-h-0">

          {/* ── Queue sidebar ───────────────────────────────── */}
          <aside className="w-[200px] flex-shrink-0 flex flex-col gap-2">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] font-bold text-vatch-text-dim uppercase tracking-wider">送信キュー</span>
              <span className="text-[10px] text-vatch-cyan font-semibold">{proposalQueue.length}件</span>
            </div>
            <div className="flex flex-col gap-1.5 overflow-y-auto">
              {proposalQueue.map((item) => (
                <QueueItem
                  key={item.id}
                  item={item}
                  isActive={item.id === selected.id}
                  onClick={() => handleSelect(item)}
                />
              ))}
            </div>
          </aside>

          {/* ── Left: Email composition ─────────────────────── */}
          <section className="flex-1 min-w-0 flex flex-col gap-3">

            {/* Email card */}
            <div className="flex-1 flex flex-col bg-vatch-surface border border-vatch-border rounded-xl overflow-hidden">

              {/* Card header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-vatch-border bg-vatch-bg/60">
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800/60 text-[10px] font-bold text-vatch-cyan">
                    ⚡ AI Generated
                  </span>
                  <span className="text-[10px] text-vatch-muted">生成日時: 09:42</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-vatch-muted-dark">AIスコア</span>
                  <span className="text-sm font-bold text-vatch-cyan">{selected.score}%</span>
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
                  <span className="text-[10px] text-vatch-muted-dark px-2 py-0.5 rounded bg-vatch-border/60">{selected.caseCompany}</span>
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

              {/* Attachments */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-t border-vatch-border bg-vatch-bg/40">
                <span className="text-[11px] font-semibold text-vatch-muted w-16 flex-shrink-0">添付ファイル</span>
                <div className="flex items-center gap-2">
                  <AttachmentChip name="経歴書.pdf" type="pdf" />
                  <AttachmentChip name="スキルシート.xlsx" type="xlsx" />
                </div>
                <button className="ml-auto text-[10px] text-vatch-muted hover:text-vatch-text-dim transition-colors">
                  + 追加
                </button>
              </div>
            </div>
          </section>

          {/* ── Right: Gross profit + Send controls ─────────── */}
          <aside className="w-[260px] flex-shrink-0 flex flex-col gap-3">

            {/* Gross profit panel */}
            <div className="bg-vatch-surface border border-vatch-border rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-vatch-text-dim uppercase tracking-wider">粗利チェック</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isMarginOk ? 'bg-green-900/60 text-vatch-green' : 'bg-red-900/60 text-vatch-red'}`}>
                  {isMarginOk ? '✓ 基準適合' : '✗ 要確認'}
                </span>
              </div>

              {/* Warning banner */}
              {!isMarginOk && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/60 border border-red-800/50">
                  <span className="text-sm">⚠️</span>
                  <span className="text-[11px] font-bold text-vatch-red leading-tight">
                    粗利10%未満 — 要確認
                  </span>
                </div>
              )}

              {/* Gross margin — large display */}
              <div className="flex flex-col items-center py-2">
                <span className="text-[11px] text-vatch-muted mb-1">粗利率</span>
                <span className={`text-4xl font-black tabular-nums ${isMarginOk ? 'text-vatch-green' : 'text-vatch-red'}`}>
                  {selected.grossProfitRate}%
                </span>
                <GrossProfitBar rate={selected.grossProfitRate} />
                <div className="flex justify-between w-full mt-1">
                  <span className="text-[9px] text-vatch-muted-dark">0%</span>
                  <span className="text-[9px] text-vatch-amber">10%</span>
                  <span className="text-[9px] text-vatch-muted-dark">30%</span>
                </div>
              </div>

              {/* Price breakdown */}
              <div className="flex flex-col gap-1.5 bg-vatch-bg/60 rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-vatch-muted">仕入値</span>
                  <span className="text-[12px] text-vatch-text font-mono">
                    ¥{selected.costPrice.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-vatch-muted">売値</span>
                  <span className="text-[12px] text-vatch-text font-mono">
                    ¥{selected.sellPrice.toLocaleString()}
                  </span>
                </div>
                <div className="border-t border-vatch-border pt-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-vatch-text-dim">粗利額</span>
                  <span className={`text-[13px] font-bold font-mono ${isMarginOk ? 'text-vatch-green' : 'text-vatch-red'}`}>
                    ¥{grossProfit.toLocaleString()}
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
                    {selected.caseName} / {selected.caseCompany}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-vatch-muted">人材</span>
                  <span className="text-[11px] text-vatch-text">
                    {selected.talentName} ({selected.talentSkill})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-vatch-muted">AIスコア</span>
                  <span className="text-[12px] font-bold text-vatch-cyan">{selected.score}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-vatch-muted">ステータス</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[selected.status]}`}>
                    {selected.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Send controls */}
            <div className="bg-vatch-surface border border-vatch-border rounded-xl p-4 flex flex-col gap-3">
              <span className="text-[11px] font-bold text-vatch-text-dim uppercase tracking-wider">送信設定</span>

              {/* Auto-send toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-semibold text-vatch-text">自動送信</p>
                  <p className="text-[10px] text-vatch-muted mt-0.5">
                    {autoSend ? '有効 — スケジュール送信' : '無効 — 手動送信のみ'}
                  </p>
                </div>
                <button
                  onClick={() => setAutoSend(!autoSend)}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${autoSend ? 'bg-vatch-green' : 'bg-vatch-muted-dark'}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${autoSend ? 'left-[22px]' : 'left-0.5'}`}
                  />
                </button>
              </div>

              {/* Auto-send indicator */}
              {autoSend && (
                <div className="flex items-center gap-1.5 text-[10px] text-vatch-green bg-green-950/40 border border-green-900/40 rounded-lg px-2.5 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-vatch-green animate-pulse flex-shrink-0" />
                  自動送信 ON — スケジュール済み
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col gap-2 pt-1">
                <button className="w-full py-2 rounded-lg border border-vatch-border-light text-[12px] font-semibold text-vatch-text-dim hover:text-vatch-text hover:border-vatch-muted transition-colors">
                  下書き保存
                </button>
                <button className="w-full py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-[12px] font-semibold text-white transition-colors">
                  手動送信
                </button>
                <button
                  disabled={!autoSend}
                  className={`w-full py-2.5 rounded-lg text-[12px] font-bold transition-all ${
                    autoSend
                      ? 'bg-gradient-to-r from-vatch-cyan to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-vatch-bg shadow-lg shadow-cyan-900/40'
                      : 'bg-vatch-border text-vatch-muted-dark cursor-not-allowed'
                  }`}
                >
                  ⚡ 自動送信実行
                </button>
              </div>

              {/* Log note */}
              <p className="text-[10px] text-vatch-muted text-center">
                送信後、履歴に記録されます
              </p>
            </div>

          </aside>
        </div>
      </main>
    </>
  )
}
