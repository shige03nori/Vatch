'use client';

import { useState, useMemo } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { cases, CaseItem, CaseStatus } from '@/data/cases';

// ---- ステータス設定 ----
const STATUS_CONFIG: Record<
  CaseStatus,
  { label: string; color: string; bg: string }
> = {
  open:        { label: '募集中',   color: 'text-[#38bdf8]', bg: 'bg-[#38bdf8]/10' },
  matching:    { label: 'マッチング中', color: 'text-[#a78bfa]', bg: 'bg-[#a78bfa]/10' },
  proposing:   { label: '提案中',   color: 'text-[#60a5fa]', bg: 'bg-[#60a5fa]/10' },
  interviewing:{ label: '面談中',   color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
  contracted:  { label: '契約済み', color: 'text-[#4ade80]', bg: 'bg-[#4ade80]/10' },
  closed:      { label: 'クローズ', color: 'text-[#64748b]', bg: 'bg-[#64748b]/10' },
};

// ---- 勤務形式設定 ----
const WORK_STYLE_CONFIG = {
  remote:  { label: 'リモート', color: 'text-[#38bdf8]', bg: 'bg-[#38bdf8]/10' },
  onsite:  { label: '常駐',     color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
  hybrid:  { label: 'ハイブリッド', color: 'text-[#a78bfa]', bg: 'bg-[#a78bfa]/10' },
};

// ---- サマリーカード ----
const SUMMARY_STATUSES: CaseStatus[] = ['open', 'matching', 'proposing', 'interviewing', 'contracted'];

function SummaryCards({ items }: { items: CaseItem[] }) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) {
      map[item.status] = (map[item.status] ?? 0) + 1;
    }
    return map;
  }, [items]);

  const totalCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of cases) {
      map[item.status] = (map[item.status] ?? 0) + 1;
    }
    return map;
  }, []);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      {SUMMARY_STATUSES.map((status) => {
        const cfg = STATUS_CONFIG[status];
        return (
          <div
            key={status}
            className="bg-vatch-surface border border-vatch-border rounded-lg p-4"
          >
            <div className={`text-xs font-medium mb-2 ${cfg.color}`}>{cfg.label}</div>
            <div className="text-2xl font-bold text-white">
              {totalCounts[status] ?? 0}
            </div>
            <div className="text-xs text-vatch-muted mt-1">件</div>
          </div>
        );
      })}
    </div>
  );
}

// ---- 全スキル抽出 ----
const ALL_SKILLS = Array.from(
  new Set(cases.flatMap((c) => c.skills))
).sort();

// ---- メインページ ----
export default function CasesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all'>('all');
  const [skillFilter, setSkillFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return cases.filter((item) => {
      const matchSearch =
        search === '' ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.client.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === 'all' || item.status === statusFilter;
      const matchSkill =
        skillFilter === 'all' || item.skills.includes(skillFilter);
      return matchSearch && matchStatus && matchSkill;
    });
  }, [search, statusFilter, skillFilter]);

  return (
    <div className="flex flex-col h-full bg-vatch-bg">
      <Topbar title="案件管理" />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">

        {/* サマリーカード */}
        <SummaryCards items={filtered} />

        {/* 検索・フィルター */}
        <div className="flex flex-wrap gap-3 mb-6">
          {/* 検索バー */}
          <div className="flex-1 min-w-[200px] relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vatch-muted"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <circle cx={11} cy={11} r={8} />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="案件名・クライアントで検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-vatch-surface border border-vatch-border rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-vatch-muted focus:outline-none focus:border-[#38bdf8] transition-colors"
            />
          </div>

          {/* ステータスフィルター */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CaseStatus | 'all')}
            className="bg-vatch-surface border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors cursor-pointer"
          >
            <option value="all">全ステータス</option>
            {(Object.keys(STATUS_CONFIG) as CaseStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>

          {/* スキルフィルター */}
          <select
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            className="bg-vatch-surface border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors cursor-pointer"
          >
            <option value="all">全スキル</option>
            {ALL_SKILLS.map((skill) => (
              <option key={skill} value={skill}>{skill}</option>
            ))}
          </select>

          {/* 件数表示 */}
          <div className="flex items-center text-sm text-vatch-muted">
            {filtered.length} 件表示
          </div>
        </div>

        {/* 案件テーブル */}
        <div className="bg-vatch-surface border border-vatch-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-vatch-border text-vatch-muted text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">案件名 / クライアント</th>
                  <th className="text-left px-4 py-3 font-medium">スキル</th>
                  <th className="text-right px-4 py-3 font-medium">単価</th>
                  <th className="text-left px-4 py-3 font-medium">開始時期</th>
                  <th className="text-left px-4 py-3 font-medium">勤務形式</th>
                  <th className="text-left px-4 py-3 font-medium">ステータス</th>
                  <th className="text-right px-4 py-3 font-medium">候補数</th>
                  <th className="text-center px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-vatch-muted">
                      該当する案件が見つかりません
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, index) => {
                    const statusCfg = STATUS_CONFIG[item.status];
                    const workCfg = WORK_STYLE_CONFIG[item.workStyle];
                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-vatch-border/50 hover:bg-white/[0.02] transition-colors ${
                          index === filtered.length - 1 ? 'border-b-0' : ''
                        }`}
                      >
                        {/* 案件名・クライアント */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{item.title}</div>
                          <div className="text-xs text-vatch-muted mt-0.5">{item.client}</div>
                        </td>

                        {/* スキルタグ */}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {item.skills.slice(0, 3).map((skill) => (
                              <span
                                key={skill}
                                className="px-1.5 py-0.5 bg-vatch-border/50 text-vatch-muted rounded text-xs"
                              >
                                {skill}
                              </span>
                            ))}
                            {item.skills.length > 3 && (
                              <span className="px-1.5 py-0.5 bg-vatch-border/50 text-vatch-muted rounded text-xs">
                                +{item.skills.length - 3}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 単価 */}
                        <td className="px-4 py-3 text-right">
                          <span className="text-white font-semibold">{item.unitPrice}</span>
                          <span className="text-vatch-muted text-xs ml-1">万円</span>
                        </td>

                        {/* 開始時期 */}
                        <td className="px-4 py-3 text-vatch-muted whitespace-nowrap">
                          {item.startDate.replace(/-/g, '/')}
                        </td>

                        {/* 勤務形式 */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${workCfg.color} ${workCfg.bg}`}
                          >
                            {workCfg.label}
                          </span>
                        </td>

                        {/* ステータス */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color} ${statusCfg.bg}`}
                          >
                            {statusCfg.label}
                          </span>
                        </td>

                        {/* マッチング候補数 */}
                        <td className="px-4 py-3 text-right">
                          {item.matchCount > 0 ? (
                            <span className="text-[#38bdf8] font-semibold">{item.matchCount}</span>
                          ) : (
                            <span className="text-vatch-muted">—</span>
                          )}
                        </td>

                        {/* 詳細ボタン */}
                        <td className="px-4 py-3 text-center">
                          <button className="px-3 py-1 text-xs border border-vatch-border rounded hover:border-[#38bdf8] hover:text-[#38bdf8] text-vatch-muted transition-colors">
                            詳細
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}
