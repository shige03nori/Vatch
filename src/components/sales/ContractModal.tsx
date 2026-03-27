'use client'

import { useState } from 'react'
import type { PipelineMatching } from '@/types/pipeline'

interface Props {
  matching: PipelineMatching
  onClose: () => void
  onContracted: (matchingId: string) => void
}

export function ContractModal({ matching, onClose, onContracted }: Props) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [unitPrice, setUnitPrice] = useState(String(matching.case.unitPrice ?? ''))
  const [costPrice, setCostPrice] = useState(String(matching.costPrice ?? ''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const grossProfitRate = unitPrice && costPrice
    ? ((Number(unitPrice) - Number(costPrice)) / Number(unitPrice)) * 100
    : null
  const grossProfitAmount = unitPrice && costPrice
    ? Number(unitPrice) - Number(costPrice)
    : null

  async function handleSubmit() {
    if (!startDate || !unitPrice || !costPrice) {
      setError('契約開始日・売価・原価は必須です')
      return
    }
    if (!matching.proposal?.id) {
      setError('提案が存在しないため成約登録できません')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: matching.caseId,
          talentId: matching.talentId,
          proposalId: matching.proposal.id,
          startDate,
          endDate: endDate || undefined,
          unitPrice: Number(unitPrice),
          costPrice: Number(costPrice),
          grossProfitRate: grossProfitRate ?? 0,
        }),
      })
      if (!res.ok) throw new Error('成約登録失敗')

      const patchRes = await fetch(`/api/matchings/${matching.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CONTRACTED' }),
      })
      if (!patchRes.ok) throw new Error('ステータス更新失敗')

      onContracted(matching.id)
    } catch {
      setError('登録に失敗しました。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#111] border border-[#2a2a2a] rounded-xl w-[440px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-bold text-white">
            成約登録 — {matching.case.title} × {matching.talent.name}
          </h2>
          <button onClick={onClose} className="text-[#555] hover:text-white text-lg">✕</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {[
            { label: '契約開始日', value: startDate, setter: setStartDate, placeholder: '2026-04-01', required: true },
            { label: '契約終了予定日', value: endDate, setter: setEndDate, placeholder: '2026-09-30', required: false },
          ].map(({ label, value, setter, placeholder, required }) => (
            <div key={label}>
              <label className="text-[11px] text-[#888] block mb-1">
                {label}{required && <span className="text-[#f87171] ml-1">*</span>}
              </label>
              <input
                type="text"
                value={value}
                onChange={e => setter(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-[#1a1a1a] border border-[#333] text-[#e0e0e0] rounded-lg px-3 py-2 text-xs outline-none"
              />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '売価（万円/月）', value: unitPrice, setter: setUnitPrice },
              { label: '原価（万円/月）', value: costPrice, setter: setCostPrice },
            ].map(({ label, value, setter }) => (
              <div key={label}>
                <label className="text-[11px] text-[#888] block mb-1">
                  {label} <span className="text-[#f87171]">*</span>
                </label>
                <input
                  type="number"
                  value={value}
                  onChange={e => setter(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#333] text-[#e0e0e0] rounded-lg px-3 py-2 text-xs outline-none"
                />
              </div>
            ))}
          </div>

          {grossProfitRate !== null && (
            <div className="bg-[#052e16] border border-[#166534] rounded-lg px-4 py-2 flex gap-6 text-xs">
              <span className="text-[#888]">粗利率：<strong className="text-[#4ade80] text-base">{grossProfitRate.toFixed(1)}%</strong></span>
              <span className="text-[#888]">粗利額：<strong className="text-[#4ade80]">{grossProfitAmount}万円/月</strong></span>
            </div>
          )}

          {error && <p className="text-xs text-[#f87171]">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg bg-[#1e1e1e] text-[#888] border border-[#333]">
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 text-xs rounded-lg bg-[#166534] text-[#4ade80] font-semibold disabled:opacity-50"
            >
              {loading ? '登録中...' : '成約登録'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
