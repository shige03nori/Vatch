'use client'

import { useState, useEffect } from 'react'

type WorkStyle = 'REMOTE' | 'ONSITE' | 'HYBRID'

type FavoriteItem = {
  id: string
  caseId: string
  case: { id: string; title: string; client: string; skills: string[]; unitPrice: number; workStyle: WorkStyle; startDate: string }
}

const WS_LABELS: Record<WorkStyle, string> = { REMOTE: 'リモート', ONSITE: '常駐', HYBRID: 'ハイブリッド' }

export default function FavoritesPage() {
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/favorites')
      .then((r) => r.json())
      .then((j) => { if (j.success) setItems(j.data) })
      .finally(() => setLoading(false))
  }, [])

  async function removeFavorite(caseId: string) {
    setItems((prev) => prev.filter((i) => i.caseId !== caseId))
    await fetch(`/api/favorites/${caseId}`, { method: 'DELETE' })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">お気に入り案件</h1>
        <p className="text-sm text-vatch-muted mt-1">{loading ? '読み込み中...' : `${items.length}件`}</p>
      </div>

      {!loading && items.length === 0 && (
        <div className="text-center py-16 text-vatch-muted">
          <p>お気に入り案件はありません</p>
          <a href="/portal" className="mt-3 inline-block text-xs text-[#38bdf8] hover:underline">案件一覧に戻る</a>
        </div>
      )}

      <div className="grid gap-4">
        {items.map((item) => (
          <div key={item.id} className="bg-vatch-surface border border-vatch-border rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-vatch-muted">{WS_LABELS[item.case.workStyle]}</span>
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
              <button onClick={() => removeFavorite(item.caseId)} className="shrink-0 text-2xl text-[#f59e0b] hover:text-[#f59e0b]/60 transition-colors" aria-label="お気に入りを解除">★</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
