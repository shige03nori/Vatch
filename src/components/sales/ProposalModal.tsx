'use client'

import { useState } from 'react'
import type { PipelineMatching } from '@/types/pipeline'

interface Props {
  matching: PipelineMatching
  onClose: () => void
  onUpdated: () => void
}

const PROPOSAL_STATUS_LABEL: Record<string, string> = {
  DRAFT: '下書き',
  PENDING_AUTO: '自動送信待ち',
  SENT: '送信済み',
  REPLIED: '返答あり',
  REJECTED: '不採用',
}

export function ProposalModal({ matching, onClose, onUpdated }: Props) {
  const [loading, setLoading] = useState(false)
  const proposal = matching.proposal

  async function handleResend() {
    if (!proposal) return
    setLoading(true)
    try {
      await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.id }),
      })
      onUpdated()
    } finally {
      setLoading(false)
    }
  }

  async function handleRevoke() {
    if (!proposal) return
    setLoading(true)
    try {
      await fetch(`/api/proposals/${proposal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DRAFT' }),
      })
      onUpdated()
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    setLoading(true)
    try {
      await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchingId: matching.id }),
      })
      onUpdated()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#111] border border-[#2a2a2a] rounded-xl w-[540px] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-bold text-white">
            提案 — {matching.case.title} × {matching.talent.name}
          </h2>
          <button onClick={onClose} className="text-[#555] hover:text-white text-lg">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {proposal ? (
            <>
              <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-lg px-4 py-3 space-y-2 text-xs">
                {[
                  ['ステータス', PROPOSAL_STATUS_LABEL[proposal.status] ?? proposal.status],
                  ['送信日時', proposal.sentAt ? new Date(proposal.sentAt).toLocaleString('ja-JP') : '—'],
                  ['送信先', proposal.to],
                  ['粗利率', `${proposal.grossProfitRate?.toFixed(1)}%`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-[#888]">{k}</span>
                    <span className="text-[#e0e0e0]">{v}</span>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-[10px] text-[#555] uppercase tracking-widest mb-1.5">提案メール本文</p>
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-[#ccc] leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {proposal.bodyText}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg bg-[#1e1e1e] text-[#888] border border-[#333]">
                  閉じる
                </button>
                <button
                  onClick={handleRevoke}
                  disabled={loading}
                  className="px-4 py-2 text-xs rounded-lg bg-[#1f0a0a] text-[#f87171] border border-[#7f1d1d] disabled:opacity-50"
                >
                  提案を取り消す
                </button>
                <button
                  onClick={handleResend}
                  disabled={loading}
                  className="px-4 py-2 text-xs rounded-lg bg-[#2563eb] text-white font-semibold disabled:opacity-50"
                >
                  {loading ? '処理中...' : '再送信'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-[#888]">このマッチングにはまだ提案がありません。新規作成します。</p>
              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg bg-[#1e1e1e] text-[#888] border border-[#333]">
                  キャンセル
                </button>
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className="px-4 py-2 text-xs rounded-lg bg-[#2563eb] text-white font-semibold disabled:opacity-50"
                >
                  {loading ? '作成中...' : '提案を作成'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
