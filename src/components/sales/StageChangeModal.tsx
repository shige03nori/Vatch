'use client'

import { useState } from 'react'
import { StageBadge, STAGE_CONFIG, type PipelineStage } from './StageBadge'

interface Props {
  matchingId: string
  fromStatus: PipelineStage
  toStatus: PipelineStage
  onClose: () => void
  onConfirmed: (matchingId: string, newStatus: PipelineStage) => void
}

export function StageChangeModal({ matchingId, fromStatus, toStatus, onClose, onConfirmed }: Props) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      const res = await fetch(`/api/matchings/${matchingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: toStatus }),
      })
      if (!res.ok) throw new Error('更新失敗')
      onConfirmed(matchingId, toStatus)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#111] border border-[#2a2a2a] rounded-xl w-[420px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-bold text-white">ステージ変更の確認</h2>
          <button onClick={onClose} className="text-[#555] hover:text-white text-lg">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-3">
            <StageBadge status={fromStatus} />
            <span className="text-[#555] text-lg">→</span>
            <StageBadge status={toStatus} />
          </div>

          <p className="text-xs text-[#888]">
            ステージを <strong className="text-[#e0e0e0]">{STAGE_CONFIG[fromStatus].label}</strong> から{' '}
            <strong className="text-[#e0e0e0]">{STAGE_CONFIG[toStatus].label}</strong> に変更します。
          </p>

          <div>
            <p className="text-[10px] text-[#555] uppercase tracking-widest mb-1.5">変更メモ（任意）</p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="例：先方から連絡があり商談を設定"
              className="w-full bg-[#1a1a1a] border border-[#333] text-[#e0e0e0] rounded-lg px-3 py-2 text-xs resize-none outline-none placeholder:text-[#555]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg bg-[#1e1e1e] text-[#888] border border-[#333]">
              キャンセル
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="px-4 py-2 text-xs rounded-lg bg-[#2563eb] text-white font-semibold disabled:opacity-50"
            >
              {loading ? '更新中...' : '変更する'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
