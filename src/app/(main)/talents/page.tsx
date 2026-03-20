'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Modal } from '@/components/ui/Modal';

type TalentStatus = 'AVAILABLE' | 'ACTIVE' | 'NEGOTIATING' | 'ENDING_SOON' | 'INACTIVE';
type WorkStyle = 'REMOTE' | 'ONSITE' | 'HYBRID';

type TalentItem = {
  id: string;
  name: string;
  skills: string[];
  experience: number;
  desiredRate: number;
  location: string;
  workStyle: WorkStyle;
  status: TalentStatus;
  agencyEmail: string | null;
  createdAt: string;
};

type EditTalentForm = {
  name: string
  location: string
  experience: number
  desiredRate: number
  workStyle: WorkStyle
  status: TalentStatus
  agencyEmail: string
}

function toEditTalentForm(t: TalentItem): EditTalentForm {
  return {
    name: t.name,
    location: t.location,
    experience: t.experience,
    desiredRate: t.desiredRate,
    workStyle: t.workStyle,
    status: t.status,
    agencyEmail: t.agencyEmail ?? '',
  }
}

const STATUS_CONFIG: Record<TalentStatus, { label: string; color: string; bg: string }> = {
  AVAILABLE:   { label: '空き',     color: 'text-[#4ade80]', bg: 'bg-[#4ade80]/10' },
  ACTIVE:      { label: '稼働中',   color: 'text-[#38bdf8]', bg: 'bg-[#38bdf8]/10' },
  NEGOTIATING: { label: '交渉中',   color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
  ENDING_SOON: { label: '終了間近', color: 'text-[#f87171]', bg: 'bg-[#f87171]/10' },
  INACTIVE:    { label: '非活動',   color: 'text-[#64748b]', bg: 'bg-[#64748b]/10' },
};

const WORK_STYLE_CONFIG: Record<WorkStyle, { label: string; color: string; bg: string }> = {
  REMOTE: { label: 'リモート',     color: 'text-[#38bdf8]', bg: 'bg-[#38bdf8]/10' },
  ONSITE: { label: '常駐',         color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
  HYBRID: { label: 'ハイブリッド', color: 'text-[#a78bfa]', bg: 'bg-[#a78bfa]/10' },
};

const SUMMARY_STATUSES: TalentStatus[] = ['AVAILABLE', 'ACTIVE', 'NEGOTIATING', 'ENDING_SOON', 'INACTIVE'];

function SummaryCards({ items }: { items: TalentItem[] }) {
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
            <div className="text-xs text-vatch-muted mt-1">名</div>
          </div>
        );
      })}
    </div>
  );
}

