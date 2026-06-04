'use client'

import { useState, useEffect } from 'react'

type WorkStyle = 'REMOTE' | 'ONSITE' | 'HYBRID'

type PortalCase = {
  id: string
  caseId: string
  score: number
  isFavorited: boolean
  case: {
    id: string; title: string; client: string; skills: string[]
    unitPrice: number; workStyle: WorkStyle; startDate: string
  }
}

const WS_LABELS: Record<WorkStyle, string> = { REMOTE: 'リモート', ONSITE: '常駐', HYBRID: 'ハイブリッド' }
const WS_COLORS: Record<WorkStyle, string> = { REMOTE: 'text-[#38bdf8]', ONSITE: 'text-[#f59e0b]', HYBRID: 'text-[#a78bfa]' }

function scoreColor(s: number) {
  if (s >= 80) return '#4ade80'
  if (s >= 60) return '#38bdf8'
  return '#a78bfa'
}

export default function PortalPage() {
  const [items, setItems] = useState<PortalCase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal/cases')
      .then((r) => r.json())
      .then((j) => { if (j.success) setItems(j.data) })
      .finally(() => setLoading(false))
  }, [])

  async function toggleFavorite(item: PortalCase) {
    const optimistic = items.map((i) => i.id === item.id ? { ...i, isFavorited: !i.isFavorited } : i)
    setItems(optimistic)
    try {
      if (item.isFavorited) {
        await fetch(`/api/favorites/${item.caseId}`, { method: 'DELETE' })
      } else {
        await fetch('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: item.caseId }) })
      }
    } catch {
      setItems(items)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">あなたにマッチする案件</h1>
        <p className="text-sm text-vatch-muted mt-1">{loading ? '読み込み中...' : `${items.length}件`}</p>
      </div>

      {!loading && items.length === 0 && (
        <div className="text-center py-16 text-vatch-muted">マッチする案件がまだありません</div>
      )}

      <div className="grid gap-4">
        {items.map((item) => (
          <div key={item.id} className="bg-vatch-surface border border-vatch-border rounded-xl p-5 hover:border-[#38bdf8]/40 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: scoreColor(item.score), backgroundColor: `${scoreColor(item.score)}18` }}>
                    スコア {item.score}
                  </span>
                  <span className={`text-xs ${WS_COLORS[item.case.workStyle]}`}>{WS_LABELS[item.case.workStyle]}</span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1 truncate">{item.case.title}</h3>
                <p className="text-xs text-vatch-muted mb-3">{item.case.client}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {item.case.skills.slice(0, 5).map((s) => (
                    <span key={s} className="px-1.5 py-0.5 bg-vatch-border/50 text-vatch-muted rounded text-xs">{s}</span>
                  ))}
                </div>
                <div className="text-xs text-vatch-muted">
                  <span className="text-white font-semibold">{item.case.unitPrice}万円</span>
                  <span className="mx-2">·</span>
                  <span>開始: {new Date(item.case.startDate).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit' })}</span>
                </div>
              </div>
              <button
                onClick={() => toggleFavorite(item)}
                className={`shrink-0 text-2xl transition-colors ${item.isFavorited ? 'text-[#f59e0b]' : 'text-vatch-border hover:text-[#f59e0b]'}`}
                aria-label={item.isFavorited ? 'お気に入りを解除' : 'お気に入りに追加'}
              >
                {item.isFavorited ? '★' : '☆'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
