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

`meta.total` は同一フィルタ条件で `prisma.model.count()` を実行した値。

### 成功（単件・作成）

```json
{ "success": true, "data": { "id": "...", ... } }
```

### エラー

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

### エラーコード一覧

| code | HTTP | 用途 |
|---|---|---|
| `UNAUTHORIZED` | 401 | 未認証（セッションなし） |
| `FORBIDDEN` | 403 | 権限なし（ロール不足・他人のリソース） |
| `NOT_FOUND` | 404 | リソースが存在しない |
| `VALIDATION_ERROR` | 422 | Zod バリデーション失敗 |
| `SERVER_ERROR` | 500 | 予期しないサーバーエラー |

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
export function unauthorized(): NextResponse        // 401 UNAUTHORIZED
export function forbidden(): NextResponse           // 403 FORBIDDEN
export function notFound(): NextResponse            // 404 NOT_FOUND
export function unprocessable(errors: unknown): NextResponse  // 422 VALIDATION_ERROR
export function serverError(): NextResponse         // 500 SERVER_ERROR

// 認証チェック
// セッションがなければ unauthorized() を返す（throw ではなく return）
// 成功時は { session, isAdmin } を返す
// Handler 側は instanceof NextResponse で早期 return するパターンを使う:
//
//   const authResult = await requireAuth()
//   if (authResult instanceof NextResponse) return authResult
//   const { session, isAdmin } = authResult
//
export async function requireAuth(): Promise<{ session: Session; isAdmin: boolean } | NextResponse>

// ページネーション
export type PaginationMeta = { total: number; page: number; limit: number }
```

---

## 認証・認可

すべての Route Handler で `requireAuth()` を呼び出す。

```ts
const authResult = await requireAuth()
if (authResult instanceof NextResponse) return authResult
const { session, isAdmin } = authResult
```

### ロール制御

| 操作 | STAFF | ADMIN |
|---|---|---|
| 一覧取得 | `assignedUserId === 自分` のみ | 全件 |
| 詳細取得 | 自分担当のみ（他人は 403） | 全件 |
| 作成 | 自分の `assignedUserId` で強制設定 | リクエストボディの `assignedUserId` を使用 |
| 更新 | 自分担当のみ | 全件 |
| 削除 | 不可（403） | 全件 |

**担当者判定の基準（リソース別）:**

| リソース | 担当者フィールド |
|---|---|
| Case | `Case.assignedUserId` |
| Talent | `Talent.assignedUserId` |
| Matching | 関連する `Case.assignedUserId`（`matching.case.assignedUserId`） |
| Proposal | 関連する `Matching.case.assignedUserId`（`proposal.matching.case.assignedUserId`） |
| Contract | `Contract.assignedUserId`（Contract 自身が持つフィールドを使用。Case のフィールドは参照しない） |
| Email | 下記参照 |

**Email のロール制御（特殊ルール）:**
- STAFF: GET（一覧・詳細）のみ許可。POST/PATCH/DELETE は 403。
- ADMIN: 全操作（GET/POST/PATCH/DELETE）許可。
- Email はシステム取込を想定した設計だが、このフェーズではユーザーセッション認証で制御する。

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
| POST | `/api/matchings` | 作成（スコアフィールドは全てリクエストボディで手動入力） |
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
| DELETE | `/api/proposals/[id]` | 削除（ADMIN のみ・DRAFT ステータスのみ） |

※ DELETE は ADMIN であっても DRAFT 以外のステータス（SENT/REPLIED 等）の Proposal は削除不可（422 を返す）。

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
| POST | `/api/emails` | 取込（ADMIN のみ） |
| GET | `/api/emails/[id]` | 詳細 |
| PATCH | `/api/emails/[id]` | ステータス更新（ADMIN のみ） |
| DELETE | `/api/emails/[id]` | 削除（ADMIN のみ） |

---

## Zod スキーマ設計

### Case

```ts
// src/lib/schemas/case.ts

