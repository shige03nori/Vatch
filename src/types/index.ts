export type KpiItem = {
  id: string
  value: string | number
  label: string
  change: string
  color: 'blue' | 'green' | 'amber' | 'red'
}

export type MatchingCandidate = {
  id: string
  skill: string
  skillColor: string
  talentName: string
  caseName: string
  score: number
  grossProfitOk: boolean
}

export type AutoSendItem = {
  id: string
  status: 'auto' | 'check' | 'draft'
  label: string
  grossProfitRate: number
}

export type AlertItem = {
  id: string
  icon: string
  message: string
  severity: 'warning' | 'error' | 'info'
  date: string
}

export type PipelineItem = {
  label: string
  count: number
  color: string
  percentage: number
}

export type ActivityItem = {
  id: string
  time: string
  color: string
  text: string
  highlight: string
}
