'use client'

import { useState } from 'react'
import type { PipelineMatching } from '@/types/pipeline'

interface Props {
  matching: PipelineMatching
  onClose: () => void
  onMemoSaved: (matchingId: string, memo: string) => void
}

export function DetailModal({ matching, onClose, onMemoSaved }: Props) {
  const [memo, setMemo] = useState(matching.memo ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/matchings/${matching.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo }),
      })
      if (!res.ok) throw new Error('保存失敗')
      onMemoSaved(matching.id, memo)
    } finally {
      setSaving(false)
    }
  }

  const { case: c, talent } = matching

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#111] border border-[#2a2a2a] rounded-xl w-[540px] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-bold text-white">
            詳細 — {c.title} × {talent.name}
          </h2>
          <button onClick={onClose} className="text-[#555] hover:text-white text-lg">✕</button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <section>
            <p className="text-[10px] text-[#555] uppercase tracking-widest mb-2">案件情報</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['顧客', c.client],
                ['単価', `${c.unitPrice}万円/月`],
                ['スタート', c.startDate ? new Date(c.startDate).toLocaleDateString('ja-JP') : '—'],
                ['勤務形態', c.workStyle],
              ].map(([k, v]) => (
                <div key={k} className="bg-[#1a1a1a] rounded-lg px-3 py-2">
                  <p className="text-[10px] text-[#555]">{k}</p>
                  <p className="text-sm font-semibold text-[#e0e0e0]">{v}</p>
                </div>
              ))}
            </div>
            {c.skills?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {c.skills.map((s: string) => (
                  <span key={s} className="text-[11px] px-2 py-0.5 rounded bg-[#0d1f3c] text-[#60a5fa]">{s}</span>
                ))}
              </div>
            )}
          </section>

          <section>
            <p className="text-[10px] text-[#555] uppercase tracking-widest mb-2">人材情報</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#1a1a1a] rounded-lg px-3 py-2">
                <p className="text-[10px] text-[#555]">経験年数</p>
                <p className="text-sm font-semibold text-[#e0e0e0]">{talent.experience}年</p>
              </div>
              <div className="bg-[#1a1a1a] rounded-lg px-3 py-2">
                <p className="text-[10px] text-[#555]">希望単価</p>
                <p className="text-sm font-semibold text-[#e0e0e0]">{talent.desiredRate ?? '—'}万円/月</p>
              </div>
            </div>
          </section>

          <section>
            <p className="text-[10px] text-[#555] uppercase tracking-widest mb-2">
              マッチングスコア {matching.score}%
            </p>
            <div className="bg-[#1a1a1a] rounded-lg px-3 py-2 space-y-2">
              {[
                ['スキルマッチ', matching.skillMatchRate, true] as const,
                ['単価適合', matching.unitPriceOk ? 100 : 0, matching.unitPriceOk] as const,
                ['タイミング', matching.timingOk ? 100 : 0, matching.timingOk] as const,
                ['勤務地', matching.locationOk ? 100 : 0, matching.locationOk] as const,
              ].map(([label, val, ok]) => (
                <div key={label} className="flex items-center gap-3 text-xs">
                  <span className="w-24 text-[#888]">{label}</span>
                  <div className="flex-1 h-1 bg-[#2a2a2a] rounded">
                    <div
                      className="h-1 rounded"
                      style={{ width: `${val}%`, background: ok ? '#4ade80' : '#f87171' }}
                    />
                  </div>
                  <span style={{ color: ok ? '#4ade80' : '#f87171' }}>
                    {typeof val === 'number' && val !== 100 && val !== 0 ? `${val}%` : (ok ? 'OK' : 'NG')}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="text-[10px] text-[#555] uppercase tracking-widest mb-2">メモ</p>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              rows={3}
              placeholder="商談メモを入力..."
              className="w-full bg-[#1a1a1a] border border-[#333] text-[#e0e0e0] rounded-lg px-3 py-2 text-xs resize-none outline-none placeholder:text-[#555]"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg bg-[#1e1e1e] text-[#888] border border-[#333]">
                閉じる
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-xs rounded-lg bg-[#2563eb] text-white font-semibold disabled:opacity-50"
              >
                {saving ? '保存中...' : 'メモ保存'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
