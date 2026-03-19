# API 設計書

**日付:** 2026-03-19
**ステータス:** 承認済み

---

## 概要

Vatch の全ビジネスリソース（Case/Talent/Matching/Proposal/Contract/Email）に対して、Next.js App Router の Route Handler を使ったフル CRUD API を実装する。認証は NextAuth.js v5 セッション、認可はロールベース（ADMIN/STAFF）、バリデーションは Zod を使用する。

---

## アーキテクチャ

### 技術スタック

| 要素 | 技術 |
|---|---|
| APIフレームワーク | Next.js 16 App Router Route Handlers |
| DB | PostgreSQL + Prisma 7 |
| 認証 | NextAuth.js v5（`auth()` from `@/lib/auth.ts`） |
| バリデーション | Zod |
| テスト | Jest + モック Prisma |

### ファイル構成

```
src/
  app/api/
    cases/
      route.ts           ← GET（一覧・フィルタ・ページネーション）, POST（作成）
      [id]/route.ts      ← GET（詳細）, PATCH（更新）, DELETE（削除）
    talents/             ← 同上パターン
    matchings/           ← 同上パターン
    proposals/           ← 同上パターン
    contracts/           ← 同上パターン
    emails/              ← 同上パターン
  lib/
    api.ts               ← 共通レスポンスヘルパー・認証チェック
    schemas/
      case.ts            ← Zod スキーマ（create/update/query）
      talent.ts
      matching.ts
      proposal.ts
      contract.ts
      email.ts
```

---

## レスポンス形式

### 成功（一覧）

```json
{
  "success": true,
  "data": [...],
  "meta": { "total": 42, "page": 1, "limit": 20 }
}
```

### 成功（単件・作成）

```json
{ "success": true, "data": { "id": "...", ... } }
```

### エラー

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

### HTTPステータスコード

| 状況 | コード |
|---|---|
| 正常（取得・更新・削除） | 200 |
| 正常（作成） | 201 |
| 未認証 | 401 |
| 権限なし | 403 |
| 見つからない | 404 |
| バリデーションエラー | 422 |
| サーバーエラー | 500 |

---

## 共通ユーティリティ

### `src/lib/api.ts`

```ts
// レスポンスヘルパー
export function ok(data: unknown, meta?: PaginationMeta): NextResponse
export function created(data: unknown): NextResponse
export function unauthorized(): NextResponse        // 401
export function forbidden(): NextResponse           // 403
export function notFound(): NextResponse            // 404
export function unprocessable(errors: unknown): NextResponse  // 422
export function serverError(): NextResponse         // 500

// 認証チェック
// セッションがなければ 401 NextResponse を throw
// 成功時は { session, isAdmin } を返す
export async function requireAuth(): Promise<{ session: Session; isAdmin: boolean }>

// ページネーション
export type PaginationMeta = { total: number; page: number; limit: number }
```

---

## 認証・認可

すべての Route Handler で `requireAuth()` を呼び出す。

```ts
const { session, isAdmin } = await requireAuth()
```

### ロール制御

| 操作 | STAFF | ADMIN |
|---|---|---|
| 一覧取得 | `assignedUserId === 自分` のみ | 全件 |
| 詳細取得 | 自分担当のみ（他人は 403） | 全件 |
| 作成 | 自分の `assignedUserId` で作成 | 任意ユーザーで作成可 |
| 更新 | 自分担当のみ | 全件 |
| 削除 | 不可（403） | 全件 |

※ Matching/Proposal/Contract は担当者ベースではなく関連する Case の担当者で判定する。
※ Email はシステム取込なのでロール制御は軽量（STAFF は参照のみ、ADMIN は全操作）。

---

## 各リソースのエンドポイント

### Case（案件）

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/cases` | 一覧（status/skills/日付/page/limit） |
| POST | `/api/cases` | 作成 |
| GET | `/api/cases/[id]` | 詳細（matchings, contracts を include） |
| PATCH | `/api/cases/[id]` | 部分更新 |
| DELETE | `/api/cases/[id]` | 削除（ADMIN のみ） |

**クエリパラメータ:** `?status=OPEN&skills=Java,React&dateFrom=2026-01-01&dateTo=2026-12-31&page=1&limit=20`

### Talent（人材）

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/talents` | 一覧（status/skills/workStyle/page/limit） |
| POST | `/api/talents` | 作成 |
| GET | `/api/talents/[id]` | 詳細（matchings, contracts を include） |
| PATCH | `/api/talents/[id]` | 部分更新 |
| DELETE | `/api/talents/[id]` | 削除（ADMIN のみ） |

