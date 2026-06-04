'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'

type WorkStyle = 'REMOTE' | 'ONSITE' | 'HYBRID'
type TalentStatus = 'AVAILABLE' | 'ACTIVE' | 'NEGOTIATING' | 'ENDING_SOON' | 'INACTIVE'
type Office = 'TOKYO' | 'NAGOYA'

type ProperDetail = {
  id: string; name: string; skills: string[]; experience: number; desiredRate: number
  location: string; workStyle: WorkStyle; status: TalentStatus; office: Office
  properUser?: { email: string } | null
}

const WORK_STYLE_LABELS: Record<WorkStyle, string> = { REMOTE: 'リモート', ONSITE: '常駐', HYBRID: 'ハイブリッド' }
const STATUS_LABELS: Record<TalentStatus, string>  = { AVAILABLE: '空き', ACTIVE: '稼働中', NEGOTIATING: '交渉中', ENDING_SOON: '終了間近', INACTIVE: '非活動' }

export default function ProperDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [talent, setTalent] = useState<ProperDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<ProperDetail>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetResult, setResetResult] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/proper/${id}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) { setTalent(j.data); setForm(j.data) } })
      .finally(() => setLoading(false))
  }, [id])

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/proper/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, skills: form.skills, experience: form.experience, desiredRate: form.desiredRate, location: form.location, workStyle: form.workStyle, status: form.status, office: form.office }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? '保存に失敗しました')
      setTalent(json.data); setEditing(false)
    } catch (e) { setError(e instanceof Error ? e.message : '保存に失敗しました') }
    finally { setSaving(false) }
  }

  async function handleResetPassword() {
    setResetResult(null)
    const res = await fetch(`/api/proper/${id}/reset-password`, { method: 'POST' })
    const json = await res.json()
    if (res.ok) setResetResult(`新しい仮パスワード: ${json.data.tempPassword}`)
    else setResetResult('リセットに失敗しました')
  }

  if (loading) return <div className="flex flex-col h-full bg-vatch-bg"><Topbar title="プロパ詳細" /><div className="flex-1 flex items-center justify-center text-vatch-muted">読み込み中...</div></div>
  if (!talent) return <div className="flex flex-col h-full bg-vatch-bg"><Topbar title="プロパ詳細" /><div className="flex-1 flex items-center justify-center text-vatch-muted">データが見つかりません</div></div>

  return (
    <div className="flex flex-col h-full bg-vatch-bg">
      <Topbar title={`プロパ詳細: ${talent.name}`} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-2xl mx-auto space-y-4">
          <div className="flex gap-3">
            <button onClick={() => router.push('/proper')} className="px-3 py-1.5 text-xs border border-vatch-border text-vatch-muted rounded-lg hover:border-[#38bdf8] hover:text-[#38bdf8] transition-colors">← 一覧に戻る</button>
            {!editing && <button onClick={() => setEditing(true)} className="px-3 py-1.5 text-xs border border-vatch-border text-vatch-muted rounded-lg hover:border-[#38bdf8] hover:text-[#38bdf8] transition-colors">✏ 編集</button>}
          </div>

          <div className="bg-vatch-surface border border-vatch-border rounded-xl p-6">
            {editing ? (
              <div className="grid grid-cols-2 gap-4">
                {([['name','氏名','text'],['experience','経験年数（年）','number'],['desiredRate','希望単価（万円）','number'],['location','居住地','text']] as [keyof ProperDetail, string, string][]).map(([key, label, type]) => (
                  <div key={key}>
                    <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">{label}</label>
                    <input type={type} value={(form as Record<string, unknown>)[key] as string ?? ''} onChange={(e) => setForm((f) => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors" />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">スキル（カンマ区切り）</label>
                  <input type="text" value={(form.skills ?? []).join(', ')} onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">ステータス</label>
                  <select value={form.status ?? 'AVAILABLE'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TalentStatus }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors">
                    {(Object.keys(STATUS_LABELS) as TalentStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">拠点</label>
                  <select value={form.office ?? 'TOKYO'} onChange={(e) => setForm((f) => ({ ...f, office: e.target.value as Office }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors">
                    <option value="TOKYO">東京</option><option value="NAGOYA">名古屋</option>
                  </select>
                </div>
                {error && <p className="col-span-2 text-red-400 text-xs">{error}</p>}
                <div className="col-span-2 flex gap-3">
                  <button onClick={() => { setEditing(false); setForm(talent) }} className="flex-1 py-2 border border-vatch-border text-vatch-muted text-sm rounded-lg hover:border-[#38bdf8] hover:text-[#38bdf8] transition-colors">キャンセル</button>
                  <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-[#38bdf8] text-black text-sm font-bold rounded-lg disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['拠点', talent.office === 'TOKYO' ? '東京' : '名古屋'],
                  ['居住地', talent.location],
                  ['経験年数', `${talent.experience}年`],
                  ['希望単価', `${talent.desiredRate}万円`],
                  ['勤務形式', WORK_STYLE_LABELS[talent.workStyle]],
                  ['ステータス', STATUS_LABELS[talent.status]],
                  ['ログインメール', talent.properUser?.email ?? '—'],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">{label}</div>
                    <div className="text-sm text-white">{value}</div>
                  </div>
                ))}
                <div className="col-span-2">
                  <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">スキル</div>
                  <div className="flex flex-wrap gap-1">{talent.skills.map((s) => <span key={s} className="px-2 py-0.5 bg-vatch-border/50 text-vatch-muted rounded text-xs">{s}</span>)}</div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-vatch-surface border border-vatch-border rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-3">パスワード管理</h3>
            <button onClick={handleResetPassword} className="px-4 py-2 border border-vatch-border text-vatch-muted text-xs rounded-lg hover:border-[#f59e0b] hover:text-[#f59e0b] transition-colors">仮パスワードを再発行</button>
            {resetResult && <p className="mt-3 text-sm text-[#38bdf8] font-mono">{resetResult}</p>}
          </div>
        </div>
      </main>
    </div>
  )
}
