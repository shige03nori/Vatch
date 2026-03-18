export type ContractStatus = 'active' | 'ending_soon' | 'ended' | 'renewal_pending';

export interface ContractItem {
  id: string;
  talentName: string;
  caseName: string;
  client: string;
  startDate: string;        // "2026-01-01"
  endDate: string;          // "2026-06-30"
  unitPrice: number;        // 売値（万円/月）
  costPrice: number;        // 仕入値（万円/月）
  grossProfitRate: number;  // 粗利率%
  status: ContractStatus;
}

export interface MonthlySummary {
  month: string;
  revenue: number;      // 売上（万円）
  cost: number;         // 原価（万円）
  grossProfit: number;  // 粗利（万円）
}

export const contracts: ContractItem[] = [
  {
    id: '1',
    talentName: '田中 K.',
    caseName: '金融系基幹システム開発',
    client: 'ABC商事',
    startDate: '2025-10-01',
    endDate: '2026-03-31',
    unitPrice: 80,
    costPrice: 65,
    grossProfitRate: 18.75,
    status: 'ending_soon',
  },
  {
    id: '2',
    talentName: '佐藤 M.',
    caseName: 'ECサイトリニューアル',
    client: 'XYZ株式会社',
    startDate: '2026-01-01',
    endDate: '2026-06-30',
    unitPrice: 70,
    costPrice: 58,
    grossProfitRate: 17.14,
    status: 'active',
  },
  {
    id: '3',
    talentName: '鈴木 R.',
    caseName: '製造業DXプロジェクト',
    client: '製造A社',
    startDate: '2025-07-01',
    endDate: '2026-06-30',
    unitPrice: 90,
    costPrice: 82,
    grossProfitRate: 8.89,
    status: 'active',
  },
  {
    id: '4',
    talentName: '高橋 S.',
    caseName: 'インフラ基盤構築',
    client: 'インフラB社',
    startDate: '2026-02-01',
    endDate: '2026-07-31',
    unitPrice: 75,
    costPrice: 62,
    grossProfitRate: 17.33,
    status: 'active',
  },
  {
    id: '5',
    talentName: '伊藤 Y.',
    caseName: 'クラウド移行支援',
    client: 'クラウドC株式会社',
    startDate: '2025-04-01',
    endDate: '2025-12-31',
    unitPrice: 85,
    costPrice: 70,
    grossProfitRate: 17.65,
    status: 'ended',
  },
  {
    id: '6',
    talentName: '渡辺 T.',
    caseName: 'データ分析基盤整備',
    client: 'データD社',
    startDate: '2025-09-01',
    endDate: '2026-02-28',
    unitPrice: 95,
    costPrice: 78,
    grossProfitRate: 17.89,
    status: 'ended',
  },
  {
    id: '7',
    talentName: '中村 A.',
    caseName: 'モバイルアプリ開発',
    client: 'モバイルE株式会社',
    startDate: '2026-01-15',
    endDate: '2026-09-30',
    unitPrice: 68,
    costPrice: 60,
    grossProfitRate: 11.76,
    status: 'active',
  },
  {
    id: '8',
    talentName: '小林 H.',
    caseName: 'セキュリティ診断・対策',
    client: 'セキュリティF社',
    startDate: '2025-11-01',
    endDate: '2026-04-30',
    unitPrice: 100,
    costPrice: 85,
    grossProfitRate: 15.0,
    status: 'renewal_pending',
  },
  {
    id: '9',
    talentName: '加藤 N.',
    caseName: 'ERPシステム導入支援',
    client: 'ERPコンサルG',
    startDate: '2025-12-01',
    endDate: '2026-03-15',
    unitPrice: 72,
    costPrice: 66,
    grossProfitRate: 8.33,
    status: 'ending_soon',
  },
  {
    id: '10',
    talentName: '吉田 K.',
    caseName: 'Webサービス運用保守',
    client: 'ウェブH株式会社',
    startDate: '2025-06-01',
    endDate: '2026-05-31',
    unitPrice: 60,
    costPrice: 52,
    grossProfitRate: 13.33,
    status: 'renewal_pending',
  },
  {
    id: '11',
    talentName: '山田 R.',
    caseName: 'AIチャットボット開発',
    client: 'AIベンチャーI社',
    startDate: '2026-03-01',
    endDate: '2026-08-31',
    unitPrice: 110,
    costPrice: 92,
    grossProfitRate: 16.36,
    status: 'active',
  },
  {
    id: '12',
    talentName: '松本 S.',
    caseName: '業務自動化RPA導入',
    client: 'RPAソリューションJ',
    startDate: '2026-02-15',
    endDate: '2026-08-14',
    unitPrice: 65,
    costPrice: 59,
    grossProfitRate: 9.23,
    status: 'active',
  },
];

export const monthlySummary: MonthlySummary[] = [
  {
    month: '2025-10',
    revenue: 720,
    cost: 596,
    grossProfit: 124,
  },
  {
    month: '2025-11',
    revenue: 745,
    cost: 614,
    grossProfit: 131,
  },
  {
    month: '2025-12',
    revenue: 760,
    cost: 628,
    grossProfit: 132,
  },
  {
    month: '2026-01',
    revenue: 795,
    cost: 652,
    grossProfit: 143,
  },
  {
    month: '2026-02',
    revenue: 820,
    cost: 671,
    grossProfit: 149,
  },
  {
    month: '2026-03',
    revenue: 855,
    cost: 698,
    grossProfit: 157,
  },
];
