import { Topbar } from '@/components/layout/Topbar'

const flowSteps = [
  {
    icon: '📧',
    title: 'メール受信・解析',
    subtitle: '案件・人材情報を自動抽出',
    features: [
      { label: 'メール一覧管理',       status: 'done'   },
      { label: 'AI自動テキスト解析',   status: 'soon'   },
      { label: '案件/人材 自動分類',   status: 'soon'   },
      { label: '添付ファイル解析',     status: 'future' },
    ],
  },
  {
    icon: '📋',
    title: '案件・人材管理',
    subtitle: '情報の一元管理・検索',
    features: [
      { label: '案件CRUD・ステータス管理', status: 'done' },
      { label: '人材CRUD・スキル管理',    status: 'done' },
      { label: '担当者RBAC制御',          status: 'done' },
      { label: 'スキルオートタグ',        status: 'soon' },
    ],
  },
  {
    icon: '🤖',
    title: 'AIマッチング',
    subtitle: '最適な案件×人材を提案',
    features: [
      { label: 'マッチングレコード管理',   status: 'done'   },
      { label: 'スキル類似度スコアリング', status: 'soon'   },
      { label: 'マッチング候補自動生成',   status: 'soon'   },
      { label: '精度フィードバック学習',   status: 'future' },
    ],
  },
  {
    icon: '✉️',
    title: '提案・交渉',
    subtitle: '提案メール送信・進捗追跡',
    features: [
      { label: '提案レコード管理',       status: 'done'   },
      { label: 'AIメール文章生成',       status: 'soon'   },
      { label: '自動送信・スケジュール', status: 'soon'   },
      { label: '返信自動解析',           status: 'future' },
    ],
  },
  {
    icon: '📝',
    title: '契約・売上管理',
    subtitle: '契約締結から収益まで',
    features: [
      { label: '契約CRUD管理',       status: 'done'   },
      { label: '売上・単価記録',     status: 'done'   },
      { label: '更新アラート通知',   status: 'soon'   },
      { label: '売上予測・レポート', status: 'future' },
    ],
  },
]

const valueProps = [
  { value: '80%',     label: 'メール処理工数削減（AI解析）' },
  { value: '3倍',    label: 'マッチング候補の発掘速度向上' },
  { value: '0件',    label: '見落とし（アラート自動通知）' },
  { value: '全データ', label: '案件・人材・契約を一元管理' },
]

const futureVision = [
  {
    icon: '🧠',
    title: '自律型AIエージェント',
    desc: 'メール受信から提案送信まで全工程を自動実行。人手介入を最小化。',
    tag: 'AI Agent',
  },
  {
    icon: '📊',
    title: '高度分析ダッシュボード',
    desc: '成約率・単価・担当者パフォーマンスをリアルタイム分析。経営判断に直結するインサイト。',
    tag: 'Analytics',
  },
  {
    icon: '🔗',
    title: '外部システム連携',
    desc: 'Slack / 会計 / 電子契約とのAPI連携で既存業務フローに統合。',
    tag: 'Integration',
  },
]

const statusDot: Record<string, string> = {
  done:   'bg-green-400',
  soon:   'bg-amber-400',
  future: 'bg-violet-400',
}

export default function OverviewPage() {
  return (
    <>
      <Topbar title="システム概要" subtitle="SES業務のエンドツーエンド自動化プラットフォーム" />
      <main className="flex-1 overflow-y-auto overflow-x-auto p-6 flex flex-col gap-6 bg-[#080f1e]">

        {/* 凡例 */}
        <div className="flex items-center gap-4 bg-vatch-surface border border-vatch-border rounded-lg px-4 py-2.5 w-fit text-xs">
          <span className="text-slate-500 text-[10px] uppercase tracking-widest">凡例</span>
          {[
            { cls: 'bg-green-400',  label: '実装済み' },
            { cls: 'bg-amber-400',  label: '開発中 (Phase 2)' },
            { cls: 'bg-violet-400', label: '将来予定 (Phase 3)' },
          ].map(({ cls, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-slate-400">
              <span className={`w-2 h-2 rounded-full ${cls}`} />
              {label}
            </div>
          ))}
        </div>

        {/* SES ビジネスフロー */}
        <section>
          <h2 className="text-[11px] text-slate-500 uppercase tracking-widest mb-3">SES ビジネスフロー</h2>
          <div className="flex items-start gap-0 overflow-x-auto pb-2">
            {flowSteps.map((step, i) => (
              <div key={step.title} className="flex items-start flex-shrink-0">
                <div className="w-44 bg-vatch-surface border border-vatch-border rounded-xl p-4">
                  <div className="text-2xl mb-2">{step.icon}</div>
                  <div className="text-sm font-semibold text-slate-100 mb-0.5">{step.title}</div>
                  <div className="text-[11px] text-slate-500 mb-3">{step.subtitle}</div>
                  <div className="flex flex-col gap-1">
                    {step.features.map((f) => (
                      <div key={f.label} className="flex items-center gap-1.5 text-[11px] text-slate-400 py-1 border-b border-vatch-border last:border-none">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot[f.status]}`} />
                        {f.label}
                      </div>
                    ))}
                  </div>
                </div>
                {i < flowSteps.length - 1 && (
                  <div className="flex items-center px-2 mt-14 text-slate-600 text-lg flex-shrink-0">→</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* システムが実現する価値 */}
        <section>
          <h2 className="text-[11px] text-slate-500 uppercase tracking-widest mb-3">システムが実現する価値</h2>
          <div className="grid grid-cols-4 gap-3">
            {valueProps.map(({ value, label }) => (
              <div key={label} className="bg-vatch-surface border border-vatch-border rounded-xl p-4">
                <div className="text-3xl font-bold text-amber-400">{value}</div>
                <div className="text-xs text-slate-500 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Phase 3 将来ビジョン */}
        <section>
          <h2 className="text-[11px] text-slate-500 uppercase tracking-widest mb-3">Phase 3 将来ビジョン</h2>
          <div className="grid grid-cols-3 gap-3">
            {futureVision.map(({ icon, title, desc, tag }) => (
              <div key={title} className="bg-[#080f1e] border border-indigo-900/50 rounded-xl overflow-hidden">
                <div className="h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500" />
                <div className="p-4">
                  <div className="text-sm font-semibold text-indigo-300 mb-2">{icon} {title}</div>
                  <div className="text-xs text-slate-500 leading-relaxed">{desc}</div>
                  <span className="inline-block mt-3 bg-indigo-950 text-indigo-400 text-[10px] px-2 py-0.5 rounded-full">{tag}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>
    </>
  )
}
