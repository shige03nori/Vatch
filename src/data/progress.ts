export interface PipelineStage {
  label: string;
  count: number;
  amount: number; // 見込み金額（万円）
  color: string;
}

export interface MonthlyData {
  month: string; // "1月", "2月", ...
  proposals: number;
  contracts: number;
  grossProfit: number; // 万円
}

export interface SalesRep {
  name: string;
  proposals: number;
  contracts: number;
  grossProfit: number;
  winRate: number; // %
}

export const pipelineStages: PipelineStage[] = [
  { label: '面談調整中', count: 4,  amount: 240,  color: '#a78bfa' },
  { label: '提案中',     count: 9,  amount: 680,  color: '#38bdf8' },
  { label: '返答待ち',   count: 6,  amount: 510,  color: '#f59e0b' },
  { label: '稼働中',     count: 15, amount: 1200, color: '#4ade80' },
]

export const monthlyData: MonthlyData[] = [
  { month: '10月', proposals: 18, contracts: 7,  grossProfit: 210 },
  { month: '11月', proposals: 21, contracts: 9,  grossProfit: 275 },
  { month: '12月', proposals: 16, contracts: 6,  grossProfit: 190 },
  { month: '1月',  proposals: 24, contracts: 11, grossProfit: 330 },
  { month: '2月',  proposals: 19, contracts: 8,  grossProfit: 248 },
  { month: '3月',  proposals: 27, contracts: 12, grossProfit: 375 },
]

export const salesReps: SalesRep[] = [
  { name: '山田 T.',  proposals: 12, contracts: 6,  grossProfit: 185, winRate: 50.0 },
  { name: '鈴木 A.',  proposals: 8,  contracts: 3,  grossProfit: 92,  winRate: 37.5 },
  { name: '田中 K.',  proposals: 4,  contracts: 2,  grossProfit: 68,  winRate: 50.0 },
  { name: '佐藤 M.',  proposals: 3,  contracts: 1,  grossProfit: 30,  winRate: 33.3 },
]
