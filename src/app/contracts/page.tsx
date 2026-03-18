'use client';

import { useMemo } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { contracts, monthlySummary, ContractStatus } from '@/data/contracts';

// ---- ステータス設定 ----
const STATUS_CONFIG: Record<
  ContractStatus,
  { label: string; color: string; bg: string }
> = {
  active:          { label: '稼働中',   color: 'text-[#4ade80]', bg: 'bg-[#4ade80]/10' },
  ending_soon:     { label: '終了間近', color: 'text-[#f87171]', bg: 'bg-[#f87171]/10' },
  ended:           { label: '終了',     color: 'text-[#64748b]', bg: 'bg-[#64748b]/10' },
  renewal_pending: { label: '更新検討中', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
};

// ---- 残り日数計算 ----
function calcDaysLeft(endDate: string): number {
  const today = new Date('2026-03-18'); // currentDate
  const end = new Date(endDate);
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

// ---- 月表示フォーマット ----
function formatMonth(month: string): string {
  const [y, m] = month.split('-');
  return `${y}年${parseInt(m)}月`;
}

// ---- KPIカード ----
function KpiCard({
  label,
  value,
  unit,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  unit?: string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-vatch-surface border border-vatch-border rounded-lg p-4">
      <div className={`text-xs font-medium mb-2 ${color}`}>{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-white">{value}</span>
        {unit && <span className="text-xs text-vatch-muted">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-vatch-muted mt-1">{sub}</div>}
    </div>
  );
}

// ---- メインページ ----
export default function ContractsPage() {
  // KPI計算
  const kpi = useMemo(() => {
    const activeContracts = contracts.filter((c) => c.status === 'active');
    const activeCount = activeContracts.length;

    // 今月売上・粗利（稼働中 + 終了間近の3月分）
    const currentMonth = contracts.filter(
      (c) => c.status === 'active' || c.status === 'ending_soon'
    );
    const monthlyRevenue = currentMonth.reduce((sum, c) => sum + c.unitPrice, 0);
    const monthlyGrossProfit = currentMonth.reduce(
      (sum, c) => sum + (c.unitPrice - c.costPrice),
      0
    );

    // 平均粗利率（稼働中）
    const avgGrossRate =
      activeCount > 0
        ? activeContracts.reduce((sum, c) => sum + c.grossProfitRate, 0) / activeCount
        : 0;

    return { activeCount, monthlyRevenue, monthlyGrossProfit, avgGrossRate };
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-vatch-bg">
      <Topbar title="契約・売上" />
      <main className="flex-1 p-6">

        {/* KPIサマリー */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <KpiCard
            label="稼働中契約数"
            value={kpi.activeCount}
            unit="件"
            color="text-[#38bdf8]"
            sub="現在稼働中"
          />
          <KpiCard
            label="今月売上"
            value={kpi.monthlyRevenue.toLocaleString()}
            unit="万円"
            color="text-[#4ade80]"
            sub="稼働中 + 終了間近"
          />
          <KpiCard
            label="今月粗利"
            value={kpi.monthlyGrossProfit.toLocaleString()}
            unit="万円"
            color="text-[#4ade80]"
            sub={`粗利率 ${((kpi.monthlyGrossProfit / kpi.monthlyRevenue) * 100).toFixed(1)}%`}
          />
          <KpiCard
            label="平均粗利率"
            value={kpi.avgGrossRate.toFixed(1)}
            unit="%"
            color={kpi.avgGrossRate >= 10 ? 'text-[#4ade80]' : 'text-[#f59e0b]'}
            sub="稼働中契約の平均"
          />
        </div>

        {/* 月別売上サマリー */}
        <div className="bg-vatch-surface border border-vatch-border rounded-lg overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-vatch-border">
            <h2 className="text-sm font-semibold text-white">月別売上サマリー（直近6ヶ月）</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-vatch-border text-vatch-muted text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">月</th>
                  <th className="text-right px-4 py-3 font-medium">売上（万円）</th>
                  <th className="text-right px-4 py-3 font-medium">原価（万円）</th>
                  <th className="text-right px-4 py-3 font-medium">粗利（万円）</th>
                  <th className="text-right px-4 py-3 font-medium">粗利率</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummary.map((row, index) => {
                  const rate = ((row.grossProfit / row.revenue) * 100).toFixed(1);
                  const rateNum = parseFloat(rate);
                  return (
                    <tr
                      key={row.month}
                      className={`border-b border-vatch-border/50 hover:bg-white/[0.02] transition-colors ${
                        index === monthlySummary.length - 1 ? 'border-b-0' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-white font-medium">
                        {formatMonth(row.month)}
                      </td>
                      <td className="px-4 py-3 text-right text-white">
                        {row.revenue.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-vatch-muted">
                        {row.cost.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-[#4ade80] font-semibold">
                        {row.grossProfit.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={
                            rateNum >= 10 ? 'text-[#4ade80] font-semibold' : 'text-[#f59e0b] font-semibold'
                          }
                        >
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 契約一覧 */}
        <div className="bg-vatch-surface border border-vatch-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-vatch-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">契約一覧</h2>
            <span className="text-xs text-vatch-muted">{contracts.length} 件</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-vatch-border text-vatch-muted text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">人材 / 案件</th>
                  <th className="text-left px-4 py-3 font-medium">クライアント</th>
                  <th className="text-left px-4 py-3 font-medium">期間</th>
                  <th className="text-right px-4 py-3 font-medium">売値</th>
                  <th className="text-right px-4 py-3 font-medium">仕入値</th>
                  <th className="text-right px-4 py-3 font-medium">粗利率</th>
                  <th className="text-left px-4 py-3 font-medium">ステータス</th>
                  <th className="text-right px-4 py-3 font-medium">残日数</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((item, index) => {
                  const statusCfg = STATUS_CONFIG[item.status];
                  const daysLeft = calcDaysLeft(item.endDate);
                  const isLowMargin = item.grossProfitRate < 10;

                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-vatch-border/50 hover:bg-white/[0.02] transition-colors ${
                        index === contracts.length - 1 ? 'border-b-0' : ''
                      }`}
                    >
                      {/* 人材 / 案件 */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{item.talentName}</div>
                        <div className="text-xs text-vatch-muted mt-0.5">{item.caseName}</div>
                      </td>

                      {/* クライアント */}
                      <td className="px-4 py-3 text-vatch-muted whitespace-nowrap">
                        {item.client}
                      </td>

                      {/* 期間 */}
                      <td className="px-4 py-3 text-vatch-muted whitespace-nowrap text-xs">
                        <div>{item.startDate.replace(/-/g, '/')}</div>
                        <div className="mt-0.5">〜 {item.endDate.replace(/-/g, '/')}</div>
                      </td>

                      {/* 売値 */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-white font-semibold">{item.unitPrice}</span>
                        <span className="text-vatch-muted text-xs ml-1">万円</span>
                      </td>

                      {/* 仕入値 */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-vatch-muted">{item.costPrice}</span>
                        <span className="text-vatch-muted text-xs ml-1">万円</span>
                      </td>

                      {/* 粗利率 */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            isLowMargin ? 'text-[#f59e0b]' : 'text-[#4ade80]'
                          }`}
                        >
                          {item.grossProfitRate.toFixed(1)}%
                        </span>
                        {isLowMargin && (
                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-[#f59e0b] bg-[#f59e0b]/10">
                            要確認
                          </span>
                        )}
                      </td>

                      {/* ステータスバッジ */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color} ${statusCfg.bg}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* 残日数 */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {item.status === 'ended' ? (
                          <span className="text-vatch-muted text-xs">—</span>
                        ) : daysLeft <= 0 ? (
                          <span className="text-[#f87171] font-semibold text-xs">終了</span>
                        ) : (
                          <span
                            className={`font-semibold text-xs ${
                              item.status === 'ending_soon' || daysLeft <= 30
                                ? 'text-[#f87171]'
                                : 'text-vatch-muted'
                            }`}
                          >
                            {daysLeft}日
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
