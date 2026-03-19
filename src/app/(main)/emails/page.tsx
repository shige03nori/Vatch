'use client';

import { useState, useEffect } from 'react';
import { Topbar } from '@/components/layout/Topbar';

type EmailStatus = 'PENDING' | 'PARSING' | 'PARSED' | 'ERROR';

type EmailItem = {
  id: string;
  receivedAt: string;
  from: string;
  subject: string;
  type: 'CASE' | 'TALENT' | 'UNKNOWN';
  status: EmailStatus;
  skills: string[];
  extractedName: string | null;
  confidence: number | null;
};

type FilterTab = 'all' | 'case' | 'talent' | 'error';

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: 'all',    label: '全て'   },
  { key: 'case',   label: '案件'   },
  { key: 'talent', label: '人材'   },
  { key: 'error',  label: 'エラー' },
];

function StatusBadge({ status }: { status: EmailStatus }) {
  switch (status) {
    case 'PARSED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-vatch-green/10 text-vatch-green border border-vatch-green/30">
          完了
        </span>
      );
    case 'PARSING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-vatch-amber/10 text-vatch-amber border border-vatch-amber/30 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-vatch-amber" />
          解析中
        </span>
      );
    case 'ERROR':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-vatch-red/10 text-vatch-red border border-vatch-red/30">
          エラー
        </span>
      );
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-vatch-muted/10 text-vatch-muted border border-vatch-muted/30">
          待機中
        </span>
      );
  }
}

