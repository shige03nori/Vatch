'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'

type Office = 'TOKYO' | 'NAGOYA'
type WorkStyle = 'REMOTE' | 'ONSITE' | 'HYBRID'

type ExtractedForm = {
  name: string
  email: string
  skills: string
  experience: number
  desiredRate: number
  location: string
  workStyle: WorkStyle
  office: Office
}

const WORK_STYLE_LABELS: Record<WorkStyle, string> = { REMOTE: 'リモート', ONSITE: '常駐', HYBRID: 'ハイブリッド' }

export default function ProperNewPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [office, setOffice] = useState<Office>('TOKYO')
  const [step, setStep] = useState<'upload' | 'confirm' | 'done'>('upload')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [form, setForm] = useState<ExtractedForm>({ name: '', email: '', skills: '', experience: 0, desiredRate: 0, location: '', workStyle: 'HYBRID', office: 'TOKYO' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<{ email: string; tempPassword: string } | null>(null)

  async function handleExtract() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setExtracting(true)
    setExtractError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/proper/extract', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? '抽出に失敗しました')
      const d = json.data
      setForm({
        name:       d.name ?? '',
        email:      d.email ?? '',
        skills:     (d.skills ?? []).join(', '),
        experience: d.experience ?? 0,
        desiredRate: d.desiredRate ?? 0,
        location:   d.location ?? '',
        workStyle:  d.workStyle ?? 'HYBRID',
        office,
      })
      setStep('confirm')
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : '抽出に失敗しました')
    } finally {
      setExtracting(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/proper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        form.name,
          email:       form.email,
          skills:      form.skills.split(',').map((s) => s.trim()).filter(Boolean),
          experience:  form.experience,
          desiredRate: form.desiredRate,
          location:    form.location,
          workStyle:   form.workStyle,
          office:      form.office,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? '登録に失敗しました')
      setCredentials({ email: json.data.user.email, tempPassword: json.data.tempPassword })
      setStep('done')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '登録に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-vatch-bg">
      <Topbar title="プロパ登録" />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-2xl mx-auto">

          {step === 'upload' && (
            <div className="bg-vatch-surface border border-vatch-border rounded-xl p-6 space-y-6">
              <h2 className="text-base font-bold text-white">Step 1: 拠点選択 + 経歴書アップロード</h2>

              <div>
                <label className="block text-xs text-vatch-muted mb-2">拠点</label>
                <div className="flex gap-2">
                  {(['TOKYO', 'NAGOYA'] as Office[]).map((o) => (
                    <button key={o} onClick={() => setOffice(o)} className={`px-5 py-2 rounded-lg text-sm font-medium border transition-colors ${office === o ? 'bg-[#0c2d5a] border-[#38bdf8] text-[#38bdf8]' : 'border-vatch-border text-vatch-muted hover:text-white'}`}>
                      {o === 'TOKYO' ? '東京' : '名古屋'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-vatch-muted mb-2">経歴書ファイル（.doc / .docx）</label>
                <input ref={fileRef} type="file" accept=".doc,.docx" className="block w-full text-sm text-vatch-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-vatch-border file:text-xs file:text-vatch-muted file:bg-vatch-bg hover:file:border-[#38bdf8] hover:file:text-[#38bdf8] transition-colors cursor-pointer" />
              </div>

              {extractError && <p className="text-red-400 text-xs">{extractError}</p>}

              <button onClick={handleExtract} disabled={extracting} className="w-full py-2.5 bg-[#38bdf8] text-black text-sm font-bold rounded-lg disabled:opacity-50">
                {extracting ? 'AI解析中...' : '経歴書を解析する'}
              </button>
            </div>
          )}

          {step === 'confirm' && (
            <div className="bg-vatch-surface border border-vatch-border rounded-xl p-6 space-y-4">
              <h2 className="text-base font-bold text-white">Step 2: 内容確認・編集</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: '氏名', key: 'name', type: 'text' },
                  { label: '経験年数（年）', key: 'experience', type: 'number' },
                  { label: '希望単価（万円）', key: 'desiredRate', type: 'number' },
                  { label: '居住地', key: 'location', type: 'text' },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">{label}</label>
                    <input type={type} value={(form as Record<string, unknown>)[key] as string} onChange={(e) => setForm((f) => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors" />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">メールアドレス</label>
                  <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">スキル（カンマ区切り）</label>
                  <input type="text" value={form.skills} onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">勤務形式</label>
                  <select value={form.workStyle} onChange={(e) => setForm((f) => ({ ...f, workStyle: e.target.value as WorkStyle }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors">
                    {(Object.keys(WORK_STYLE_LABELS) as WorkStyle[]).map((w) => <option key={w} value={w}>{WORK_STYLE_LABELS[w]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">拠点</label>
                  <select value={form.office} onChange={(e) => setForm((f) => ({ ...f, office: e.target.value as Office }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors">
                    <option value="TOKYO">東京</option>
                    <option value="NAGOYA">名古屋</option>
                  </select>
                </div>
              </div>
              {saveError && <p className="text-red-400 text-xs">{saveError}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep('upload')} className="flex-1 py-2.5 border border-vatch-border text-vatch-muted text-sm rounded-lg hover:border-[#38bdf8] hover:text-[#38bdf8] transition-colors">戻る</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-[#38bdf8] text-black text-sm font-bold rounded-lg disabled:opacity-50">{saving ? '登録中...' : '登録する'}</button>
              </div>
            </div>
          )}

          {step === 'done' && credentials && (
            <div className="bg-vatch-surface border border-[#4ade80] rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[#4ade80] text-xl">✓</span>
                <h2 className="text-base font-bold text-white">登録完了</h2>
              </div>
              <p className="text-sm text-vatch-muted">以下のログイン情報をプロパ本人に伝えてください。</p>
              <div className="bg-vatch-bg rounded-lg p-4 space-y-3">
                <div>
                  <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">ログインURL</div>
                  <div className="text-sm text-white font-mono">/login</div>
                </div>
                <div>
                  <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">メールアドレス</div>
                  <div className="text-sm text-white font-mono">{credentials.email}</div>
                </div>
                <div>
                  <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">仮パスワード</div>
                  <div className="text-lg text-[#38bdf8] font-mono font-bold tracking-widest">{credentials.tempPassword}</div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setStep('upload'); setCredentials(null) }} className="flex-1 py-2.5 border border-vatch-border text-vatch-muted text-sm rounded-lg hover:text-white transition-colors">続けて登録</button>
                <button onClick={() => router.push('/proper')} className="flex-1 py-2.5 bg-[#38bdf8] text-black text-sm font-bold rounded-lg">一覧に戻る</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
