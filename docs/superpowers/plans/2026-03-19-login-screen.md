# ログイン画面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ログイン画面（グリッド背景＋カード）を実装し、NextAuth.js v5 で認証・ルート保護を完成させる。

**Architecture:** Next.js Route Groups を使用して `(auth)` と `(main)` に分離。`(auth)/login/page.tsx` はサイドバーなし、`(main)` 配下の既存ページはサイドバーあり。`src/middleware.ts` で未認証ユーザーを `/login` にリダイレクト。

**Tech Stack:** Next.js 15 App Router, NextAuth.js v5 (Auth.js), TypeScript, Tailwind CSS, Jest + @testing-library/react

---

## ファイルマップ

| ファイル | 操作 | 役割 |
|---|---|---|
| `src/app/layout.tsx` | 変更 | html/body のみ（`bg-vatch-bg text-vatch-text`）残す |
| `src/app/(main)/layout.tsx` | 新規（移動元: `src/app/layout.tsx`） | `flex h-screen overflow-hidden` + Sidebar |
| `src/app/(main)/dashboard/page.tsx` | 移動 | `src/app/dashboard/page.tsx` から |
| `src/app/(main)/cases/page.tsx` | 移動 | 同上パターン |
| `src/app/(main)/talents/page.tsx` | 移動 | 同上パターン |
| `src/app/(main)/matching/page.tsx` | 移動 | 同上パターン |
| `src/app/(main)/proposals/page.tsx` | 移動 | 同上パターン |
| `src/app/(main)/emails/page.tsx` | 移動 | 同上パターン |
| `src/app/(main)/progress/page.tsx` | 移動 | 同上パターン |
| `src/app/(main)/contracts/page.tsx` | 移動 | 同上パターン |
| `src/app/(main)/settings/page.tsx` | 移動 | 同上パターン |
| `src/app/(auth)/layout.tsx` | 新規 | サイドバーなし全画面 |
| `src/app/(auth)/login/page.tsx` | 新規 | ログインフォーム（Client Component） |
| `src/app/(auth)/login/page.test.tsx` | 新規 | ログインページのテスト |
| `src/middleware.ts` | 新規 | 未認証リダイレクト |

---

## Task 1: Route Groups 構造への移行

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/app/(main)/layout.tsx`
- Move: `src/app/dashboard/page.tsx` → `src/app/(main)/dashboard/page.tsx`（および他8ページ）

- [ ] **Step 1: (main) ディレクトリと各ページフォルダを作成**

```bash
mkdir -p src/app/\(main\)/dashboard
mkdir -p src/app/\(main\)/cases
mkdir -p src/app/\(main\)/talents
mkdir -p src/app/\(main\)/matching
mkdir -p src/app/\(main\)/proposals
mkdir -p src/app/\(main\)/emails
mkdir -p src/app/\(main\)/progress
mkdir -p src/app/\(main\)/contracts
mkdir -p src/app/\(main\)/settings
```

- [ ] **Step 2: 既存ページを (main) 配下にコピー**

```bash
cp src/app/dashboard/page.tsx src/app/\(main\)/dashboard/page.tsx
cp src/app/cases/page.tsx src/app/\(main\)/cases/page.tsx
cp src/app/talents/page.tsx src/app/\(main\)/talents/page.tsx
cp src/app/matching/page.tsx src/app/\(main\)/matching/page.tsx
cp src/app/proposals/page.tsx src/app/\(main\)/proposals/page.tsx
cp src/app/emails/page.tsx src/app/\(main\)/emails/page.tsx
cp src/app/progress/page.tsx src/app/\(main\)/progress/page.tsx
cp src/app/contracts/page.tsx src/app/\(main\)/contracts/page.tsx
cp src/app/settings/page.tsx src/app/\(main\)/settings/page.tsx
```

- [ ] **Step 3: `src/app/(main)/layout.tsx` を作成**

既存 `src/app/layout.tsx` の内容（Sidebar付き）を `(main)/layout.tsx` に移植する。ただし `<body>` タグは使わず、`<div>` ラッパーに変える。

```tsx
// src/app/(main)/layout.tsx
import { Sidebar } from '@/components/layout/Sidebar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: ルート `src/app/layout.tsx` を簡略化**

`<body>` に `bg-vatch-bg text-vatch-text` のみ残し、Sidebar を削除する。

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vatch — VICENT SES管理プラットフォーム',
  description: 'SES営業の提案活動を効率化するプラットフォーム',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-vatch-bg text-vatch-text">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 5: ビルドが通ることを確認**

```bash
npm run build
```

期待: エラーなし。既存ページが両方のパスで参照されている状態（次のステップで旧パスを削除）。

- [ ] **Step 6: 旧ページフォルダを削除**

```bash
rm -rf src/app/dashboard
rm -rf src/app/cases
rm -rf src/app/talents
rm -rf src/app/matching
rm -rf src/app/proposals
rm -rf src/app/emails
rm -rf src/app/progress
rm -rf src/app/contracts
rm -rf src/app/settings
```