export default function TalentsPage() {
  const [talents, setTalents] = useState<TalentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TalentStatus | 'all'>('all');
  const [skillFilter, setSkillFilter] = useState<string>('all');
  const [workStyleFilter, setWorkStyleFilter] = useState<WorkStyle | 'all'>('all');
  const [selectedTalent, setSelectedTalent] = useState<TalentItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<EditTalentForm>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/talents?limit=200')
      .then((r) => r.json())
      .then((json) => { if (json.success) setTalents(json.data); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTalent) return;
    setEditing(false);
    setSaveError(null);
    setEditForm(toEditTalentForm(selectedTalent));
  }, [selectedTalent]);

  const closeModal = useCallback(() => {
    setSelectedTalent(null);
    setEditing(false);
    setSaveError(null);
  }, []);

  async function handleSave() {
    if (!selectedTalent) return;
    setSaving(true);
    setSaveError(null);
    try {
      let json: { data?: TalentItem; error?: { message?: string } } = {};
      const res = await fetch(`/api/talents/${selectedTalent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      try { json = await res.json(); } catch { /* non-JSON body */ }
      if (!res.ok) throw new Error(json.error?.message ?? '保存に失敗しました');
      const updated: TalentItem = json.data!;
      setTalents((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setSelectedTalent(updated);
      // setEditing(false) is handled by the useEffect watching selectedTalent
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  const allSkills = useMemo(
    () => Array.from(new Set(talents.flatMap((t) => t.skills))).sort(),
    [talents]
  );

  const filtered = useMemo(() => {
    return talents.filter((item) => {
      const matchSearch =
        search === '' ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.skills.some((s) => s.toLowerCase().includes(search.toLowerCase())) ||
        item.location.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchSkill = skillFilter === 'all' || item.skills.includes(skillFilter);
      const matchWorkStyle = workStyleFilter === 'all' || item.workStyle === workStyleFilter;
      return matchSearch && matchStatus && matchSkill && matchWorkStyle;
    });
  }, [talents, search, statusFilter, skillFilter, workStyleFilter]);

  return (
    <div className="flex flex-col h-full bg-vatch-bg">
      <Topbar title="人材管理" />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">

          <SummaryCards items={talents} />

          {/* 検索・フィルター */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex-1 min-w-[200px] relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vatch-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx={11} cy={11} r={8} />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="氏名・スキル・居住地で検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-vatch-surface border border-vatch-border rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-vatch-muted focus:outline-none focus:border-[#38bdf8] transition-colors"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TalentStatus | 'all')}
              className="bg-vatch-surface border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors cursor-pointer"
            >
              <option value="all">全ステータス</option>
              {(Object.keys(STATUS_CONFIG) as TalentStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
            <select
              value={workStyleFilter}
              onChange={(e) => setWorkStyleFilter(e.target.value as WorkStyle | 'all')}
              className="bg-vatch-surface border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors cursor-pointer"
            >
              <option value="all">全勤務形式</option>
              {(Object.keys(WORK_STYLE_CONFIG) as WorkStyle[]).map((w) => (
                <option key={w} value={w}>{WORK_STYLE_CONFIG[w].label}</option>
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
              {loading ? '読み込み中...' : `${filtered.length} 名表示`}
            </div>
          </div>

          {/* 人材テーブル */}
          <div className="bg-vatch-surface border border-vatch-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-vatch-border text-vatch-muted text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">氏名 / 居住地</th>
                    <th className="text-left px-4 py-3 font-medium">スキル</th>
                    <th className="text-right px-4 py-3 font-medium">経験年数</th>
                    <th className="text-right px-4 py-3 font-medium">希望単価</th>
                    <th className="text-left px-4 py-3 font-medium">勤務形式</th>
                    <th className="text-left px-4 py-3 font-medium">ステータス</th>
                    <th className="text-left px-4 py-3 font-medium">紹介元</th>
                    <th className="text-center px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-vatch-muted">読み込み中...</td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-vatch-muted">該当する人材が見つかりません</td>
                    </tr>
                  ) : (
                    filtered.map((item, index) => {
                      const statusCfg = STATUS_CONFIG[item.status];
                      const workCfg = WORK_STYLE_CONFIG[item.workStyle];
                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-vatch-border/50 hover:bg-white/[0.02] transition-colors ${index === filtered.length - 1 ? 'border-b-0' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-white">{item.name}</div>
                            <div className="text-xs text-vatch-muted mt-0.5">{item.location}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {item.skills.slice(0, 3).map((skill) => (
                                <span key={skill} className="px-1.5 py-0.5 bg-vatch-border/50 text-vatch-muted rounded text-xs">{skill}</span>
                              ))}
                              {item.skills.length > 3 && (
                                <span className="px-1.5 py-0.5 bg-vatch-border/50 text-vatch-muted rounded text-xs">+{item.skills.length - 3}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-white font-semibold">{item.experience}</span>
                            <span className="text-vatch-muted text-xs ml-1">年</span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className="text-white font-semibold">{item.desiredRate}</span>
                            <span className="text-vatch-muted text-xs ml-1">万円</span>
                          </td>
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
                          <td className="px-4 py-3 max-w-[160px]">
                            <span className="text-xs text-vatch-muted truncate block">{item.agencyEmail ?? '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              className="px-3 py-1 text-xs border border-vatch-border rounded hover:border-[#38bdf8] hover:text-[#38bdf8] text-vatch-muted transition-colors"
                              onClick={() => setSelectedTalent(item)}
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

        <Modal open={selectedTalent !== null} onClose={closeModal}>
          <div className="bg-vatch-surface border border-vatch-border rounded-xl shadow-2xl overflow-hidden">
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-vatch-border">
              <h2 id="modal-title" className="text-base font-bold text-white truncate pr-4">
                {selectedTalent?.name}
              </h2>
              <div className="flex items-center gap-2 shrink-0">
                {editing ? (
                  <>
                    <button
                      onClick={() => { setEditing(false); setSaveError(null); setEditForm(toEditTalentForm(selectedTalent!)); }}
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
                <div className="grid grid-cols-2 gap-4">
                  {/* name */}
                  <div>
                    <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">氏名</label>
                    <input
                      type="text"
                      value={editForm.name ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors"
                    />
                  </div>
                  {/* location */}
                  <div>
                    <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">居住地</label>
                    <input
                      type="text"
                      value={editForm.location ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                      className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors"
                    />
                  </div>
                  {/* experience */}
                  <div>
                    <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">経験年数（年）</label>
                    <input
                      type="number"
                      min={0}
                      value={editForm.experience ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, experience: Number(e.target.value) }))}
                      className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors"
                    />
                  </div>
                  {/* desiredRate */}
                  <div>
                    <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">希望単価（万円）</label>
                    <input
                      type="number"
                      min={1}
                      value={editForm.desiredRate ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, desiredRate: Number(e.target.value) }))}
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
                      value={editForm.status ?? 'AVAILABLE'}
                      onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as TalentStatus }))}
                      className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors cursor-pointer"
                    >
                      {(Object.keys(STATUS_CONFIG) as TalentStatus[]).map((s) => (
                        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                      ))}
                    </select>
                  </div>
                  {/* agencyEmail */}
                  <div className="col-span-2">
                    <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">紹介元メール</label>
                    <input
                      type="email"
                      value={editForm.agencyEmail ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, agencyEmail: e.target.value }))}
                      className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors"
                    />
                  </div>
                  {saveError && <p className="col-span-2 text-red-400 text-xs">{saveError}</p>}
                </div>
              ) : (
                selectedTalent && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">居住地</div>
                      <div className="text-sm text-white">{selectedTalent.location}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">経験年数</div>
                      <div className="text-sm text-white">{selectedTalent.experience}年</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">希望単価</div>
                      <div className="text-sm text-white">{selectedTalent.desiredRate}万円</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">勤務形式</div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${WORK_STYLE_CONFIG[selectedTalent.workStyle].color} ${WORK_STYLE_CONFIG[selectedTalent.workStyle].bg}`}>
                        {WORK_STYLE_CONFIG[selectedTalent.workStyle].label}
                      </span>
                    </div>
                    <div>
                      <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">ステータス</div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[selectedTalent.status].color} ${STATUS_CONFIG[selectedTalent.status].bg}`}>
                        {STATUS_CONFIG[selectedTalent.status].label}
                      </span>
                    </div>
                    <div>
                      <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">紹介元メール</div>
                      <div className="text-sm text-white">{selectedTalent.agencyEmail ?? '—'}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">スキル</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedTalent.skills.map((s) => (
                          <span key={s} className="px-2 py-0.5 bg-vatch-border/50 text-vatch-muted rounded text-xs">{s}</span>
                        ))}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">登録日時</div>
                      <div className="text-sm text-vatch-muted">
                        {new Date(selectedTalent.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}
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
