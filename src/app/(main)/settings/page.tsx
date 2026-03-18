'use client'

import { useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'

type TabId = 'profile' | 'ai' | 'notifications' | 'system'

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        enabled ? 'bg-vatch-cyan' : 'bg-vatch-border'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-vatch-surface border border-vatch-border rounded-lg p-5 flex flex-col gap-4">
      <h2 className="text-sm font-bold text-vatch-text-bright border-b border-vatch-border pb-3">
        {title}
      </h2>
      {children}
    </div>
  )
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-vatch-text-bright">{label}</span>
        {description && <span className="text-xs text-vatch-muted">{description}</span>}
      </div>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('profile')
  const [flashMsg, setFlashMsg] = useState<string | null>(null)

  // Profile
  const [name, setName] = useState('山田 太郎')
  const [email, setEmail] = useState('yamada@vicent.co.jp')
  const [company, setCompany] = useState('VICENT株式会社')

  // AI settings
  const [emailAnalysis, setEmailAnalysis] = useState(true)
  const [matchingAi, setMatchingAi] = useState(true)
  const [autoProposal, setAutoProposal] = useState(false)
  const [grossMarginThreshold, setGrossMarginThreshold] = useState(10)
  const [autoSend, setAutoSend] = useState(false)

  // Notification settings
  const [emailNotif, setEmailNotif] = useState(true)
  const [newCaseNotif, setNewCaseNotif] = useState(true)
  const [matchingNotif, setMatchingNotif] = useState(true)
  const [contractAlertDays, setContractAlertDays] = useState(30)

  const showFlash = (msg: string) => {
    setFlashMsg(msg)
    setTimeout(() => setFlashMsg(null), 3000)
  }

  const handleSave = () => {
    showFlash('保存しました')
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'profile', label: 'プロフィール設定' },
    { id: 'ai', label: 'AI設定' },
    { id: 'notifications', label: '通知設定' },
    { id: 'system', label: 'システム情報' },
  ]

  return (
    <>
      <Topbar title="設定" subtitle="システム設定・環境管理" />
      <main className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

        {/* Flash message */}
        {flashMsg && (
          <div className="fixed top-4 right-4 z-50 bg-vatch-cyan text-vatch-bg text-sm font-semibold px-5 py-3 rounded-lg shadow-lg animate-pulse">
            {flashMsg}
          </div>
        )}

        {/* Tab navigation */}
        <div className="flex gap-1 bg-vatch-surface border border-vatch-border rounded-lg p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors duration-150 ${
                activeTab === tab.id
                  ? 'bg-vatch-cyan text-vatch-bg'
                  : 'text-vatch-muted hover:text-vatch-text-bright'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex flex-col gap-4 max-w-2xl">

          {/* Profile */}
          {activeTab === 'profile' && (
            <SectionCard title="プロフィール設定">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-vatch-muted">氏名</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-vatch-bg border border-vatch-border rounded-md px-3 py-2 text-sm text-vatch-text-bright focus:outline-none focus:border-vatch-cyan transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-vatch-muted">メールアドレス</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-vatch-bg border border-vatch-border rounded-md px-3 py-2 text-sm text-vatch-text-bright focus:outline-none focus:border-vatch-cyan transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-vatch-muted">会社名</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="bg-vatch-bg border border-vatch-border rounded-md px-3 py-2 text-sm text-vatch-text-bright focus:outline-none focus:border-vatch-cyan transition-colors"
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-vatch-border">
                <button
                  onClick={handleSave}
                  className="px-5 py-2 bg-vatch-cyan text-vatch-bg text-sm font-bold rounded-md hover:opacity-90 transition-opacity"
                >
                  保存する
                </button>
              </div>
            </SectionCard>
          )}

          {/* AI settings */}
          {activeTab === 'ai' && (
            <SectionCard title="AI設定">
              <SettingRow label="メール解析" description="受信メールをAIで自動解析します">
                <Toggle enabled={emailAnalysis} onChange={setEmailAnalysis} />
              </SettingRow>
              <SettingRow label="マッチングAI" description="案件と人材の自動マッチングを行います">
                <Toggle enabled={matchingAi} onChange={setMatchingAi} />
              </SettingRow>
              <SettingRow label="提案メール自動生成" description="マッチング結果から提案メールを自動生成します">
                <Toggle enabled={autoProposal} onChange={setAutoProposal} />
              </SettingRow>

              {/* Gross margin threshold */}
              <div className="flex flex-col gap-2 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-vatch-text-bright">粗利閾値</span>
                    <span className="text-xs text-vatch-muted">自動送信の判定に使用する粗利率の閾値</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={grossMarginThreshold}
                      onChange={(e) => setGrossMarginThreshold(Number(e.target.value))}
                      className="w-16 bg-vatch-bg border border-vatch-border rounded-md px-2 py-1.5 text-sm text-vatch-text-bright text-right focus:outline-none focus:border-vatch-cyan transition-colors"
                    />
                    <span className="text-sm text-vatch-muted">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={grossMarginThreshold}
                  onChange={(e) => setGrossMarginThreshold(Number(e.target.value))}
                  className="w-full accent-vatch-cyan"
                />
                <div className="flex justify-between text-xs text-vatch-muted">
                  <span>0%</span>
                  <span className="text-vatch-cyan font-semibold">{grossMarginThreshold}%</span>
                  <span>50%</span>
                </div>
              </div>

              <SettingRow
                label="自動送信"
                description={`粗利 ${grossMarginThreshold}% 以上のみ自動送信する`}
              >
                <Toggle enabled={autoSend} onChange={setAutoSend} />
              </SettingRow>

              <div className="pt-2 border-t border-vatch-border">
                <button
                  onClick={handleSave}
                  className="px-5 py-2 bg-vatch-cyan text-vatch-bg text-sm font-bold rounded-md hover:opacity-90 transition-opacity"
                >
                  保存する
                </button>
              </div>
            </SectionCard>
          )}

          {/* Notification settings */}
          {activeTab === 'notifications' && (
            <SectionCard title="通知設定">
              <SettingRow label="メール通知" description="システム通知をメールで受け取ります">
                <Toggle enabled={emailNotif} onChange={setEmailNotif} />
              </SettingRow>
              <SettingRow label="新着案件通知" description="新しい案件が登録されたときに通知します">
                <Toggle enabled={newCaseNotif} onChange={setNewCaseNotif} />
              </SettingRow>
              <SettingRow label="マッチング完了通知" description="マッチング処理が完了したときに通知します">
                <Toggle enabled={matchingNotif} onChange={setMatchingNotif} />
              </SettingRow>

              {/* Contract alert days */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-vatch-text-bright">契約終了アラート</span>
                  <span className="text-xs text-vatch-muted">契約終了の何日前に通知するか</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={contractAlertDays}
                    onChange={(e) => setContractAlertDays(Number(e.target.value))}
                    className="w-16 bg-vatch-bg border border-vatch-border rounded-md px-2 py-1.5 text-sm text-vatch-text-bright text-right focus:outline-none focus:border-vatch-cyan transition-colors"
                  />
                  <span className="text-sm text-vatch-muted">日前</span>
                </div>
              </div>

              <div className="pt-2 border-t border-vatch-border">
                <button
                  onClick={handleSave}
                  className="px-5 py-2 bg-vatch-cyan text-vatch-bg text-sm font-bold rounded-md hover:opacity-90 transition-opacity"
                >
                  保存する
                </button>
              </div>
            </SectionCard>
          )}

          {/* System info */}
          {activeTab === 'system' && (
            <SectionCard title="システム情報">
              {[
                { label: 'バージョン', value: 'v1.0.0 (Phase 1 Mock)' },
                { label: '環境', value: 'Development' },
                { label: '最終更新', value: '2026-03-18' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-1">
                  <span className="text-xs font-semibold text-vatch-muted">{label}</span>
                  <span className="text-sm text-vatch-text-bright font-mono">{value}</span>
                </div>
              ))}
            </SectionCard>
          )}

        </div>
      </main>
    </>
  )
}
