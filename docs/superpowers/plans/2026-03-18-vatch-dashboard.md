# Vatch Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working Vatch dashboard frontend mock with dummy data, styled as a dark admin panel, ready for executive presentation.

**Architecture:** Single-page Next.js App Router app with a fixed sidebar layout. All data comes from TypeScript constants in `src/data/dashboard.ts`. No API routes, no database, no authentication. Components are pure presentational.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS v3, React Testing Library + Jest

---

## Chunk 1: Project Setup & Configuration

### Task 1: Create Next.js project

**Files:**
- Create: `C:/Users/shige/Vatch/` (project root — Next.js scaffold)

- [ ] **Step 1: Run create-next-app**

```bash
cd /c/Users/shige
npx create-next-app@latest Vatch --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

When prompted:
- TypeScript: Yes
- ESLint: Yes
- Tailwind CSS: Yes
- `src/` directory: Yes
- App Router: Yes
- Import alias: Yes (`@/*`)

- [ ] **Step 2: Copy logo to public directory**

```bash
test -f /c/Users/shige/Vatch/logo.png || echo "ERROR: logo.png missing — copy C:/Users/shige/OneDrive/画像/Vatchロゴ.png to /c/Users/shige/Vatch/logo.png first"
cp /c/Users/shige/Vatch/logo.png /c/Users/shige/Vatch/public/logo.png
```

- [ ] **Step 3: Start dev server to verify**

```bash
cd /c/Users/shige/Vatch
npm run dev
```

Expected: `http://localhost:3000` shows default Next.js page with no errors

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: initialize Next.js project with TypeScript and Tailwind"
```

---

### Task 2: Configure Tailwind theme

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update tailwind.config.ts with Vatch color palette**

Replace `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        vatch: {
          bg:          '#060d1a',
          surface:     '#080f1e',
          border:      '#0f2444',
          'border-light': '#1e3a5f',
          cyan:        '#38bdf8',
          green:       '#4ade80',
          amber:       '#f59e0b',
          red:         '#f87171',
          purple:      '#a78bfa',
          muted:       '#64748b',
          'muted-dark': '#334155',
          text:        '#e2e8f0',
          'text-bright': '#f1f5f9',
          'text-dim':  '#94a3b8',
        },
      },
    },
  },
  plugins: [],
}
export default config
```

- [ ] **Step 2: Update globals.css**

Replace `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body {
  background-color: #060d1a;
  color: #e2e8f0;
  height: 100%;
}

* {
  box-sizing: border-box;
}
```

- [ ] **Step 3: Verify dev server still works**

```bash
npm run dev
```

Expected: No errors in terminal, page background is dark

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts src/app/globals.css
git commit -m "feat: configure Vatch dark theme Tailwind palette"
```

---

### Task 3: Types and dummy data

**Files:**
- Create: `src/types/index.ts`
- Create: `src/data/dashboard.ts`

- [ ] **Step 1: Create type definitions**

Create `src/types/index.ts`:

```typescript
export type KpiItem = {
  id: string
  value: string | number
  label: string
  change: string
  color: 'blue' | 'green' | 'amber' | 'red'
}

export type MatchingCandidate = {
  id: string
  skill: string
  skillColor: string
  talentName: string
  caseName: string
  score: number
  grossProfitOk: boolean
}

export type AutoSendItem = {
  id: string
  status: 'auto' | 'check' | 'draft'
  label: string
  grossProfitRate: number
}

export type AlertItem = {
  id: string
  icon: string
  message: string
  severity: 'warning' | 'error' | 'info'
  date: string
}

export type PipelineItem = {
  label: string
  count: number
  color: string
  percentage: number
}

export type ActivityItem = {
  id: string
  time: string
  color: string
  text: string
  highlight: string
}
```

- [ ] **Step 2: Create dummy data**

Create `src/data/dashboard.ts`:

```typescript
import type { KpiItem, MatchingCandidate, AutoSendItem, AlertItem, PipelineItem, ActivityItem } from '@/types'

export const kpiItems: KpiItem[] = [
  { id: '1', value: 12,     label: '本日受信案件',     change: '↑ 3件',   color: 'blue'  },
  { id: '2', value: 8,      label: '本日受信人材',     change: '↑ 2件',   color: 'blue'  },
  { id: '3', value: 24,     label: 'AIマッチング候補', change: '新着 5件', color: 'green' },
  { id: '4', value: 5,      label: '自動送信待ち',     change: '要確認',   color: 'amber' },
  { id: '5', value: 3,      label: '面談調整中',       change: '今週',     color: 'blue'  },
  { id: '6', value: '¥2.4M', label: '今月粗利見込',   change: '↑ 12%',   color: 'green' },
]

export const matchingCandidates: MatchingCandidate[] = [
  { id: '1', skill: 'Java',  skillColor: 'blue',   talentName: '田中 K.', caseName: '金融系案件',   score: 92, grossProfitOk: true  },
  { id: '2', skill: 'React', skillColor: 'cyan',   talentName: '佐藤 M.', caseName: 'ECサイト案件', score: 85, grossProfitOk: true  },
  { id: '3', skill: 'PM',    skillColor: 'purple', talentName: '鈴木 R.', caseName: '製造業DX案件', score: 71, grossProfitOk: false },
  { id: '4', skill: 'Go',    skillColor: 'green',  talentName: '高橋 S.', caseName: 'インフラ案件', score: 68, grossProfitOk: true  },
]

export const autoSendQueue: AutoSendItem[] = [
  { id: '1', status: 'auto',  label: 'Java × 田中 → ABC商事', grossProfitRate: 14.2 },
  { id: '2', status: 'auto',  label: 'React × 佐藤 → XYZ社',  grossProfitRate: 11.5 },
  { id: '3', status: 'check', label: 'PM × 鈴木 → 製造A社',   grossProfitRate: 9.8  },
  { id: '4', status: 'draft', label: 'Go × 高橋 → インフラB',  grossProfitRate: 12.1 },
]

export const alerts: AlertItem[] = [
  { id: '1', icon: '⚠️', message: '契約更新 2件 — 来月末',  severity: 'warning', date: '4/30'  },
  { id: '2', icon: '📭', message: '返答待ち超過 3件',        severity: 'error',   date: '3日超' },
  { id: '3', icon: '💴', message: '粗利10%未満候補 1件',     severity: 'warning', date: '要確認' },
]

export const pipeline: PipelineItem[] = [
  { label: '面談調整中', count: 3,  color: '#a78bfa', percentage: 25  },
  { label: '提案中',     count: 7,  color: '#38bdf8', percentage: 58  },
  { label: '返答待ち',   count: 5,  color: '#f59e0b', percentage: 42  },
  { label: '稼働中',     count: 12, color: '#4ade80', percentage: 100 },
]

export const activityLog: ActivityItem[] = [
  { id: '1', time: '09:42', color: '#38bdf8', text: 'Java案件メール取込 → ', highlight: 'AI解析完了'   },
  { id: '2', time: '09:31', color: '#4ade80', text: '田中さんへ ',           highlight: '提案メール送信' },
  { id: '3', time: '09:15', color: '#a78bfa', text: '鈴木さん面談 ',         highlight: '日程確定'      },
  { id: '4', time: '08:59', color: '#f59e0b', text: '人材8件 ',              highlight: '新着取込'      },
]
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts src/data/dashboard.ts
git commit -m "feat: add types and dummy dashboard data"
```

---

## Chunk 2: Layout Shell

### Task 4: Root layout + redirect

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/dashboard/page.tsx` (placeholder)

- [ ] **Step 1: Install testing dependencies**

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom jest jest-environment-jsdom @types/jest
```

- [ ] **Step 2: Configure Jest**

Create `jest.config.ts`:

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEach: ['<rootDir>/jest.setup.ts'],
}

export default createJestConfig(config)
```

Create `jest.setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

Add to `package.json` scripts section:
```json
"test": "jest"
```

- [ ] **Step 3: Update root layout**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Sidebar } from '@/components/layout/Sidebar'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vatch — VICENT SES管理プラットフォーム',
  description: 'SES営業の提案活動を効率化するプラットフォーム',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="flex h-screen overflow-hidden bg-vatch-bg text-vatch-text">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Update root page to redirect**

Replace `src/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
```

- [ ] **Step 5: Create dashboard placeholder**

Create `src/app/dashboard/page.tsx`:

```tsx
export default function DashboardPage() {
  return (
    <main className="flex-1 overflow-y-auto p-5">
      <p className="text-vatch-muted">Dashboard loading...</p>
    </main>
  )
}
```

- [ ] **Step 6: Verify in browser**

```bash
npm run dev
```

Expected: redirects to `/dashboard`, page shows dark background with "Dashboard loading..."

- [ ] **Step 7: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx src/app/dashboard/page.tsx jest.config.ts jest.setup.ts package.json
git commit -m "feat: add root layout shell and Jest setup"
```

---

### Task 5: Sidebar component

**Files:**
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/Sidebar.test.tsx`

- [ ] **Step 1: Write Sidebar test**

Create `src/components/layout/Sidebar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { Sidebar } from './Sidebar'

jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }))
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => <img {...props} alt={String(props.alt ?? '')} />,
}))

test('renders VATCH logo text', () => {
  render(<Sidebar />)
  expect(screen.getByText('VATCH')).toBeInTheDocument()
})

test('highlights active dashboard link', () => {
  render(<Sidebar />)
  const link = screen.getByRole('link', { name: /ダッシュボード/ })
  expect(link.className).toMatch(/text-vatch-cyan/)
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest Sidebar.test --no-coverage
```

Expected: FAIL — "Cannot find module './Sidebar'"

- [ ] **Step 3: Create Sidebar component**

Create `src/components/layout/Sidebar.tsx`:

```tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navSections = [
  {
    label: 'メイン',
    links: [
      { href: '/dashboard', label: 'ダッシュボード', icon: '▪' },
      { href: '/emails',    label: 'メール取込',     icon: '✉',  badge: 8,  badgeColor: 'amber' },
      { href: '/cases',     label: '案件管理',        icon: '📋' },
      { href: '/talents',   label: '人材管理',        icon: '👤' },
    ],
  },
  {
    label: '営業',
    links: [
      { href: '/matching',  label: 'マッチング',  icon: '⚡', badge: 5, badgeColor: 'blue' },
      { href: '/proposals', label: '提案メール',  icon: '📨' },
      { href: '/progress',  label: '営業進捗',    icon: '📊' },
    ],
  },
  {
    label: '管理',
    links: [
      { href: '/contracts', label: '契約・売上', icon: '📝' },
      { href: '/settings',  label: '設定',        icon: '⚙' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-[200px] flex-shrink-0 bg-vatch-surface border-r border-vatch-border flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-vatch-border">
        <Image src="/logo.png" alt="Vatch" width={32} height={32} className="flex-shrink-0" />
        <div>
          <div className="text-[17px] font-black text-amber-400 tracking-widest">VATCH</div>
          <div className="text-[8px] text-slate-600 tracking-wide">VICENT SES</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navSections.map((section) => (
          <div key={section.label} className="px-2 py-1 mb-1">
            <div className="text-[9px] text-vatch-muted-dark uppercase tracking-widest px-2 mb-1">
              {section.label}
            </div>
            {section.links.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs mb-0.5 transition-colors ${
                    isActive
                      ? 'bg-[#0c2d5a] text-vatch-cyan font-semibold'
                      : 'text-vatch-muted hover:bg-vatch-border hover:text-vatch-text-dim'
                  }`}
                >
                  <span className="w-4 text-center text-[13px]">{link.icon}</span>
                  <span>{link.label}</span>
                  {link.badge && (
                    <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      link.badgeColor === 'amber'
                        ? 'bg-amber-500 text-[#080f1e]'
                        : 'bg-sky-700 text-white'
                    }`}>
                      {link.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-vatch-border px-2 py-2">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-vatch-muted hover:bg-vatch-border cursor-pointer">
          <span className="w-4 text-center">👤</span>
          <span>山田 太郎</span>
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx jest Sidebar.test --no-coverage
```

Expected: PASS

- [ ] **Step 5: Verify in browser**

```bash
npm run dev
```

Expected: Sidebar visible with logo, nav sections, "ダッシュボード" highlighted in cyan

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/Sidebar.test.tsx
git commit -m "feat: add Sidebar navigation component"
```

---

### Task 6: Topbar component

**Files:**
- Create: `src/components/layout/Topbar.tsx`
- Create: `src/components/layout/Topbar.test.tsx`

- [ ] **Step 1: Write Topbar test**

Create `src/components/layout/Topbar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { Topbar } from './Topbar'

test('renders page title', () => {
  render(<Topbar title="Vatch Dashboard" />)
  expect(screen.getByText('Vatch Dashboard')).toBeInTheDocument()
})

test('renders LIVE indicator', () => {
  render(<Topbar title="Vatch Dashboard" />)
  expect(screen.getByText('LIVE')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest Topbar.test --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Create Topbar component**

Create `src/components/layout/Topbar.tsx`:

```tsx
type TopbarProps = {
  title: string
  subtitle?: string
}

export function Topbar({ title, subtitle }: TopbarProps) {
  const today = new Date().toISOString().split('T')[0]

  return (
    <header className="h-[52px] flex-shrink-0 flex items-center gap-3 px-5 bg-vatch-surface border-b border-vatch-border">
      <div>
        <span className="text-sm font-bold text-vatch-text-bright">{title}</span>
        {subtitle && (
          <span className="ml-2 text-[11px] text-vatch-muted-dark">{subtitle}</span>
        )}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-green-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          LIVE
        </div>
        <span className="text-[11px] text-vatch-muted-dark">{today}</span>
        <div className="w-7 h-7 rounded-full bg-vatch-border-light flex items-center justify-center text-[10px] text-vatch-cyan font-bold">
          山
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx jest Topbar.test --no-coverage
```

Expected: PASS

- [ ] **Step 5: Add Topbar to dashboard page**

Update `src/app/dashboard/page.tsx`:

```tsx
import { Topbar } from '@/components/layout/Topbar'

export default function DashboardPage() {
  return (
    <>
      <Topbar title="Vatch Dashboard" subtitle="VICENT SES管理プラットフォーム" />
      <main className="flex-1 overflow-y-auto p-5">
        <p className="text-vatch-muted">Dashboard loading...</p>
      </main>
    </>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Topbar.tsx src/components/layout/Topbar.test.tsx src/app/dashboard/page.tsx
git commit -m "feat: add Topbar with LIVE indicator"
```

---

## Chunk 3: Dashboard Components

### Task 7: KpiCard component

**Files:**
- Create: `src/components/dashboard/KpiCard.tsx`
- Create: `src/components/dashboard/KpiCard.test.tsx`

- [ ] **Step 1: Write KpiCard test**

Create `src/components/dashboard/KpiCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { KpiCard } from './KpiCard'

const base = { id: '1', value: 12, label: '本日受信案件', change: '↑ 3件', color: 'blue' as const }

test('renders value and label', () => {
  render(<KpiCard {...base} />)
  expect(screen.getByText('12')).toBeInTheDocument()
  expect(screen.getByText('本日受信案件')).toBeInTheDocument()
})

test('renders change text', () => {
  render(<KpiCard {...base} />)
  expect(screen.getByText('↑ 3件')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest KpiCard.test --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Create KpiCard component**

Create `src/components/dashboard/KpiCard.tsx`:

```tsx
import type { KpiItem } from '@/types'

const colorMap = {
  blue:  { bar: 'from-sky-600 to-sky-400',       val: 'text-sky-400'   },
  green: { bar: 'from-emerald-600 to-green-400',  val: 'text-green-400' },
  amber: { bar: 'from-amber-600 to-amber-400',    val: 'text-amber-400' },
  red:   { bar: 'from-red-600 to-red-400',        val: 'text-red-400'   },
}

export function KpiCard({ value, label, change, color }: KpiItem) {
  const c = colorMap[color]
  return (
    <div className="relative bg-vatch-surface border border-vatch-border rounded-lg p-3 overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${c.bar}`} />
      <div className={`text-[22px] font-black leading-none font-mono ${c.val}`}>{value}</div>
      <div className="text-[9px] text-vatch-muted uppercase tracking-wider mt-1">{label}</div>
      <div className="text-[10px] font-semibold mt-1 text-vatch-text-dim">{change}</div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx jest KpiCard.test --no-coverage
```

Expected: PASS

- [ ] **Step 5: Add KPI row to dashboard**

Update `src/app/dashboard/page.tsx`:

```tsx
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { kpiItems } from '@/data/dashboard'

export default function DashboardPage() {
  return (
    <>
      <Topbar title="Vatch Dashboard" subtitle="VICENT SES管理プラットフォーム" />
      <main className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        <div className="grid grid-cols-6 gap-2.5">
          {kpiItems.map((item) => <KpiCard key={item.id} {...item} />)}
        </div>
      </main>
    </>
  )
}
```

- [ ] **Step 6: Verify in browser — KPI row visible**

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/KpiCard.tsx src/components/dashboard/KpiCard.test.tsx src/app/dashboard/page.tsx
git commit -m "feat: add KpiCard component and KPI row"
```

---

### Task 8: MatchingPanel + AutoSendQueue

**Files:**
- Create: `src/components/dashboard/MatchingPanel.tsx`
- Create: `src/components/dashboard/MatchingPanel.test.tsx`
- Create: `src/components/dashboard/AutoSendQueue.tsx`
- Create: `src/components/dashboard/AutoSendQueue.test.tsx`

- [ ] **Step 1: Write MatchingPanel test**

Create `src/components/dashboard/MatchingPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MatchingPanel } from './MatchingPanel'
import { matchingCandidates } from '@/data/dashboard'

test('renders all candidates', () => {
  render(<MatchingPanel candidates={matchingCandidates} />)
  expect(screen.getByText('田中 K.')).toBeInTheDocument()
  expect(screen.getByText('佐藤 M.')).toBeInTheDocument()
})

test('shows gross profit warning for low-margin candidates', () => {
  render(<MatchingPanel candidates={matchingCandidates} />)
  expect(screen.getByText('粗利△')).toBeInTheDocument()
})
```

- [ ] **Step 2: Write AutoSendQueue test**

Create `src/components/dashboard/AutoSendQueue.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { AutoSendQueue } from './AutoSendQueue'
import { autoSendQueue } from '@/data/dashboard'

test('renders all queue items', () => {
  render(<AutoSendQueue items={autoSendQueue} />)
  expect(screen.getByText(/Java × 田中/)).toBeInTheDocument()
})

test('shows amber color for sub-10% gross profit rate', () => {
  render(<AutoSendQueue items={autoSendQueue} />)
  const rate = screen.getByText('9.8%')
  expect(rate.className).toMatch(/amber|yellow/)
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx jest MatchingPanel.test AutoSendQueue.test --no-coverage
```

Expected: FAIL

- [ ] **Step 4: Create MatchingPanel**

Create `src/components/dashboard/MatchingPanel.tsx`:

```tsx
import type { MatchingCandidate } from '@/types'

const skillColors: Record<string, string> = {
  blue:   'bg-[#1e3a5f] text-sky-400',
  cyan:   'bg-[#1a2e45] text-blue-400',
  purple: 'bg-[#2d1e3a] text-purple-400',
  green:  'bg-[#1a3a2e] text-green-400',
}

type Props = { candidates: MatchingCandidate[] }

export function MatchingPanel({ candidates }: Props) {
  return (
    <div className="bg-vatch-surface border border-vatch-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-vatch-border bg-[#090f1f]">
        <span className="w-1.5 h-1.5 rounded-full bg-vatch-cyan" />
        <span className="text-[11px] font-bold text-vatch-text-dim uppercase tracking-widest">AIマッチング候補</span>
        <span className="ml-auto text-[10px] text-vatch-cyan font-semibold bg-[#0c2d5a] px-2 py-0.5 rounded">
          {candidates.length}件
        </span>
      </div>
      <div>
        {candidates.map((c) => (
          <div key={c.id} className="flex items-center gap-2.5 px-3.5 py-2 border-b border-[#090f20] hover:bg-[#0b1628] transition-colors last:border-none">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${skillColors[c.skillColor] ?? skillColors.blue}`}>
              {c.skill}
            </span>
            <span className="text-[11px] text-slate-300 w-16 truncate">{c.talentName}</span>
            <span className="text-[10px] text-vatch-muted flex-1 truncate">{c.caseName}</span>
            <div className="w-14">
              <div className="w-full h-[3px] bg-vatch-border rounded overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${c.score}%`,
                    background: c.score >= 85
                      ? 'linear-gradient(90deg,#38bdf8,#4ade80)'
                      : c.score >= 70
                      ? 'linear-gradient(90deg,#3b82f6,#38bdf8)'
                      : 'linear-gradient(90deg,#7c3aed,#a78bfa)',
                  }}
                />
              </div>
            </div>
            <span className={`text-[11px] font-black w-8 text-right ${
              c.score >= 85 ? 'text-green-400' : c.score >= 70 ? 'text-sky-400' : 'text-purple-400'
            }`}>
              {c.score}%
            </span>
            <span className={`text-[9px] font-semibold w-10 ${c.grossProfitOk ? 'text-green-400' : 'text-amber-400'}`}>
              {c.grossProfitOk ? '粗利✓' : '粗利△'}
            </span>
            <button className="text-[9px] px-2 py-1 rounded border border-vatch-border-light text-vatch-cyan font-semibold hover:bg-[#0c2d5a] transition-colors">
              提案
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create AutoSendQueue**

Create `src/components/dashboard/AutoSendQueue.tsx`:

```tsx
import type { AutoSendItem } from '@/types'

const statusConfig = {
  auto:  { label: '自動',   className: 'bg-green-900 text-green-400' },
  check: { label: '要確認', className: 'bg-amber-900 text-amber-400' },
  draft: { label: '下書き', className: 'bg-[#1e3a5f] text-sky-400'  },
}

type Props = { items: AutoSendItem[] }

export function AutoSendQueue({ items }: Props) {
  return (
    <div className="bg-vatch-surface border border-vatch-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-vatch-border bg-[#090f1f]">
        <span className="w-1.5 h-1.5 rounded-full bg-vatch-amber" />
        <span className="text-[11px] font-bold text-vatch-text-dim uppercase tracking-widest">自動送信キュー</span>
        <span className="ml-auto text-[10px] text-vatch-amber font-semibold bg-amber-900/40 px-2 py-0.5 rounded">
          {items.length}件
        </span>
      </div>
      <div>
        {items.map((item) => {
          const st = statusConfig[item.status]
          const isLow = item.grossProfitRate < 10
          return (
            <div key={item.id} className="flex items-center gap-2.5 px-3.5 py-2 border-b border-[#090f20] last:border-none">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${st.className}`}>
                {st.label}
              </span>
              <span className="text-[11px] text-slate-300 flex-1 truncate">{item.label}</span>
              <span className={`text-[11px] font-black ${isLow ? 'text-amber-400' : 'text-green-400'}`}>
                {item.grossProfitRate}%
              </span>
            </div>
          )
        })}
      </div>
      <div className="p-3">
        <button className="w-full py-2 rounded-md bg-gradient-to-r from-sky-700 to-sky-600 text-white text-[11px] font-bold hover:from-sky-600 hover:to-sky-500 transition-all">
          ⚡ 一括確認・送信
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
npx jest MatchingPanel.test AutoSendQueue.test --no-coverage
```

Expected: PASS

- [ ] **Step 7: Add 2-column row to dashboard**

Update `src/app/dashboard/page.tsx`:

```tsx
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { MatchingPanel } from '@/components/dashboard/MatchingPanel'
import { AutoSendQueue } from '@/components/dashboard/AutoSendQueue'
import { kpiItems, matchingCandidates, autoSendQueue } from '@/data/dashboard'

export default function DashboardPage() {
  return (
    <>
      <Topbar title="Vatch Dashboard" subtitle="VICENT SES管理プラットフォーム" />
      <main className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        <div className="grid grid-cols-6 gap-2.5">
          {kpiItems.map((item) => <KpiCard key={item.id} {...item} />)}
        </div>
        <div className="grid grid-cols-[1.4fr_1fr] gap-3.5">
          <MatchingPanel candidates={matchingCandidates} />
          <AutoSendQueue items={autoSendQueue} />
        </div>
      </main>
    </>
  )
}
```

- [ ] **Step 8: Verify in browser — 2-column row visible**

- [ ] **Step 9: Commit**

```bash
git add src/components/dashboard/MatchingPanel.tsx src/components/dashboard/MatchingPanel.test.tsx src/components/dashboard/AutoSendQueue.tsx src/components/dashboard/AutoSendQueue.test.tsx src/app/dashboard/page.tsx
git commit -m "feat: add MatchingPanel and AutoSendQueue components"
```

---

### Task 9: AlertPanel + PipelinePanel + ActivityLog

**Files:**
- Create: `src/components/dashboard/AlertPanel.tsx`
- Create: `src/components/dashboard/AlertPanel.test.tsx`
- Create: `src/components/dashboard/PipelinePanel.tsx`
- Create: `src/components/dashboard/PipelinePanel.test.tsx`
- Create: `src/components/dashboard/ActivityLog.tsx`
- Create: `src/components/dashboard/ActivityLog.test.tsx`

- [ ] **Step 1: Write AlertPanel test**

Create `src/components/dashboard/AlertPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { AlertPanel } from './AlertPanel'
import { alerts } from '@/data/dashboard'

test('renders all alerts', () => {
  render(<AlertPanel items={alerts} />)
  expect(screen.getByText(/契約更新/)).toBeInTheDocument()
  expect(screen.getByText(/返答待ち超過/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Write PipelinePanel test**

Create `src/components/dashboard/PipelinePanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { PipelinePanel } from './PipelinePanel'
import { pipeline } from '@/data/dashboard'

test('renders all pipeline stages', () => {
  render(<PipelinePanel items={pipeline} />)
  expect(screen.getByText('面談調整中')).toBeInTheDocument()
  expect(screen.getByText('稼働中')).toBeInTheDocument()
})
```

- [ ] **Step 3: Write ActivityLog test**

Create `src/components/dashboard/ActivityLog.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { ActivityLog } from './ActivityLog'
import { activityLog } from '@/data/dashboard'

test('renders activity entries with timestamps', () => {
  render(<ActivityLog items={activityLog} />)
  expect(screen.getByText('09:42')).toBeInTheDocument()
  expect(screen.getByText('AI解析完了')).toBeInTheDocument()
})
```

- [ ] **Step 4: Run tests to confirm they fail**

```bash
npx jest AlertPanel.test PipelinePanel.test ActivityLog.test --no-coverage
```

Expected: FAIL

- [ ] **Step 5: Create AlertPanel**

Create `src/components/dashboard/AlertPanel.tsx`:

```tsx
import type { AlertItem } from '@/types'

type Props = { items: AlertItem[] }

export function AlertPanel({ items }: Props) {
  return (
    <div className="bg-vatch-surface border border-vatch-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-vatch-border bg-[#090f1f]">
        <span className="w-1.5 h-1.5 rounded-full bg-vatch-red" />
        <span className="text-[11px] font-bold text-vatch-text-dim uppercase tracking-widest">要対応アラート</span>
      </div>
      <div>
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2.5 px-3.5 py-2 border-b border-[#090f20] last:border-none">
            <span className="text-xs">{item.icon}</span>
            <span className="text-[11px] text-slate-300 flex-1">{item.message}</span>
            <span className="text-[10px] text-vatch-muted">{item.date}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create PipelinePanel**

Create `src/components/dashboard/PipelinePanel.tsx`:

```tsx
import type { PipelineItem } from '@/types'

type Props = { items: PipelineItem[] }

export function PipelinePanel({ items }: Props) {
  return (
    <div className="bg-vatch-surface border border-vatch-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-vatch-border bg-[#090f1f]">
        <span className="w-1.5 h-1.5 rounded-full bg-vatch-purple" />
        <span className="text-[11px] font-bold text-vatch-text-dim uppercase tracking-widest">営業パイプライン</span>
      </div>
      <div className="px-3.5 py-1">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2.5 py-2 border-b border-[#090f20] last:border-none">
            <span className="text-[10px] text-vatch-muted w-[72px] flex-shrink-0">{item.label}</span>
            <div className="flex-1 h-1.5 bg-vatch-border rounded overflow-hidden">
              <div
                className="h-full rounded transition-all"
                style={{ width: `${item.percentage}%`, background: item.color }}
              />
            </div>
            <span className="text-[11px] font-black w-6 text-right" style={{ color: item.color }}>
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Create ActivityLog**

Create `src/components/dashboard/ActivityLog.tsx`:

```tsx
import type { ActivityItem } from '@/types'

type Props = { items: ActivityItem[] }

export function ActivityLog({ items }: Props) {
  return (
    <div className="bg-vatch-surface border border-vatch-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-vatch-border bg-[#090f1f]">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
        <span className="text-[11px] font-bold text-vatch-text-dim uppercase tracking-widest">最近の活動</span>
      </div>
      <div>
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-2.5 px-3.5 py-2 border-b border-[#090f20] last:border-none">
            <span className="text-[10px] text-vatch-muted-dark w-9 flex-shrink-0 font-mono mt-0.5">{item.time}</span>
            <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: item.color }} />
            <span className="text-[10px] text-vatch-muted leading-relaxed">
              {item.text}<strong className="text-vatch-text-dim">{item.highlight}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Run tests to confirm they pass**

```bash
npx jest AlertPanel.test PipelinePanel.test ActivityLog.test --no-coverage
```

Expected: PASS

- [ ] **Step 9: Assemble final dashboard page**

Replace `src/app/dashboard/page.tsx` with final version:

```tsx
import { Topbar } from '@/components/layout/Topbar'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { MatchingPanel } from '@/components/dashboard/MatchingPanel'
import { AutoSendQueue } from '@/components/dashboard/AutoSendQueue'
import { AlertPanel } from '@/components/dashboard/AlertPanel'
import { PipelinePanel } from '@/components/dashboard/PipelinePanel'
import { ActivityLog } from '@/components/dashboard/ActivityLog'
import {
  kpiItems, matchingCandidates, autoSendQueue,
  alerts, pipeline, activityLog,
} from '@/data/dashboard'

export default function DashboardPage() {
  return (
    <>
      <Topbar title="Vatch Dashboard" subtitle="VICENT SES管理プラットフォーム" />
      <main className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        <div className="grid grid-cols-6 gap-2.5">
          {kpiItems.map((item) => <KpiCard key={item.id} {...item} />)}
        </div>
        <div className="grid grid-cols-[1.4fr_1fr] gap-3.5">
          <MatchingPanel candidates={matchingCandidates} />
          <AutoSendQueue items={autoSendQueue} />
        </div>
        <div className="grid grid-cols-3 gap-3.5">
          <AlertPanel items={alerts} />
          <PipelinePanel items={pipeline} />
          <ActivityLog items={activityLog} />
        </div>
      </main>
    </>
  )
}
```

- [ ] **Step 10: Run all tests**

```bash
npx jest --no-coverage
```

Expected: All PASS

- [ ] **Step 11: Final browser verification**

```bash
npm run dev
```

Expected: `http://localhost:3000` → ダッシュボードが完全表示。KPI6枚 + 2カラム + 3カラム。役員説明可能な状態。

- [ ] **Step 12: Final commit**

```bash
git add src/components/dashboard/ src/app/dashboard/page.tsx
git commit -m "feat: complete Vatch dashboard Phase 1 mock"
```

---

## Done ✓

`npm run dev` → `http://localhost:3000` → Vatch Dashboardが表示される。

**次フェーズの追加画面（同パターンで拡張）:**
1. `/emails` — メール取込一覧
2. `/matching` — マッチング一覧
3. `/proposals` — 提案メール確認画面（最重要）
4. `/cases` / `/talents` — 案件・人材詳細
