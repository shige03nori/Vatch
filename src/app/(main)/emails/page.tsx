'use client';

import { useState, useEffect, useCallback } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Modal } from '@/components/ui/Modal';
import Link from 'next/link';

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

type EmailDetail = EmailItem & {
  fromEmail: string
  bodyText: string
  cases:   { id: string; title: string }[]
  talents: { id: string; name: string }[]
  createdAt: string
}

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

function EmailRow({ item, onDetail, detailLoading }: { item: EmailItem; onDetail: (id: string) => void; detailLoading: boolean }) {
  return (
    <tr className="border-b border-vatch-border hover:bg-vatch-surface/60 transition-colors">
      {/* 受信時刻 */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-[12px] text-vatch-muted font-mono">
          {new Date(item.receivedAt).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </span>
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
          disabled={detailLoading}
          className="px-3 py-1 rounded text-[12px] font-medium text-vatch-cyan border border-vatch-cyan/40 hover:bg-vatch-cyan/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
  const [retrying, setRetrying] = useState(false);
  const [retryTotal, setRetryTotal] = useState(0);

  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null)
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)

  const closeModal = useCallback(() => {
    setSelectedEmail(null)
    setDetailError(null)
  }, [])

  async function loadEmails(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/emails?limit=100');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) setEmails(json.data);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { loadEmails(); }, []);

  // 再解析中は2秒ごとにサイレントリフレッシュ
  useEffect(() => {
    if (!retrying) return;
    const id = setInterval(() => { loadEmails(true); }, 2000);
    return () => clearInterval(id);
  }, [retrying]);

  async function handleFetchNow() {
    setFetching(true);
    try {
      const res = await fetch('/api/emails/fetch', { method: 'POST' });
      if (!res.ok) {
        alert('メール取込に失敗しました。管理者権限が必要です。');
        return;
      }
      await loadEmails();
    } finally {
      setFetching(false);
    }
  }

  async function handleRetry() {
    const errorCount = emails.filter((e) => e.status === 'ERROR').length;
    if (errorCount === 0) {
      alert('再解析対象のエラーメールはありません。');
      return;
    }
    setRetryTotal(errorCount);
    setRetrying(true);
    try {
      const res = await fetch('/api/emails/retry', { method: 'POST' });
      if (!res.ok) {
        alert('再解析に失敗しました。管理者権限が必要です。');
        return;
      }
      await loadEmails();
    } finally {
      setRetrying(false);
      setRetryTotal(0);
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

  async function handleDetail(id: string) {
    setDetailLoadingId(id)
    setDetailError(null)
    try {
      const res = await fetch(`/api/emails/${id}`)
      let json: { data?: EmailDetail; error?: { message?: string } } = {}
      try { json = await res.json() } catch { /* non-JSON body */ }
      if (!res.ok) throw new Error(json.error?.message ?? '詳細の取得に失敗しました')
      setSelectedEmail(json.data as EmailDetail)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : '詳細の取得に失敗しました')
    } finally {
      setDetailLoadingId(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-vatch-bg">
      <Topbar title="メール取込" />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 flex flex-col gap-4">
        {/* ヘッダーアクション */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-[13px] text-vatch-text-dim">
              直近のメール取込結果 — <span className="text-vatch-text-bright">{emails.length}件</span>
            </p>
            {retrying && retryTotal > 0 && (() => {
              const parsedCount = retryTotal - emails.filter((e) => e.status === 'ERROR' || e.status === 'PARSING').length;
              const progress = Math.max(0, Math.min(100, Math.round((parsedCount / retryTotal) * 100)));
              return (
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-40 h-1.5 bg-vatch-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-vatch-amber rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-vatch-amber font-medium">
                    {parsedCount} / {retryTotal} 件完了
                  </span>
                </div>
              );
            })()}
          </div>
          <div className="flex items-center gap-2">
            {(retrying || emails.filter((e) => e.status === 'ERROR').length > 0) && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-vatch-red/10 text-vatch-red border border-vatch-red/40 font-semibold text-sm hover:bg-vatch-red/20 transition-colors disabled:opacity-60"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                {retrying ? '再解析中...' : `エラー再解析 (${emails.filter((e) => e.status === 'ERROR').length}件)`}
              </button>
            )}
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

        {detailError && (
          <p className="text-red-400 text-xs">{detailError}</p>
        )}

        {/* テーブル */}
        <div className="bg-vatch-surface border border-vatch-border rounded-xl overflow-hidden">
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
                    <EmailRow key={item.id} item={item} onDetail={handleDetail} detailLoading={detailLoadingId === item.id} />
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
        </div>

        <Modal open={selectedEmail !== null} onClose={closeModal} panelClassName="max-w-2xl">
          <div className="bg-vatch-surface border border-vatch-border rounded-xl shadow-2xl overflow-hidden">
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-vatch-border">
              <h2 id="modal-title" className="text-base font-bold text-white truncate pr-4">
                {selectedEmail?.subject}
              </h2>
              <button
                onClick={closeModal}
                className="text-vatch-muted hover:text-white transition-colors text-lg leading-none"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

            {/* ボディ */}
            {selectedEmail && (
              <div className="px-5 py-4 space-y-4 max-h-[80vh] overflow-y-auto">

                {/* セクション1: メール情報 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">差出人</div>
                    <div className="text-sm text-white">{selectedEmail.from}</div>
                    <div className="text-xs text-vatch-muted mt-0.5">{selectedEmail.fromEmail}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">受信日時</div>
                    <div className="text-sm text-white">
                      {new Date(selectedEmail.receivedAt).toLocaleString('ja-JP')}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">種別</div>
                    <TypeBadge type={selectedEmail.type} />
                  </div>
                  <div>
                    <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">ステータス</div>
                    <StatusBadge status={selectedEmail.status} />
                  </div>
                  <div>
                    <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">AI信頼度</div>
                    {selectedEmail.confidence !== null ? (
                      <ConfidenceBar confidence={selectedEmail.confidence} />
                    ) : (
                      <span className="text-sm text-vatch-muted">—</span>
                    )}
                  </div>
                </div>

                {/* セクション2: AI解析結果 */}
                <div className="border-t border-vatch-border pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">抽出名</div>
                      <div className="text-sm text-white">{selectedEmail.extractedName ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">スキル</div>
                      {selectedEmail.skills.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {selectedEmail.skills.map((s) => (
                            <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-vatch-border-light/60 text-vatch-text-dim border border-vatch-border-light">
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-vatch-muted">—</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* セクション3: メール本文 */}
                <div className="border-t border-vatch-border pt-4">
                  <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-2">メール本文</div>
                  <pre className="whitespace-pre-wrap text-xs text-vatch-muted font-mono bg-vatch-bg rounded-lg p-3 max-h-60 overflow-y-auto border border-vatch-border">
                    {selectedEmail.bodyText || '（本文なし）'}
                  </pre>
                </div>

                {/* セクション4: 関連する案件/人材 */}
                <div className="border-t border-vatch-border pt-4 space-y-3">
                  <div className="text-[10px] text-vatch-muted uppercase tracking-wide">関連する案件 / 人材</div>
                  {selectedEmail.cases.length === 0 && selectedEmail.talents.length === 0 ? (
                    <p className="text-sm text-vatch-muted">関連する案件・人材はありません</p>
                  ) : (
                    <>
                      {selectedEmail.cases.length > 0 && (
                        <div>
                          <div className="text-[10px] text-vatch-muted mb-1">案件</div>
                          {selectedEmail.cases.map((c) => (
                            <Link key={c.id} href="/cases" className="block text-sm text-vatch-cyan hover:underline">
                              {c.title}
                            </Link>
                          ))}
                        </div>
                      )}
                      {selectedEmail.talents.length > 0 && (
                        <div>
                          <div className="text-[10px] text-vatch-muted mb-1">人材</div>
                          {selectedEmail.talents.map((t) => (
                            <Link key={t.id} href="/talents" className="block text-sm text-[#a78bfa] hover:underline">
                              {t.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

              </div>
            )}
          </div>
        </Modal>
      </main>
    </div>
  );
}