- [ ] **Step 7: 再ビルドして正常動作を確認**

```bash
npm run build
```

期待: エラーなし。

- [ ] **Step 8: テストが通ることを確認**

```bash
npm test
```

期待: 既存テストがすべて PASS。

- [ ] **Step 9: コミット**

```bash
git add src/app/
git commit -m "refactor: Route Groups導入 - (main)にページを移動"
```

---

## Task 2: `(auth)` レイアウトと middleware の作成

**Files:**
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/middleware.ts`

- [ ] **Step 1: `src/app/(auth)/layout.tsx` を作成**

```tsx
// src/app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

- [ ] **Step 2: `src/middleware.ts` を作成**

```ts
// src/middleware.ts
export { auth as middleware } from '@/lib/auth'

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login).*)'],
}
```

- [ ] **Step 3: ビルドが通ることを確認**

```bash
npm run build
```

期待: エラーなし。

- [ ] **Step 4: コミット**

```bash
git add src/app/\(auth\)/layout.tsx src/middleware.ts
git commit -m "feat: (auth)レイアウトとmiddlewareを追加"
```

---

## Task 3: ログインページの実装（TDD）

**Files:**
- Create: `src/app/(auth)/login/page.test.tsx`
- Create: `src/app/(auth)/login/page.tsx`

### Step 1-4: テストを書いて失敗確認

- [ ] **Step 1: `src/app/(auth)/login/` ディレクトリを作成**

```bash
mkdir -p src/app/\(auth\)/login
```

- [ ] **Step 2: テストファイルを作成**

```tsx
// src/app/(auth)/login/page.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from './page'

const mockSignIn = jest.fn()
const mockPush = jest.fn()

jest.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

beforeEach(() => {
  mockSignIn.mockReset()
  mockPush.mockReset()
})

test('VATCHロゴとログインフォームが表示される', () => {
  render(<LoginPage />)
  expect(screen.getByText('VATCH')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('yamada@vicent.co.jp')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /ログイン/ })).toBeInTheDocument()
  expect(screen.getByText('パスワードをお忘れですか？')).toBeInTheDocument()
})

test('メール未入力でサブミットするとエラーが表示される', async () => {
  render(<LoginPage />)
  fireEvent.click(screen.getByRole('button', { name: /ログイン/ }))
  expect(await screen.findByText('メールアドレスを入力してください')).toBeInTheDocument()
  expect(mockSignIn).not.toHaveBeenCalled()
})

test('パスワード未入力でサブミットするとエラーが表示される', async () => {
  render(<LoginPage />)
  fireEvent.change(screen.getByPlaceholderText('yamada@vicent.co.jp'), {
    target: { value: 'test@example.com' },
  })
  fireEvent.click(screen.getByRole('button', { name: /ログイン/ }))
  expect(await screen.findByText('パスワードを入力してください')).toBeInTheDocument()
  expect(mockSignIn).not.toHaveBeenCalled()
})

test('ログイン成功時に /dashboard へ遷移する', async () => {
  mockSignIn.mockResolvedValueOnce(undefined)
  render(<LoginPage />)
  fireEvent.change(screen.getByPlaceholderText('yamada@vicent.co.jp'), {
    target: { value: 'yamada@vicent.co.jp' },
  })
  fireEvent.change(screen.getByPlaceholderText('••••••••'), {
    target: { value: 'password123' },
  })
  fireEvent.click(screen.getByRole('button', { name: /ログイン/ }))
  await waitFor(() => {
    expect(mockSignIn).toHaveBeenCalledWith('credentials', {
      email: 'yamada@vicent.co.jp',
      password: 'password123',
      redirect: false,
    })
    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })
})

test('認証失敗時にエラーメッセージが表示される', async () => {
  mockSignIn.mockRejectedValueOnce(new Error('CredentialsSignin'))
  render(<LoginPage />)
  fireEvent.change(screen.getByPlaceholderText('yamada@vicent.co.jp'), {
    target: { value: 'wrong@example.com' },
  })
  fireEvent.change(screen.getByPlaceholderText('••••••••'), {
    target: { value: 'wrongpass' },
  })
  fireEvent.click(screen.getByRole('button', { name: /ログイン/ }))
  expect(
    await screen.findByText('メールアドレスまたはパスワードが正しくありません')
  ).toBeInTheDocument()
})
```

- [ ] **Step 3: テストが FAIL することを確認**

```bash
npm test -- src/app/\\(auth\\)/login/page.test.tsx
```

期待: `Cannot find module './page'` または類似エラーで FAIL。

### Step 4-7: 実装してテスト通過

- [ ] **Step 4: `src/app/(auth)/login/page.tsx` を実装**

