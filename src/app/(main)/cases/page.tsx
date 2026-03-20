'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Modal } from '@/components/ui/Modal';

type CaseStatus = 'OPEN' | 'MATCHING' | 'PROPOSING' | 'INTERVIEWING' | 'CONTRACTED' | 'CLOSED';
type WorkStyle = 'REMOTE' | 'ONSITE' | 'HYBRID';

type CaseItem = {
  id: string;
  title: string;
  client: string;
  clientEmail: string | null;
  skills: string[];
  unitPrice: number;
  startDate: string;
  workStyle: WorkStyle;
  status: CaseStatus;
  createdAt: string;
};

type EditCaseForm = {
  title: string
  client: string
  clientEmail: string
  unitPrice: number
  startDate: string   // YYYY-MM-DD
  workStyle: WorkStyle
  status: CaseStatus
}

function toEditCaseForm(c: CaseItem): EditCaseForm {
  return {
    title: c.title,
    client: c.client,
    clientEmail: c.clientEmail ?? '',
    unitPrice: c.unitPrice,
    startDate: c.startDate.slice(0, 10),
    workStyle: c.workStyle,
    status: c.status,
  }
}

const STATUS_CONFIG: Record<CaseStatus, { label: string; color: string; bg: string }> = {
  OPEN:         { label: '募集中',      color: 'text-[#38bdf8]', bg: 'bg-[#38bdf8]/10' },
  MATCHING:     { label: 'マッチング中', color: 'text-[#a78bfa]', bg: 'bg-[#a78bfa]/10' },
  PROPOSING:    { label: '提案中',      color: 'text-[#60a5fa]', bg: 'bg-[#60a5fa]/10' },
  INTERVIEWING: { label: '面談中',      color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
  CONTRACTED:   { label: '契約済み',    color: 'text-[#4ade80]', bg: 'bg-[#4ade80]/10' },
  CLOSED:       { label: 'クローズ',    color: 'text-[#64748b]', bg: 'bg-[#64748b]/10' },
};

const WORK_STYLE_CONFIG: Record<WorkStyle, { label: string; color: string; bg: string }> = {
  REMOTE: { label: 'リモート',      color: 'text-[#38bdf8]', bg: 'bg-[#38bdf8]/10' },
  ONSITE: { label: '常駐',          color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
  HYBRID: { label: 'ハイブリッド',  color: 'text-[#a78bfa]', bg: 'bg-[#a78bfa]/10' },
};

const SUMMARY_STATUSES: CaseStatus[] = ['OPEN', 'MATCHING', 'PROPOSING', 'INTERVIEWING', 'CONTRACTED'];

function SummaryCards({ items }: { items: CaseItem[] }) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) {
      map[item.status] = (map[item.status] ?? 0) + 1;
    }
    return map;
  }, [items]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      {SUMMARY_STATUSES.map((status) => {
        const cfg = STATUS_CONFIG[status];
        return (
          <div key={status} className="bg-vatch-surface border border-vatch-border rounded-lg p-4">
            <div className={`text-xs font-medium mb-2 ${cfg.color}`}>{cfg.label}</div>
            <div className="text-2xl font-bold text-white">{counts[status] ?? 0}</div>
            <div className="text-xs text-vatch-muted mt-1">件</div>
          </div>
        );
      })}
    </div>
  );
}