function TypeBadge({ type }: { type: EmailItem['type'] }) {
  if (type === 'CASE') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-vatch-cyan/10 text-vatch-cyan border border-vatch-cyan/30">
        案件
      </span>
    );
  }
  if (type === 'TALENT') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-vatch-purple/10 text-vatch-purple border border-vatch-purple/30">
        人材
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-vatch-muted/10 text-vatch-muted border border-vatch-muted/30">
      不明
    </span>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const color =
    confidence >= 85 ? 'bg-vatch-green' :
    confidence >= 65 ? 'bg-vatch-amber' :
    'bg-vatch-red';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-vatch-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${confidence}%` }}
        />
      </div>
      <span className="text-[11px] text-vatch-text-dim w-8 text-right">{confidence}%</span>
    </div>
  );
}

function EmailRow({ item, onDetail }: { item: EmailItem; onDetail: (id: string) => void }) {
  return (
    <tr className="border-b border-vatch-border hover:bg-vatch-surface/60 transition-colors">
      {/* 受信時刻 */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-[12px] text-vatch-muted font-mono">{item.receivedAt}</span>
      </td>

      {/* タイプ */}
      <td className="px-4 py-3 whitespace-nowrap">
        <TypeBadge type={item.type} />
      </td>

      {/* 送信元 */}
      <td className="px-4 py-3">
        <span className="text-[13px] text-vatch-text-dim truncate max-w-[140px] block">{item.from}</span>
      </td>

      {/* 件名・抽出名 */}
      <td className="px-4 py-3 max-w-[240px]">
        <p className="text-[13px] text-vatch-text truncate">{item.subject}</p>
        {item.extractedName && (
          <p className="text-[11px] text-vatch-cyan mt-0.5 truncate">→ {item.extractedName}</p>
        )}
      </td>

      {/* ステータス */}
      <td className="px-4 py-3 whitespace-nowrap">
        <StatusBadge status={item.status} />
      </td>

      {/* スキルタグ */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {item.skills.length > 0 ? (
            item.skills.slice(0, 3).map((skill) => (
              <span
                key={skill}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-vatch-border-light/60 text-vatch-text-dim border border-vatch-border-light"
              >
                {skill}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-vatch-muted">—</span>
          )}
          {item.skills.length > 3 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] text-vatch-muted">
              +{item.skills.length - 3}
            </span>
          )}
        </div>
      </td>

      {/* AI信頼度 */}
      <td className="px-4 py-3 min-w-[120px]">
        {item.confidence !== null ? (
          <ConfidenceBar confidence={item.confidence} />
        ) : (
          <span className="text-[11px] text-vatch-muted">—</span>
        )}
      </td>

      {/* 詳細ボタン */}
      <td className="px-4 py-3 whitespace-nowrap">
        <button
          onClick={() => onDetail(item.id)}
          className="px-3 py-1 rounded text-[12px] font-medium text-vatch-cyan border border-vatch-cyan/40 hover:bg-vatch-cyan/10 transition-colors"
        >
          詳細
        </button>
      </td>
    </tr>
  );
}

export default function EmailsPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  async function loadEmails() {
    setLoading(true);
    try {
      const res = await fetch('/api/emails?limit=100');
      const json = await res.json();
      if (json.success) setEmails(json.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadEmails(); }, []);

  async function handleFetchNow() {
    setFetching(true);
    try {
      await fetch('/api/emails/fetch', { method: 'POST' });
      await loadEmails();
    } finally {
      setFetching(false);
    }
  }

  const filtered = emails.filter((email) => {
    if (activeTab === 'all')    return true;
    if (activeTab === 'error')  return email.status === 'ERROR';
    return email.type === activeTab.toUpperCase();
  });

  const counts = {
    all:    emails.length,
    case:   emails.filter((e) => e.type === 'CASE').length,
    talent: emails.filter((e) => e.type === 'TALENT').length,
    error:  emails.filter((e) => e.status === 'ERROR').length,
  };

  function handleDetail(id: string) {
    alert(`詳細: メールID ${id}`);
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-vatch-bg">
      <Topbar title="メール取込" />

      <main className="flex-1 p-6 flex flex-col gap-4">
        {/* ヘッダーアクション */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-vatch-text-dim">
              直近のメール取込結果 — <span className="text-vatch-text-bright">{emails.length}件</span>
            </p>
          </div>
          <button
            onClick={handleFetchNow}
            disabled={fetching}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-vatch-cyan text-vatch-bg font-semibold text-sm hover:bg-vatch-cyan/90 transition-colors disabled:opacity-60"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {fetching ? '取込中...' : '今すぐ取込'}
          </button>
        </div>

        {/* フィルタータブ */}
        <div className="flex items-center gap-1 p-1 bg-vatch-surface border border-vatch-border rounded-lg w-fit">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-vatch-cyan text-vatch-bg'
                  : 'text-vatch-text-dim hover:text-vatch-text'
              }`}
            >
              {tab.label}
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === tab.key
                  ? 'bg-vatch-bg/20 text-vatch-bg'
                  : 'bg-vatch-border text-vatch-muted'
              }`}>
                {counts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        {/* テーブル */}
        <div className="flex-1 bg-vatch-surface border border-vatch-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-vatch-border bg-vatch-bg/40">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-vatch-muted uppercase tracking-wider">受信</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-vatch-muted uppercase tracking-wider">種別</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-vatch-muted uppercase tracking-wider">送信元</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-vatch-muted uppercase tracking-wider">件名 / 抽出名</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-vatch-muted uppercase tracking-wider">ステータス</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-vatch-muted uppercase tracking-wider">スキル</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-vatch-muted uppercase tracking-wider">AI信頼度</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-vatch-muted uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="flex items-center justify-center py-16 text-vatch-muted text-sm">
                        読み込み中...
                      </div>
                    </td>
                  </tr>
                ) : filtered.length > 0 ? (
                  filtered.map((item) => (
                    <EmailRow key={item.id} item={item} onDetail={handleDetail} />
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-vatch-muted text-sm">
                      該当するメールがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* フッター */}
          <div className="px-4 py-3 border-t border-vatch-border flex items-center justify-between">
            <span className="text-[12px] text-vatch-muted">{filtered.length} 件表示</span>
            <div className="flex items-center gap-3 text-[11px] text-vatch-muted">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-vatch-green" /> 完了: {emails.filter(e => e.status === 'PARSED').length}件
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-vatch-amber" /> 解析中: {emails.filter(e => e.status === 'PARSING').length}件
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-vatch-red" /> エラー: {emails.filter(e => e.status === 'ERROR').length}件
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-vatch-muted" /> 待機: {emails.filter(e => e.status === 'PENDING').length}件
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
