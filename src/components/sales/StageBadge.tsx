'use client'

export type PipelineStage =
  | 'UNPROPOSED'
  | 'PENDING_AUTO'
  | 'SENT'
  | 'REPLIED'
  | 'INTERVIEWING'
  | 'CONTRACTED'
  | 'REJECTED'

export const STAGE_CONFIG: Record<PipelineStage, { label: string; color: string; bg: string; border: string }> = {
  UNPROPOSED:  { label: '未提案',       color: '#9ca3af', bg: '#1a1a1a',  border: '#374151' },
  PENDING_AUTO:{ label: '提案準備中',   color: '#fbbf24', bg: '#1c1408',  border: '#78350f' },
  SENT:        { label: '提案送信済み', color: '#60a5fa', bg: '#0d1f3c',  border: '#1e3a5f' },
  REPLIED:     { label: '返答あり',     color: '#c084fc', bg: '#1a1230',  border: '#4c1d95' },
  INTERVIEWING:{ label: '商談中',       color: '#c084fc', bg: '#1a1230',  border: '#4c1d95' },
  CONTRACTED:  { label: '成約',         color: '#4ade80', bg: '#052e16',  border: '#166534' },
  REJECTED:    { label: '失注',         color: '#f87171', bg: '#1f0a0a',  border: '#7f1d1d' },
}

export const PIPELINE_STAGES: PipelineStage[] = [
  'PENDING_AUTO',
  'SENT',
  'REPLIED',
  'INTERVIEWING',
  'CONTRACTED',
  'REJECTED',
]

interface StageBadgeProps {
  status: PipelineStage
  className?: string
}

export function StageBadge({ status, className = '' }: StageBadgeProps) {
  const config = STAGE_CONFIG[status]
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${className}`}
      style={{ color: config.color, background: config.bg, border: `1px solid ${config.border}` }}
    >
      {config.label}
    </span>
  )
}
