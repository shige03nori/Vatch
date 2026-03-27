'use client'

import { useState, useMemo } from 'react'
import type { PipelineMatching } from '@/types/pipeline'
import { StageBadge, STAGE_CONFIG, PIPELINE_STAGES, type PipelineStage } from './StageBadge'
import { DetailModal } from './DetailModal'
import { StageChangeModal } from './StageChangeModal'
import { ProposalModal } from './ProposalModal'
import { ContractModal } from './ContractModal'

interface Props {
  initialData: PipelineMatching[]
}

type ModalState =
  | { type: 'detail'; matching: PipelineMatching }
  | { type: 'stage'; matching: PipelineMatching; toStatus: PipelineStage }
  | { type: 'proposal'; matching: PipelineMatching }
  | { type: 'contract'; matching: PipelineMatching }
  | null

// KPI バー用（REPLIED+INTERVIEWING を商談中として集計）
const kpiItems: { key: string; label: string; color: string }[] = [
  { key: 'PENDING_AUTO', label: '提案準備中',   color: '#fbbf24' },
  { key: 'SENT',         label: '提案送信済み', color: '#60a5fa' },
  { key: 'SHODAN',       label: '商談中',        color: '#c084fc' },
  { key: 'CONTRACTED',   label: '成約',           color: '#4ade80' },
  { key: 'REJECTED',     label: '失注',            color: '#f87171' },
]

// フィルタータブ用（商談中 = REPLIED OR INTERVIEWING）
type TabKey = PipelineStage | 'ALL' | 'SHODAN'
const tabItems: { key: TabKey; label: string }[] = [
  { key: 'PENDING_AUTO', label: '提案準備中' },
  { key: 'SENT',         label: '提案送信済み' },
  { key: 'SHODAN',       label: '商談中' },
  { key: 'CONTRACTED',   label: '成約' },
  { key: 'REJECTED',     label: '失注' },
]