**クエリパラメータ:** `?status=AVAILABLE&skills=Go&workStyle=REMOTE&page=1&limit=20`

### Matching（マッチング）

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/matchings` | 一覧（caseId/talentId/status/page/limit） |
| POST | `/api/matchings` | 作成（スコア計算含む） |
| GET | `/api/matchings/[id]` | 詳細（case, talent, proposal を include） |
| PATCH | `/api/matchings/[id]` | ステータス更新 |
| DELETE | `/api/matchings/[id]` | 削除（ADMIN のみ） |

### Proposal（提案メール）

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/proposals` | 一覧（status/page/limit） |
| POST | `/api/proposals` | 作成（matchingId 必須） |
| GET | `/api/proposals/[id]` | 詳細 |
| PATCH | `/api/proposals/[id]` | 更新（送信・ステータス変更） |
| DELETE | `/api/proposals/[id]` | 削除（DRAFT のみ可） |

### Contract（契約）

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/contracts` | 一覧（status/page/limit） |
| POST | `/api/contracts` | 作成 |
| GET | `/api/contracts/[id]` | 詳細 |
| PATCH | `/api/contracts/[id]` | 更新（更新日・ステータス） |
| DELETE | `/api/contracts/[id]` | 削除（ADMIN のみ） |

### Email（メール）

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/emails` | 一覧（type/status/page/limit） |
| POST | `/api/emails` | 取込（メール受信時） |
| GET | `/api/emails/[id]` | 詳細 |
| PATCH | `/api/emails/[id]` | ステータス更新（PARSING→PARSED） |
| DELETE | `/api/emails/[id]` | 削除（ADMIN のみ） |

---

## Zod スキーマ設計（Case を例）

```ts
// src/lib/schemas/case.ts

export const CreateCaseSchema = z.object({
  title:     z.string().min(1),
  client:    z.string().min(1),
  clientEmail: z.string().email().optional(),
  skills:    z.array(z.string()).min(1),
  unitPrice: z.number().positive(),
  startDate: z.coerce.date(),
  workStyle: z.enum(['REMOTE', 'ONSITE', 'HYBRID']),
  sourceEmailId: z.string().optional(),
})

export const UpdateCaseSchema = CreateCaseSchema.partial().extend({
  status: z.enum(['OPEN','MATCHING','PROPOSING','INTERVIEWING','CONTRACTED','CLOSED']).optional(),
})

export const CaseQuerySchema = z.object({
  status:   z.enum(['OPEN','MATCHING','PROPOSING','INTERVIEWING','CONTRACTED','CLOSED']).optional(),
  skills:   z.string().optional(),   // "Java,React" → split(',')
  dateFrom: z.coerce.date().optional(),
  dateTo:   z.coerce.date().optional(),
  page:     z.coerce.number().min(1).default(1),
  limit:    z.coerce.number().min(1).max(100).default(20),
})
```

他リソースも同様のパターン（Create/Update/Query の3スキーマ）。

---

## テスト方針

### テストファイル構成

```
src/app/api/
  cases/__tests__/
    route.test.ts       ← GET /api/cases, POST /api/cases
    [id].test.ts        ← GET/PATCH/DELETE /api/cases/[id]
  talents/__tests__/    ← 同上パターン
  matchings/__tests__/
  proposals/__tests__/
  contracts/__tests__/
  emails/__tests__/
```

### 各テストで確認する項目

| ケース | 確認内容 |
|---|---|
| 未認証リクエスト | 401 を返す |
| STAFF が他人のデータを取得 | 403 を返す |
| STAFF が DELETE | 403 を返す |
| 正常な一覧取得 | 200 + `{ success: true, data, meta }` |
| バリデーションエラー | 422 + エラー詳細 |
| 存在しない ID | 404 を返す |
| 正常な作成 | 201 + 作成データ |
| 正常な更新 | 200 + 更新データ |

### モック設定

```ts
jest.mock('@/lib/prisma', () => ({
  prisma: { case: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), ... } }
}))
jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
```

---

## 実装優先順位

1. `src/lib/api.ts`（共通ヘルパー）— 全リソースの基盤
2. `src/lib/schemas/`（Zod スキーマ）— バリデーション定義
3. Cases API — 最も基本的なリソース
4. Talents API
5. Matchings API（Case + Talent に依存）
6. Proposals API（Matching に依存）
7. Contracts API（Proposal に依存）
8. Emails API

---

## 対象外（スコープ外）

- メール送信機能（Proposal の実際の送信）
- AI スコアリングロジック（Matching の score 計算は手動入力）
- WebSocket / リアルタイム更新
- ファイルアップロード（Email の添付ファイル）