export const CreateCaseSchema = z.object({
  title:          z.string().min(1),
  client:         z.string().min(1),
  clientEmail:    z.string().email().optional(),
  skills:         z.array(z.string()).min(1),
  unitPrice:      z.number().int().positive(),
  startDate:      z.coerce.date(),
  workStyle:      z.enum(['REMOTE', 'ONSITE', 'HYBRID']),
  assignedUserId: z.string().cuid(),   // STAFF は API 内で自分の ID に強制上書き
  sourceEmailId:  z.string().cuid().optional(),
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

### Talent

```ts
// src/lib/schemas/talent.ts

export const CreateTalentSchema = z.object({
  name:           z.string().min(1),
  skills:         z.array(z.string()).min(1),
  experience:     z.number().int().min(0),
  desiredRate:    z.number().int().positive(),
  location:       z.string().min(1),
  workStyle:      z.enum(['REMOTE', 'ONSITE', 'HYBRID']),
  availableFrom:  z.coerce.date().optional(),
  agencyEmail:    z.string().email().optional(),
  assignedUserId: z.string().cuid(),   // STAFF は API 内で自分の ID に強制上書き
  sourceEmailId:  z.string().cuid().optional(),
})

export const UpdateTalentSchema = CreateTalentSchema.partial().extend({
  status: z.enum(['AVAILABLE','ACTIVE','NEGOTIATING','ENDING_SOON','INACTIVE']).optional(),
})

export const TalentQuerySchema = z.object({
  status:    z.enum(['AVAILABLE','ACTIVE','NEGOTIATING','ENDING_SOON','INACTIVE']).optional(),
  skills:    z.string().optional(),
  workStyle: z.enum(['REMOTE', 'ONSITE', 'HYBRID']).optional(),
  page:      z.coerce.number().min(1).default(1),
  limit:     z.coerce.number().min(1).max(100).default(20),
})
```

### Matching

```ts
// src/lib/schemas/matching.ts
// スコアフィールドは全てリクエストボディで手動入力（AI計算はスコープ外）

export const CreateMatchingSchema = z.object({
  caseId:          z.string().cuid(),
  talentId:        z.string().cuid(),
  score:           z.number().int().min(0).max(100),
  skillMatchRate:  z.number().int().min(0).max(100),
  unitPriceOk:     z.boolean(),
  timingOk:        z.boolean(),
  locationOk:      z.boolean(),
  costPrice:       z.number().int().positive(),
  sellPrice:       z.number().int().positive(),
  grossProfitRate: z.number(),
  grossProfitOk:   z.boolean(),
  reason:          z.string().optional(),
  isAutoSend:      z.boolean().default(false),
})

export const UpdateMatchingSchema = z.object({
  status: z.enum(['UNPROPOSED','PENDING_AUTO','SENT','REPLIED','INTERVIEWING','CONTRACTED','REJECTED']),
})

export const MatchingQuerySchema = z.object({
  caseId:   z.string().cuid().optional(),
  talentId: z.string().cuid().optional(),
  status:   z.enum(['UNPROPOSED','PENDING_AUTO','SENT','REPLIED','INTERVIEWING','CONTRACTED','REJECTED']).optional(),
  page:     z.coerce.number().min(1).default(1),
  limit:    z.coerce.number().min(1).max(100).default(20),
})
```

### Proposal

```ts
// src/lib/schemas/proposal.ts

export const CreateProposalSchema = z.object({
  matchingId:      z.string().cuid(),
  to:              z.string().email(),
  cc:              z.string().email().optional(),
  subject:         z.string().min(1),
  bodyText:        z.string().min(1),
  costPrice:       z.number().int().positive(),
  sellPrice:       z.number().int().positive(),
  grossProfitRate: z.number(),
  isAutoSend:      z.boolean().default(false),
})

export const UpdateProposalSchema = z.object({
  status:  z.enum(['DRAFT','PENDING_AUTO','SENT','REPLIED','REJECTED']).optional(),
  subject: z.string().min(1).optional(),
  bodyText: z.string().min(1).optional(),
  sentAt:  z.coerce.date().optional(),
})

export const ProposalQuerySchema = z.object({
  status: z.enum(['DRAFT','PENDING_AUTO','SENT','REPLIED','REJECTED']).optional(),
  page:   z.coerce.number().min(1).default(1),
  limit:  z.coerce.number().min(1).max(100).default(20),
})
```

### Contract

```ts
// src/lib/schemas/contract.ts

export const CreateContractSchema = z.object({
  caseId:          z.string().cuid(),
  talentId:        z.string().cuid(),
  assignedUserId:  z.string().cuid(),
  proposalId:      z.string().cuid().optional(),
  startDate:       z.coerce.date(),
  endDate:         z.coerce.date().optional(),
  unitPrice:       z.number().int().positive(),
  costPrice:       z.number().int().positive(),
  grossProfitRate: z.number(),
})

export const UpdateContractSchema = z.object({
  endDate:         z.coerce.date().optional(),
  unitPrice:       z.number().int().positive().optional(),
  costPrice:       z.number().int().positive().optional(),
  grossProfitRate: z.number().optional(),
  status:          z.enum(['ACTIVE','ENDING_SOON','ENDED','RENEWAL_PENDING']).optional(),
})

export const ContractQuerySchema = z.object({
  status: z.enum(['ACTIVE','ENDING_SOON','ENDED','RENEWAL_PENDING']).optional(),
  page:   z.coerce.number().min(1).default(1),
  limit:  z.coerce.number().min(1).max(100).default(20),
})
```

### Email

```ts
// src/lib/schemas/email.ts

export const CreateEmailSchema = z.object({
  receivedAt:    z.coerce.date(),
  from:          z.string().min(1),
  fromEmail:     z.string().email(),
  subject:       z.string().min(1),
  bodyText:      z.string(),
  type:          z.enum(['CASE', 'TALENT']),
  skills:        z.array(z.string()).default([]),
  extractedName: z.string().optional(),
  confidence:    z.number().int().min(0).max(100).optional(),
  s3Key:         z.string().optional(),
})

export const UpdateEmailSchema = z.object({
  status: z.enum(['PENDING','PARSING','PARSED','ERROR']),
})

export const EmailQuerySchema = z.object({
  type:   z.enum(['CASE', 'TALENT']).optional(),
  status: z.enum(['PENDING','PARSING','PARSED','ERROR']).optional(),
  page:   z.coerce.number().min(1).default(1),
  limit:  z.coerce.number().min(1).max(100).default(20),
})
```

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
| STAFF が Email の POST/PATCH | 403 を返す |
| 正常な一覧取得 | 200 + `{ success: true, data, meta }` |
| バリデーションエラー | 422 + エラー詳細 |
| 存在しない ID | 404 を返す |
| 正常な作成 | 201 + 作成データ |
| 正常な更新 | 200 + 更新データ |
| Proposal 削除（DRAFT） | ADMIN: 200 |
| Proposal 削除（SENT） | 422 を返す |

### モック設定

```ts
jest.mock('@/lib/prisma', () => ({
  prisma: { case: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), count: jest.fn(), ... } }
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
- AI スコアリングロジック（Matching の score は全フィールド手動入力）
- WebSocket / リアルタイム更新
- ファイルアップロード（Email の添付ファイル）
