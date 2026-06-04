'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'

type TalentStatus = 'AVAILABLE' | 'ACTIVE' | 'NEGOTIATING' | 'ENDING_SOON' | 'INACTIVE'
type Office = 'TOKYO' | 'NAGOYA'

type ProperItem = {
  id: string
  name: string
  skills: string[]
  experience: number
  desiredRate: number
  location: string
  office: Office
  status: TalentStatus
  createdAt: string
}

const STATUS_CONFIG: Record<TalentStatus, { label: string; color: string; bg: string }> = {
  AVAILABLE:   { label: '空き',     color: 'text-[#4ade80]', bg: 'bg-[#4ade80]/10' },
  ACTIVE:      { label: '稼働中',   color: 'text-[#38bdf8]', bg: 'bg-[#38bdf8]/10' },
  NEGOTIATING: { label: '交渉中',   color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
  ENDING_SOON: { label: '終了間近', color: 'text-[#f87171]', bg: 'bg-[#f87171]/10' },
  INACTIVE:    { label: '非活動',   color: 'text-[#64748b]', bg: 'bg-[#64748b]/10' },
}

export default function ProperPage() {
  const router = useRouter()
  const [items, setItems] = useState<ProperItem[]>([])
  const [loading, setLoading] = useState(true)
  const [officeTab, setOfficeTab] = useState<Office | 'all'>('all')

  useEffect(() => {
    setLoading(true)
    const url = officeTab === 'all' ? '/api/proper?limit=200' : `/api/proper?limit=200&office=${officeTab}`
    fetch(url)
      .then((r) => r.json())
      .then((j) => { if (j.success) setItems(j.data) })
      .finally(() => setLoading(false))
  }, [officeTab])

  const tokyoCount  = useMemo(() => items.filter((i) => i.office === 'TOKYO').length, [items])
  const nagoyaCount = useMemo(() => items.filter((i) => i.office === 'NAGOYA').length, [items])

  return (
    <div className="flex flex-col h-full bg-vatch-bg">
      <Topbar title="プロパ管理" />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">

          {/* サマリーカード */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: '全員', count: items.length, color: 'text-[#38bdf8]' },
              { label: '東京', count: tokyoCount,  color: 'text-[#4ade80]' },
              { label: '名古屋', count: nagoyaCount, color: 'text-[#f59e0b]' },
            ].map(({ label, count, color }) => (
              <div key={label} className="bg-vatch-surface border border-vatch-border rounded-lg p-4">
                <div className={`text-xs font-medium mb-2 ${color}`}>{label}</div>
                <div className="text-2xl font-bold text-white">{count}</div>
                <div className="text-xs text-vatch-muted mt-1">名</div>
              </div>
            ))}
          </div>

          {/* タブ + 登録ボタン */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1 bg-vatch-surface border border-vatch-border rounded-lg p-1">
              {(['all', 'TOKYO', 'NAGOYA'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setOfficeTab(tab)}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    officeTab === tab
                      ? 'bg-[#0c2d5a] text-[#38bdf8]'
                      : 'text-vatch-muted hover:text-white'
                  }`}
                >
                  {tab === 'all' ? '全員' : tab === 'TOKYO' ? '東京' : '名古屋'}
                </button>
              ))}
            </div>
            <button
              onClick={() => router.push('/proper/new')}
              className="px-4 py-2 bg-[#38bdf8] text-black text-xs font-bold rounded-lg hover:bg-[#38bdf8]/90 transition-colors"
            >
              ＋ プロパを登録
            </button>
          </div>

          {/* テーブル */}
          <div className="bg-vatch-surface border border-vatch-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-vatch-border text-vatch-muted text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">氏名 / 拠点</th>
                    <th className="text-left px-4 py-3 font-medium">スキル</th>
                    <th className="text-right px-4 py-3 font-medium">経験年数</th>
                    <th className="text-right px-4 py-3 font-medium">希望単価</th>
                    <th className="text-left px-4 py-3 font-medium">ステータス</th>
                    <th className="text-center px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="text-center py-12 text-vatch-muted">読み込み中...</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-vatch-muted">登録されたプロパがありません</td></tr>
                  ) : items.map((item, idx) => {
                    const sc = STATUS_CONFIG[item.status]
                    return (
                      <tr key={item.id} className={`border-b border-vatch-border/50 hover:bg-white/[0.02] transition-colors ${idx === items.length - 1 ? 'border-b-0' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{item.name}</div>
                          <div className="text-xs text-vatch-muted mt-0.5">
                            {item.office === 'TOKYO' ? '東京' : '名古屋'} · {item.location}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {item.skills.slice(0, 3).map((s) => (
                              <span key={s} className="px-1.5 py-0.5 bg-vatch-border/50 text-vatch-muted rounded text-xs">{s}</span>
                            ))}
                            {item.skills.length > 3 && <span className="px-1.5 py-0.5 bg-vatch-border/50 text-vatch-muted rounded text-xs">+{item.skills.length - 3}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right"><span className="text-white font-semibold">{item.experience}</span><span className="text-vatch-muted text-xs ml-1">年</span></td>
                        <td className="px-4 py-3 text-right whitespace-nowrap"><span className="text-white font-semibold">{item.desiredRate}</span><span className="text-vatch-muted text-xs ml-1">万円</span></td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sc.color} ${sc.bg}`}>{sc.label}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => router.push(`/proper/${item.id}`)} className="px-3 py-1 text-xs border border-vatch-border rounded hover:border-[#38bdf8] hover:text-[#38bdf8] text-vatch-muted transition-colors">
                            詳細
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
