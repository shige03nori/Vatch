# システム概要ページ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** サイドバーに「システム概要」ページ（`/overview`）を追加し、SES 業務フロー・機能ステータス・将来ビジョンを静的ページとして表示する。

**Architecture:** 静的 Server Component（API 呼び出しなし）。既存の `(main)` ルートグループのレイアウト（Sidebar）を継承し、各ページが自前で `<Topbar />` をレンダリングする既存パターンに従う。Sidebar の `navSections` に 1 エントリ追加する。

**Tech Stack:** Next.js 16 App Router, Tailwind CSS, @testing-library/react, Jest

---

## ファイル構成

| ファイル | 操作 | 役割 |
|---------|------|------|
| `src/components/layout/Sidebar.tsx` | 修正 | `管理` セクションに `/overview` リンク追加 |
| `src/components/layout/Sidebar.test.tsx` | 修正 | システム概要リンクの存在テスト追加 |
| `src/app/(main)/overview/page.tsx` | 新規作成 | システム概要ページ本体（Server Component） |
| `src/app/(main)/overview/page.test.tsx` | 新規作成 | ページレンダリングテスト |

---

## Task 1: Sidebar にシステム概要リンクを追加

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/Sidebar.test.tsx`

---

- [ ] **Step 1: 失敗するテストを書く**

`src/components/layout/Sidebar.test.tsx` に以下のテストを追加する（既存の2テストの後に追記）：

```tsx
test('システム概要リンクが存在する', () => {
  render(<Sidebar />)
  const link = screen.getByRole('link', { name: /システム概要/ })
  expect(link).toBeInTheDocument()
  expect(link).toHaveAttribute('href', '/overview')
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest src/components/layout/Sidebar.test.tsx --no-coverage
```

Expected: FAIL — `Unable to find an accessible element with the role "link" and name matching /システム概要/`

- [ ] **Step 3: Sidebar.tsx に `/overview` リンクを追加する**

`src/components/layout/Sidebar.tsx` の `navSections` 内 `管理` セクションを次のように修正する（`/contracts` と `/settings` の間に追加）：

```tsx
{
  label: '管理',
  links: [
    { href: '/contracts', label: '契約・売上',    icon: '📝' },
    { href: '/overview',  label: 'システム概要',  icon: '🌐' },  // ← 追加
    { href: '/settings',  label: '設定',          icon: '⚙' },
  ],
},
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest src/components/layout/Sidebar.test.tsx --no-coverage
```

Expected: `Tests: 3 passed, 3 total`

- [ ] **Step 5: コミット**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/Sidebar.test.tsx
git commit -m "feat: add system overview link to sidebar"
```

---

## Task 2: システム概要ページを実装する

**Files:**
- Create: `src/app/(main)/overview/page.tsx`
- Create: `src/app/(main)/overview/page.test.tsx`

---

- [ ] **Step 1: 失敗するテストを書く**

`src/app/(main)/overview/page.test.tsx` を新規作成：

```tsx
import { render, screen } from '@testing-library/react'
import OverviewPage from './page'

jest.mock('@/components/layout/Topbar', () => ({
  Topbar: ({ title }: { title: string }) => <div>{title}</div>,
}))

test('ページがレンダリングされる', () => {
  render(<OverviewPage />)
  expect(screen.getByText('システム概要')).toBeInTheDocument()
})

test('5つのフローステップタイトルが存在する', () => {
  render(<OverviewPage />)
  expect(screen.getByText('メール受信・解析')).toBeInTheDocument()
  expect(screen.getByText('案件・人材管理')).toBeInTheDocument()
  expect(screen.getByText('AIマッチング')).toBeInTheDocument()
  expect(screen.getByText('提案・交渉')).toBeInTheDocument()
  expect(screen.getByText('契約・売上管理')).toBeInTheDocument()
})

test('Phase 3の3カードタイトルが存在する', () => {
  render(<OverviewPage />)
  expect(screen.getByText(/自律型AIエージェント/)).toBeInTheDocument()
  expect(screen.getByText(/高度分析ダッシュボード/)).toBeInTheDocument()
  expect(screen.getByText(/外部システム連携/)).toBeInTheDocument()
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest src/app/\(main\)/overview/page.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module './page'`

- [ ] **Step 3: page.tsx を実装する**

`src/app/(main)/overview/page.tsx` を新規作成：

```tsx
import { Topbar } from '@/components/layout/Topbar'

// フローステップ定義
const flowSteps = [
  {
    icon: '📧',
    title: 'メール受信・解析',
    subtitle: '案件・人材情報を自動抽出',
    features: [
      { label: 'メール一覧管理',         status: 'done'   },
      { label: 'AI自動テキスト解析',     status: 'soon'   },
      { label: '案件/人材 自動分類',     status: 'soon'   },
      { label: '添付ファイル解析',       status: 'future' },
    ],
  },
  {
    icon: '📋',
    title: '案件・人材管理',
    subtitle: '情報の一元管理・検索',
    features: [
      { label: '案件CRUD・ステータス管理', status: 'done'   },
      { label: '人材CRUD・スキル管理',    status: 'done'   },
      { label: '担当者RBAC制御',          status: 'done'   },
      { label: 'スキルオートタグ',        status: 'soon'   },
    ],
  },
  {
    icon: '🤖',
    title: 'AIマッチング',
    subtitle: '最適な案件×人材を提案',
    features: [
      { label: 'マッチングレコード管理',     status: 'done'   },
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
      { label: '提案レコード管理',         status: 'done'   },
      { label: 'AIメール文章生成',         status: 'soon'   },
      { label: '自動送信・スケジュール',   status: 'soon'   },
      { label: '返信自動解析',             status: 'future' },
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

// バリュープロップス定義
const valueProps = [
  { value: '80%',    label: 'メール処理工数削減（AI解析）' },
  { value: '3倍',   label: 'マッチング候補の発掘速度向上' },
  { value: '0件',   label: '見落とし（アラート自動通知）' },
  { value: '全データ', label: '案件・人材・契約を一元管理' },
]

// Phase 3 ビジョン定義
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

// ステータスに応じたドットの色
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
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest src/app/\(main\)/overview/page.test.tsx --no-coverage
```

Expected: `Tests: 3 passed, 3 total`

- [ ] **Step 5: 全テストスイートが壊れていないことを確認する**

```bash
npx jest --no-coverage
```

Expected: 全スイートが pass（既存テスト含む）

- [ ] **Step 6: コミット**

```bash
git add src/app/\(main\)/overview/page.tsx src/app/\(main\)/overview/page.test.tsx
git commit -m "feat: add system overview page with SES business flow and future vision"
```

- [ ] **Step 7: Playwright でスクリーンショットを撮って表示を確認する**

開発サーバーを起動し（`npm run dev`）、Playwright MCP でブラウザを開いて `/overview` にアクセスする。
ログインが必要な場合は `yamada@vicent.co.jp` / `password` でログイン。
スクリーンショットを撮って、以下を目視確認する：
- Sidebar に「システム概要」リンクが表示されている
- 5 つのフローステップが横並びで表示されている
- Value Props の 4 枚のカードが表示されている
- Phase 3 の 3 枚のカードが表示されている
