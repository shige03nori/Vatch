export type ProposalItem = {
  id: string
  caseName: string
  caseCompany: string
  talentName: string
  talentSkill: string
  score: number
  status: '下書き' | '提案中' | '自動送信待ち' | '返答待ち' | '提案済み'
  grossProfitRate: number
  costPrice: number
  sellPrice: number
  to: string
  subject: string
  isAutoSend: boolean
}

export const proposalQueue: ProposalItem[] = [
  {
    id: '1',
    caseName: 'Java案件',
    caseCompany: 'ABC商事',
    talentName: '田中 K.',
    talentSkill: 'Java/Spring',
    score: 92,
    status: '自動送信待ち',
    grossProfitRate: 14.3,
    costPrice: 600000,
    sellPrice: 700000,
    to: 'saiyou@abc-shoji.co.jp',
    subject: '【ご提案】Javaエンジニア ご紹介の件',
    isAutoSend: true,
  },
  {
    id: '2',
    caseName: 'ECサイトリプレイス',
    caseCompany: 'XYZ株式会社',
    talentName: '佐藤 M.',
    talentSkill: 'React/TypeScript',
    score: 88,
    status: '提案中',
    grossProfitRate: 12.5,
    costPrice: 560000,
    sellPrice: 640000,
    to: 'tech@xyz-corp.co.jp',
    subject: '【ご提案】Reactエンジニア ご紹介の件',
    isAutoSend: true,
  },
  {
    id: '3',
    caseName: '製造業DX推進PMO',
    caseCompany: '製造A社',
    talentName: '鈴木 R.',
    talentSkill: 'PM/PMO',
    score: 76,
    status: '下書き',
    grossProfitRate: 7.8,
    costPrice: 720000,
    sellPrice: 780000,
    to: 'dx@seizou-a.co.jp',
    subject: '【ご提案】PMOエンジニア ご紹介の件',
    isAutoSend: false,
  },
  {
    id: '4',
    caseName: 'クラウドインフラ構築',
    caseCompany: 'インフラB社',
    talentName: '高橋 S.',
    talentSkill: 'AWS/Terraform',
    score: 85,
    status: '自動送信待ち',
    grossProfitRate: 15.0,
    costPrice: 680000,
    sellPrice: 800000,
    to: 'infra@infra-b.co.jp',
    subject: '【ご提案】AWSエンジニア ご紹介の件',
    isAutoSend: true,
  },
  {
    id: '5',
    caseName: 'データ分析基盤構築',
    caseCompany: 'ビッグデータ社',
    talentName: '中村 K.',
    talentSkill: 'Python/BigQuery',
    score: 91,
    status: '提案済み',
    grossProfitRate: 13.3,
    costPrice: 600000,
    sellPrice: 690000,
    to: 'data@bigdata.co.jp',
    subject: '【ご提案】データエンジニア ご紹介の件',
    isAutoSend: false,
  },
  {
    id: '6',
    caseName: 'マイクロサービス設計',
    caseCompany: 'テックH社',
    talentName: '加藤 Y.',
    talentSkill: 'Go/Kubernetes',
    score: 79,
    status: '返答待ち',
    grossProfitRate: 11.1,
    costPrice: 630000,
    sellPrice: 700000,
    to: 'engineer@tech-h.co.jp',
    subject: '【ご提案】Goエンジニア ご紹介の件',
    isAutoSend: true,
  },
]

export const currentProposal = proposalQueue[0]