```tsx
// src/app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type Errors = {
  email?: string
  password?: string
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // クライアントサイドバリデーション
    const newErrors: Errors = {}
    if (!email) newErrors.email = 'メールアドレスを入力してください'
    if (!password) newErrors.password = 'パスワードを入力してください'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsLoading(true)
    setErrors({})

    try {
      await signIn('credentials', { email, password, redirect: false })
      router.push('/dashboard')
    } catch {
      setErrors({ password: 'メールアドレスまたはパスワードが正しくありません' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-vatch-bg flex items-center justify-center px-4">
      {/* グリッド背景 */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(#0f2444 1px, transparent 1px), linear-gradient(90deg, #0f2444 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          opacity: 0.35,
        }}
      />
      {/* シアングロー */}
      <div
        className="fixed pointer-events-none"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '400px',
          background: 'radial-gradient(ellipse, rgba(56,189,248,0.04) 0%, transparent 70%)',
        }}
      />

      {/* ロゴ + カード */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        {/* ロゴ（カード枠線の上） */}
        <div className="text-center mb-5">
          <div className="text-[26px] font-black text-vatch-amber tracking-[8px]">VATCH</div>
          <div className="text-[9px] text-vatch-muted-dark tracking-[3px] mt-1">VICENT SES</div>
        </div>

        {/* カード */}
        <div
          className="w-full rounded-xl border border-vatch-border p-9"
          style={{
            background: 'rgba(8,15,30,0.92)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 0 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(56,189,248,0.05)',
          }}
        >
          <h1 className="text-xl font-bold text-vatch-text-bright text-center mb-1">ログイン</h1>
          <p className="text-xs text-vatch-muted text-center mb-7">Vatch アカウントにサインイン</p>

          <form onSubmit={handleSubmit} noValidate>
            {/* メールアドレス */}
            <div className="mb-5">
              <label className="block text-[11px] text-vatch-text-dim mb-1.5">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yamada@vicent.co.jp"
                className={`w-full bg-[#0c1a2e] border rounded-md px-3.5 py-2.5 text-sm text-vatch-text outline-none transition-colors ${
                  errors.email
                    ? 'border-vatch-red focus:border-vatch-red'
                    : 'border-vatch-border focus:border-vatch-cyan'
                }`}
                style={{ boxShadow: errors.email ? 'none' : undefined }}
              />
              {errors.email && (
                <p className="mt-1.5 text-[10px] text-vatch-red">⚠ {errors.email}</p>
              )}
            </div>

            {/* パスワード */}
            <div className="mb-6">
              <label className="block text-[11px] text-vatch-text-dim mb-1.5">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full bg-[#0c1a2e] border rounded-md px-3.5 py-2.5 text-sm text-vatch-text outline-none transition-colors ${
                  errors.password
                    ? 'border-vatch-red focus:border-vatch-red'
                    : 'border-vatch-border focus:border-vatch-cyan'
                }`}
              />
              {errors.password && (
                <p className="mt-1.5 text-[10px] text-vatch-red">⚠ {errors.password}</p>
              )}
            </div>

            {/* ログインボタン */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-md py-2.5 text-sm font-bold text-white tracking-wide transition-opacity disabled:opacity-60"
              style={{ background: 'linear-gradient(90deg, #0284c7, #38bdf8)' }}
            >
              {isLoading ? 'ログイン中...' : 'ログイン →'}
            </button>
          </form>

          {/* パスワードを忘れた場合 */}
          <p className="text-center mt-4 text-[11px] text-vatch-muted">
            <a href="#" className="text-vatch-cyan opacity-70 hover:opacity-100 transition-opacity">
              パスワードをお忘れですか？
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: テストを実行して PASS を確認**

```bash
npm test -- src/app/\\(auth\\)/login/page.test.tsx
```

期待: 5件のテストがすべて PASS。

- [ ] **Step 6: 全テストが引き続き通ることを確認**

```bash
npm test
```

期待: 全テスト PASS。

- [ ] **Step 7: ビルドが通ることを確認**

```bash
npm run build
```

期待: エラーなし。

- [ ] **Step 8: コミット**

```bash
git add src/app/\(auth\)/
git commit -m "feat: ログイン画面を実装（TDD）"
```

---

## Task 4: 動作確認とスクリーンショット

- [ ] **Step 1: 開発サーバーを起動**

```bash
npm run dev
```

- [ ] **Step 2: 未認証で /dashboard にアクセスし、/login にリダイレクトされることを確認**

ブラウザで `http://localhost:3000/dashboard` を開く。
期待: `/login` に自動リダイレクトされる。

- [ ] **Step 3: シードユーザーでログインできることを確認**

- メール: `yamada@vicent.co.jp`
- パスワード: 任意の文字列（Phase 2 はパスワード検証なし）
- 期待: `/dashboard` に遷移する。

- [ ] **Step 4: スクリーンショット撮影（Playwright）**

Playwright でログイン画面のスクリーンショットを撮って確認する。

- [ ] **Step 5: 最終コミットと push**

```bash
git add -A
git commit -m "feat: ログイン画面完成 - Route Groups + middleware + UI"
git push origin master
```