export default function CasesPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all'>('all');
  const [skillFilter, setSkillFilter] = useState<string>('all');
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<EditCaseForm>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/cases?limit=200')
      .then((r) => r.json())
      .then((json) => { if (json.success) setCases(json.data); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedCase) return
    setEditing(false)
    setSaveError(null)
    setEditForm(toEditCaseForm(selectedCase))
  }, [selectedCase])

  const closeModal = useCallback(() => {
    setSelectedCase(null)
    setEditing(false)
    setSaveError(null)
  }, [])

  async function handleSave() {
    if (!selectedCase) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/cases/${selectedCase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          startDate: new Date(editForm.startDate!).toISOString(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? '保存に失敗しました')
      const updated: CaseItem = json.data
      setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setSelectedCase(updated)
      setEditing(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const allSkills = useMemo(
    () => Array.from(new Set(cases.flatMap((c) => c.skills))).sort(),
    [cases]
  );

  const filtered = useMemo(() => {
    return cases.filter((item) => {
      const matchSearch =
        search === '' ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.client.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchSkill = skillFilter === 'all' || item.skills.includes(skillFilter);
      return matchSearch && matchStatus && matchSkill;
    });
  }, [cases, search, statusFilter, skillFilter]);

  return (
    <div className="flex flex-col h-full bg-vatch-bg">
      <Topbar title="案件管理" />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">

          <SummaryCards items={cases} />

          {/* 検索・フィルター */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex-1 min-w-[200px] relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vatch-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
            <select
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              className="bg-vatch-surface border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors cursor-pointer"
            >
              <option value="all">全スキル</option>
              {allSkills.map((skill) => (
                <option key={skill} value={skill}>{skill}</option>
              ))}
            </select>
            <div className="flex items-center text-sm text-vatch-muted">
              {loading ? '読み込み中...' : `${filtered.length} 件表示`}
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
                    <th className="text-center px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-vatch-muted">読み込み中...</td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-vatch-muted">該当する案件が見つかりません</td>
                    </tr>
                  ) : (
                    filtered.map((item, index) => {
                      const statusCfg = STATUS_CONFIG[item.status];
                      const workCfg = WORK_STYLE_CONFIG[item.workStyle];
                      const startDate = new Date(item.startDate).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-vatch-border/50 hover:bg-white/[0.02] transition-colors ${index === filtered.length - 1 ? 'border-b-0' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-white">{item.title}</div>
                            <div className="text-xs text-vatch-muted mt-0.5">{item.client}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1 max-w-[220px]">
                              {item.skills.slice(0, 3).map((skill) => (
                                <span key={skill} className="px-1.5 py-0.5 bg-vatch-border/50 text-vatch-muted rounded text-xs">{skill}</span>
                              ))}
                              {item.skills.length > 3 && (
                                <span className="px-1.5 py-0.5 bg-vatch-border/50 text-vatch-muted rounded text-xs">+{item.skills.length - 3}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-white font-semibold">{item.unitPrice}</span>
                            <span className="text-vatch-muted text-xs ml-1">万円</span>
                          </td>
                          <td className="px-4 py-3 text-vatch-muted whitespace-nowrap">{startDate}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${workCfg.color} ${workCfg.bg}`}>
                              {workCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color} ${statusCfg.bg}`}>
                              {statusCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              className="px-3 py-1 text-xs border border-vatch-border rounded hover:border-[#38bdf8] hover:text-[#38bdf8] text-vatch-muted transition-colors"
                              onClick={() => setSelectedCase(item)}
                            >
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

        <Modal open={selectedCase !== null} onClose={closeModal}>
        <div className="bg-vatch-surface border border-vatch-border rounded-xl shadow-2xl overflow-hidden">
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-vatch-border">
            <h2 id="modal-title" className="text-base font-bold text-white truncate pr-4">
              {selectedCase?.title}
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              {editing ? (
                <>
                  <button
                    onClick={() => { setEditing(false); setSaveError(null); setEditForm(toEditCaseForm(selectedCase!)) }}
                    className="px-3 py-1.5 text-xs border border-vatch-border text-vatch-muted rounded-lg hover:border-[#38bdf8] hover:text-[#38bdf8] transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs bg-[#38bdf8] text-black font-semibold rounded-lg disabled:opacity-50"
                  >
                    {saving ? '保存中...' : '保存'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="px-3 py-1.5 text-xs border border-vatch-border text-vatch-muted rounded-lg hover:border-[#38bdf8] hover:text-[#38bdf8] transition-colors"
                >
                  ✏ 編集
                </button>
              )}
              <button
                onClick={closeModal}
                className="text-vatch-muted hover:text-white transition-colors text-lg leading-none"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>
          </div>

          {/* ボディ */}
          <div className="px-5 py-4 space-y-4">
            {editing ? (
              /* 編集フォーム */
              <div className="grid grid-cols-2 gap-4">
                {/* title */}
                <div className="col-span-2">
                  <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">案件名</label>
                  <input
                    type="text"
                    value={editForm.title ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors"
                  />
                </div>
                {/* client */}
                <div>
                  <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">クライアント</label>
                  <input
                    type="text"
                    value={editForm.client ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, client: e.target.value }))}
                    className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors"
                  />
                </div>
                {/* clientEmail */}
                <div>
                  <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">クライアントメール</label>
                  <input
                    type="email"
                    value={editForm.clientEmail ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, clientEmail: e.target.value }))}
                    className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors"
                  />
                </div>
                {/* unitPrice */}
                <div>
                  <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">単価（万円）</label>
                  <input
                    type="number"
                    min={1}
                    value={editForm.unitPrice ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, unitPrice: Number(e.target.value) }))}
                    className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors"
                  />
                </div>
                {/* startDate */}
                <div>
                  <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">開始時期</label>
                  <input
                    type="date"
                    value={editForm.startDate ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors"
                  />
                </div>
                {/* workStyle */}
                <div>
                  <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">勤務形式</label>
                  <select
                    value={editForm.workStyle ?? 'REMOTE'}
                    onChange={(e) => setEditForm((f) => ({ ...f, workStyle: e.target.value as WorkStyle }))}
                    className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors cursor-pointer"
                  >
                    {(Object.keys(WORK_STYLE_CONFIG) as WorkStyle[]).map((w) => (
                      <option key={w} value={w}>{WORK_STYLE_CONFIG[w].label}</option>
                    ))}
                  </select>
                </div>
                {/* status */}
                <div>
                  <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">ステータス</label>
                  <select
                    value={editForm.status ?? 'OPEN'}
                    onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as CaseStatus }))}
                    className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors cursor-pointer"
                  >
                    {(Object.keys(STATUS_CONFIG) as CaseStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                    ))}
                  </select>
                </div>
                {/* error */}
                {saveError && <p className="col-span-2 text-red-400 text-xs">{saveError}</p>}
              </div>
            ) : (
              /* 表示モード */
              selectedCase && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">クライアント</div>
                    <div className="text-sm text-white">{selectedCase.client}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">クライアントメール</div>
                    <div className="text-sm text-white">{selectedCase.clientEmail ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">単価</div>
                    <div className="text-sm text-white">{selectedCase.unitPrice}万円</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">開始時期</div>
                    <div className="text-sm text-white">
                      {new Date(selectedCase.startDate).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">勤務形式</div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${WORK_STYLE_CONFIG[selectedCase.workStyle].color} ${WORK_STYLE_CONFIG[selectedCase.workStyle].bg}`}>
                      {WORK_STYLE_CONFIG[selectedCase.workStyle].label}
                    </span>
                  </div>
                  <div>
                    <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">ステータス</div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[selectedCase.status].color} ${STATUS_CONFIG[selectedCase.status].bg}`}>
                      {STATUS_CONFIG[selectedCase.status].label}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">スキル</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedCase.skills.map((s) => (
                        <span key={s} className="px-2 py-0.5 bg-vatch-border/50 text-vatch-muted rounded text-xs">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">登録日時</div>
                    <div className="text-sm text-vatch-muted">
                      {new Date(selectedCase.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </Modal>
      </main>
    </div>
  );
}
