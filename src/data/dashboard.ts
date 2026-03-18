import type { KpiItem, MatchingCandidate, AutoSendItem, AlertItem, PipelineItem, ActivityItem } from '@/types'

export const kpiItems: KpiItem[] = [
  { id: '1', value: 12,      label: '本日受信案件',     change: '↑ 3件',   color: 'blue'  },
  { id: '2', value: 8,       label: '本日受信人材',     change: '↑ 2件',   color: 'blue'  },
  { id: '3', value: 24,      label: 'AIマッチング候補', change: '新着 5件', color: 'green' },
  { id: '4', value: 5,       label: '自動送信待ち',     change: '要確認',   color: 'amber' },
  { id: '5', value: 3,       label: '面談調整中',       change: '今週',     color: 'blue'  },
  { id: '6', value: '¥2.4M', label: '今月粗利見込',     change: '↑ 12%',   color: 'green' },
]

export const matchingCandidates: MatchingCandidate[] = [
  { id: '1', skill: 'Java',  skillColor: 'blue',   talentName: '田中 K.', caseName: '金融系案件',   score: 92, grossProfitOk: true  },
  { id: '2', skill: 'React', skillColor: 'cyan',   talentName: '佐藤 M.', caseName: 'ECサイト案件', score: 85, grossProfitOk: true  },
  { id: '3', skill: 'PM',    skillColor: 'purple', talentName: '鈴木 R.', caseName: '製造業DX案件', score: 71, grossProfitOk: false },
  { id: '4', skill: 'Go',    skillColor: 'green',  talentName: '高橋 S.', caseName: 'インフラ案件', score: 68, grossProfitOk: true  },
]

export const autoSendQueue: AutoSendItem[] = [
  { id: '1', status: 'auto',  label: 'Java × 田中 → ABC商事', grossProfitRate: 14.2 },
  { id: '2', status: 'auto',  label: 'React × 佐藤 → XYZ社',  grossProfitRate: 11.5 },
  { id: '3', status: 'check', label: 'PM × 鈴木 → 製造A社',   grossProfitRate: 9.8  },
  { id: '4', status: 'draft', label: 'Go × 高橋 → インフラB',  grossProfitRate: 12.1 },
]

export const alerts: AlertItem[] = [
  { id: '1', icon: '⚠️', message: '契約更新 2件 — 来月末', severity: 'warning', date: '4/30'   },
  { id: '2', icon: '📭', message: '返答待ち超過 3件',       severity: 'error',   date: '3日超' },
  { id: '3', icon: '💴', message: '粗利10%未満候補 1件',    severity: 'warning', date: '要確認' },
]

export const pipeline: PipelineItem[] = [
  { label: '面談調整中', count: 3,  color: '#a78bfa', percentage: 25  },
  { label: '提案中',     count: 7,  color: '#38bdf8', percentage: 58  },
  { label: '返答待ち',   count: 5,  color: '#f59e0b', percentage: 42  },
  { label: '稼働中',     count: 12, color: '#4ade80', percentage: 100 },
]

export const activityLog: ActivityItem[] = [
  { id: '1', time: '09:42', color: '#38bdf8', text: 'Java案件メール取込 → ', highlight: 'AI解析完了'    },
  { id: '2', time: '09:31', color: '#4ade80', text: '田中さんへ ',           highlight: '提案メール送信' },
  { id: '3', time: '09:15', color: '#a78bfa', text: '鈴木さん面談 ',         highlight: '日程確定'       },
  { id: '4', time: '08:59', color: '#f59e0b', text: '人材8件 ',              highlight: '新着取込'       },
]
