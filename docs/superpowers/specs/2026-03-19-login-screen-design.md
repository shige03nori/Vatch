# ログイン画面 設計書

**日付:** 2026-03-19
**ステータス:** 承認済み

---

## 概要

Vatch（VICENT SES管理プラットフォーム）のログイン画面を実装する。NextAuth.js v5（Credentials Provider + JWT）は既に設定済みであり、UI層・ルート保護の実装が対象。

---

## デザイン仕様

### ビジュアル
- **背景:** グリッド模様（`#0f2444` 32px グリッド、opacity 0.35）+ 中央にシアンの微細グロー
- **ロゴ:** カード枠線の上に `VATCH`（amber、font-size 26px、letter-spacing 8px）+ `VICENT SES`（muted、9px）
- **カード:** `rgba(8,15,30,0.92)` + `border: 1px solid #0f2444` + `border-radius: 12px` + `backdrop-filter: blur(12px)`
- **フォーム要素:** メールアドレス・パスワードの2フィールド
- **ボタン:** グラデーション（`#0284c7 → #38bdf8`）「ログイン →」
- **エラー表示:** 各フィールド下にインライン（`⚠ メッセージ`、`#f87171`）
- **フッターリンク:** 「パスワードをお忘れですか？」（`#38bdf8`、opacity 0.7）

### カラーパレット（既存 Tailwind テーマ準拠）
| 用途 | 値 |
|---|---|
| 背景 | `vatch-bg` (#060d1a) |
| カード | `vatch-surface` (#080f1e) |
| ボーダー | `vatch-border` (#0f2444) |
| シアン | `vatch-cyan` (#38bdf8) |
| アンバー | `vatch-amber` (#f59e0b) |
| エラー | `vatch-red` (#f87171) |
| ミュート | `vatch-muted` (#64748b) |

---

## アーキテクチャ

### Route Groups 構成

```
src/app/
  (auth)/
    layout.tsx          ← サイドバーなし・最小レイアウト（新規）
    login/
      page.tsx          ← ログインフォーム Client Component（新規）
  (main)/
    layout.tsx          ← 既存 layout.tsx を移動（Sidebar あり）
    dashboard/page.tsx
    cases/page.tsx
    talents/page.tsx
    matching/page.tsx
    proposals/page.tsx
    emails/page.tsx
    progress/page.tsx
    contracts/page.tsx
    settings/page.tsx
  api/
    auth/[...nextauth]/route.ts  ← そのまま（移動不要）
  page.tsx              ← / → /dashboard リダイレクト（そのまま）
  globals.css
  favicon.ico
  layout.tsx            ← ルート layout（html/body のみに簡略化）
```

**Route Groups を採用する理由:** Next.js App Router では `(groupName)` フォルダがURLに影響せず、異なる layout を適用できる。サイドバーを条件分岐で出し分けるより明確でテスタブル。

### ファイル一覧

| ファイル | 新規/変更 | 役割 |
|---|---|---|
| `src/middleware.ts` | 新規 | 未認証ユーザーを `/login` へリダイレクト |
| `src/app/(auth)/layout.tsx` | 新規 | サイドバーなし・全画面レイアウト |
| `src/app/(auth)/login/page.tsx` | 新規 | ログインフォーム |
| `src/app/(main)/layout.tsx` | 移動 | 既存 `src/app/layout.tsx` を移動 |
| `src/app/layout.tsx` | 変更 | html/body の基盤のみ残す |
| 既存8ページ | 移動 | `src/app/` → `src/app/(main)/` 配下へ |

---

## 認証フロー

```
未認証ユーザー
  → 任意のページアクセス
  → middleware.ts が /login へリダイレクト

ログインページ
  → メール・パスワード入力 → 「ログイン →」ボタン
  → signIn('credentials', { email, password, redirect: false })
  → 成功: router.push('/dashboard')
  → 失敗: フィールドごとにエラーメッセージ表示

認証済みユーザー
  → /login にアクセスした場合 → /dashboard へリダイレクト
```

---

## コンポーネント設計

### `src/app/(auth)/login/page.tsx`

- `'use client'`
- `useState` で `email`, `password`, `errors`, `isLoading` を管理
- `signIn` は `next-auth/react` からインポート
- `errors` の型: `{ email?: string; password?: string }`
- バリデーション: 空フィールドチェック（クライアント側）、認証失敗はサーバー側エラーをパスワードフィールド下に表示
- `isLoading` 中はボタンを disabled にして「ログイン中...」表示

### `src/middleware.ts`

```ts
export { auth as middleware } from '@/lib/auth'
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login).*)'],
}
```

NextAuth v5 の `auth` を middleware として使用。`/login`・静的ファイル・APIルートは除外。

---

## エラーハンドリング

| ケース | 表示場所 | メッセージ |
|---|---|---|
| メール未入力 | メールフィールド下 | 「メールアドレスを入力してください」 |
| パスワード未入力 | パスワードフィールド下 | 「パスワードを入力してください」 |
| 認証失敗 | パスワードフィールド下 | 「メールアドレスまたはパスワードが正しくありません」 |

---

## 対象外（スコープ外）

- パスワードリセット機能の実装（リンクは表示するが遷移先は未実装）
- bcrypt によるパスワードハッシュ検証（Phase 3 で対応予定）
- OAuth プロバイダー（Phase 3 で対応予定）