export function PipelineTable({ initialData }: Props) {
  const [data, setData] = useState<PipelineMatching[]>(initialData)
  const [activeTab, setActiveTab] = useState<TabKey>('ALL')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>(null)

  const kpi = useMemo(() => {
    const counts: Record<string, number> = {}
    let contractedRevenue = 0
    for (const m of data) {
      counts[m.status] = (counts[m.status] ?? 0) + 1
      if (m.status === 'CONTRACTED') contractedRevenue += m.sellPrice ?? 0
    }
    // REPLIED と INTERVIEWING を商談中として合算
    counts['SHODAN'] = (counts['REPLIED'] ?? 0) + (counts['INTERVIEWING'] ?? 0)
    return { counts, contractedRevenue }
  }, [data])

  const filtered = useMemo(() => {
    return data.filter(m => {
      if (activeTab !== 'ALL') {
        if (activeTab === 'SHODAN') {
          if (m.status !== 'REPLIED' && m.status !== 'INTERVIEWING') return false
        } else if (m.status !== activeTab) {
          return false
        }
      }
      if (search) {
        const q = search.toLowerCase()
        if (!m.case.title.toLowerCase().includes(q) && !m.talent.name.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [data, activeTab, search])

  function handleStageSelect(matching: PipelineMatching, newStatus: PipelineStage) {
    if (newStatus === matching.status) return
    setModal({ type: 'stage', matching, toStatus: newStatus })
  }

  function handleMemoSaved(matchingId: string, memo: string) {
    setData(prev => prev.map(m => m.id === matchingId ? { ...m, memo } : m))
    setModal(null)
  }

  function handleStageConfirmed(matchingId: string, newStatus: PipelineStage) {
    setData(prev => prev.map(m => m.id === matchingId ? { ...m, status: newStatus } : m))
    setModal(null)
  }

  function handleContracted(matchingId: string) {
    setData(prev => prev.map(m => m.id === matchingId ? { ...m, status: 'CONTRACTED' as PipelineStage } : m))
    setModal(null)
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#0f0f0f' }}>
      {/* KPI バー */}
      <div className="grid grid-cols-5 gap-3 px-6 py-4 border-b border-[#1e1e1e]">
        {kpiItems.map(item => (
          <div
            key={item.key}
            className="rounded-lg px-4 py-3"
            style={{ background: '#111', border: `1px solid #1e1e1e` }}
          >
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#555' }}>
              {item.label}
            </p>
            <p className="text-xl font-bold" style={{ color: item.color }}>
              {kpi.counts[item.key] ?? 0}
              <span className="text-xs font-normal ml-1" style={{ color: '#555' }}>件</span>
              {item.key === 'CONTRACTED' && (
                <span className="text-xs font-normal ml-1" style={{ color: '#4ade80' }}>
                  / ¥{kpi.contractedRevenue}万
                </span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* フィルタータブ + 検索バー */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#1e1e1e]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('ALL')}
            className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
            style={{
              background: activeTab === 'ALL' ? '#0c2d5a' : 'transparent',
              color: activeTab === 'ALL' ? '#38bdf8' : '#666',
              border: activeTab === 'ALL' ? '1px solid #1e3a5f' : '1px solid transparent',
            }}
          >
            全件 <span style={{ color: '#555' }}>({data.length})</span>
          </button>
          {tabItems.map(({ key, label }) => {
            const isActive = activeTab === key
            const stageKey = key === 'SHODAN' ? 'INTERVIEWING' : key as PipelineStage
            const config = STAGE_CONFIG[stageKey]
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                style={{
                  background: isActive ? config.bg : 'transparent',
                  color: isActive ? config.color : '#666',
                  border: isActive ? `1px solid ${config.border}` : '1px solid transparent',
                }}
              >
                {label} <span style={{ color: '#555' }}>({kpi.counts[key] ?? 0})</span>
              </button>
            )
          })}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="案件名・人材名で検索..."
          className="text-xs rounded-lg px-3 py-1.5 outline-none w-56"
          style={{ background: '#111', border: '1px solid #2a2a2a', color: '#e0e0e0' }}
        />
      </div>

      {/* テーブルヘッダー */}
      <div
        className="grid text-[10px] uppercase tracking-widest px-6 py-2"
        style={{
          gridTemplateColumns: '2fr 1.5fr 60px 70px 70px 80px 110px 140px',
          background: '#0d0d0d',
          color: '#444',
          borderBottom: '1px solid #1e1e1e',
        }}
      >
        <span>案件名</span>
        <span>人材名</span>
        <span>スコア</span>
        <span>単価</span>
        <span>粗利率</span>
        <span>担当者</span>
        <span>ステージ</span>
        <span>アクション</span>
      </div>

      {/* テーブル本体 */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map(m => {
          const scoreColor = m.score >= 85 ? '#4ade80' : m.score >= 70 ? '#fbbf24' : '#888'
          const gpr = m.grossProfitRate
          const gprColor = gpr >= 15 ? '#4ade80' : gpr >= 10 ? '#fbbf24' : '#888'
          const canContract = m.status === 'REPLIED' || m.status === 'INTERVIEWING'
          const stageConfig = STAGE_CONFIG[m.status as PipelineStage] ?? STAGE_CONFIG['PENDING_AUTO']

          return (
            <div
              key={m.id}
              className="grid items-center px-6 py-3 border-b border-[#111] hover:bg-[#111] transition-colors"
              style={{ gridTemplateColumns: '2fr 1.5fr 60px 70px 70px 80px 110px 140px' }}
            >
              {/* 案件名 */}
              <div className="min-w-0 pr-3">
                <p className="text-xs font-semibold text-[#e0e0e0] truncate">{m.case.title}</p>
                <p className="text-[10px] text-[#555] truncate">{m.case.client}</p>
                {m.memo && (
                  <p className="text-[10px] truncate mt-0.5" style={{ color: '#a78bfa' }}>
                    📝 {m.memo.slice(0, 100)}
                  </p>
                )}
              </div>

              {/* 人材名 */}
              <div className="min-w-0 pr-3">
                <p className="text-xs font-semibold text-[#e0e0e0] truncate">{m.talent.name}</p>
                <p className="text-[10px] text-[#555] truncate">
                  {m.talent.skills.slice(0, 2).join(' / ')}
                  {m.talent.experience > 0 && ` · ${m.talent.experience}年`}
                </p>
              </div>

              {/* スコア */}
              <div>
                <span className="text-xs font-bold" style={{ color: scoreColor }}>
                  {m.score}%
                </span>
              </div>

              {/* 単価 */}
              <div>
                <span className="text-xs text-[#e0e0e0]">{m.case.unitPrice}万</span>
              </div>

              {/* 粗利率 */}
              <div>
                <span className="text-xs font-semibold" style={{ color: gprColor }}>
                  {gpr.toFixed(0)}%
                </span>
              </div>

              {/* 担当者 */}
              <div>
                <span className="text-xs text-[#888]">{m.case.assignedUser?.name ?? '—'}</span>
              </div>

              {/* ステージドロップダウン */}
              <div>
                <select
                  value={m.status}
                  onChange={e => handleStageSelect(m, e.target.value as PipelineStage)}
                  className="text-xs rounded-md px-2 py-1 outline-none w-full"
                  style={{
                    background: stageConfig.bg,
                    color: stageConfig.color,
                    border: `1px solid ${stageConfig.border}`,
                  }}
                >
                  {PIPELINE_STAGES.map(stage => (
                    <option key={stage} value={stage} style={{ background: '#111', color: STAGE_CONFIG[stage].color }}>
                      {STAGE_CONFIG[stage].label}
                    </option>
                  ))}
                </select>
              </div>

              {/* アクションボタン */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setModal({ type: 'detail', matching: m })}
                  className="px-2 py-1 text-[10px] rounded-md transition-colors"
                  style={{ background: '#1a1a1a', color: '#888', border: '1px solid #2a2a2a' }}
                >
                  詳細
                </button>
                <button
                  onClick={() => setModal({ type: 'proposal', matching: m })}
                  className="px-2 py-1 text-[10px] rounded-md transition-colors"
                  style={{ background: '#0d1f3c', color: '#60a5fa', border: '1px solid #1e3a5f' }}
                >
                  提案
                </button>
                <button
                  onClick={() => canContract && setModal({ type: 'contract', matching: m })}
                  disabled={!canContract}
                  className="px-2 py-1 text-[10px] rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: '#052e16', color: '#4ade80', border: '1px solid #166534' }}
                >
                  成約
                </button>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="flex items-center justify-center h-32 text-[#444] text-xs">
            データがありません
          </div>
        )}
      </div>

      {/* モーダル */}
      {modal?.type === 'detail' && (
        <DetailModal matching={modal.matching} onClose={() => setModal(null)} onMemoSaved={handleMemoSaved} />
      )}
      {modal?.type === 'stage' && (
        <StageChangeModal
          matchingId={modal.matching.id}
          fromStatus={modal.matching.status as PipelineStage}
          toStatus={modal.toStatus}
          onClose={() => setModal(null)}
          onConfirmed={handleStageConfirmed}
        />
      )}
      {modal?.type === 'proposal' && (
        <ProposalModal
          matching={modal.matching}
          onClose={() => setModal(null)}
          onProposalUpdated={() => setModal(null)}
        />
      )}
      {modal?.type === 'contract' && (
        <ContractModal matching={modal.matching} onClose={() => setModal(null)} onContracted={handleContracted} />
      )}
    </div>
  )
}
