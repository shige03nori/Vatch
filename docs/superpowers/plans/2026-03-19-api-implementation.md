# API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vatch の全ビジネスリソース（Case/Talent/Matching/Proposal/Contract/Email）に対してフル CRUD API を実装する。

**Architecture:** Next.js App Router Route Handlers + Prisma 7 + Zod バリデーション。共通ヘルパー（`src/lib/api.ts`）で認証チェック・レスポンス形式を統一し、各リソースが同パターンで実装される。ADMIN は全件操作可、STAFF は自分が担当するリソースのみ操作可。

**Tech Stack:** Next.js 16, Prisma 7, NextAuth.js v5, Zod, Jest

**Spec:** `docs/superpowers/specs/2026-03-19-api-design.md`
**Prisma Schema:** `prisma/schema.prisma`

---

## ファイル構成

```
src/
  lib/
    api.ts                          ← 新規: 共通レスポンスヘルパー・requireAuth
    schemas/
      case.ts                       ← 新規: Case の Zod スキーマ3種
      talent.ts                     ← 新規: Talent の Zod スキーマ3種
      matching.ts                   ← 新規: Matching の Zod スキーマ3種
      proposal.ts                   ← 新規: Proposal の Zod スキーマ3種
      contract.ts                   ← 新規: Contract の Zod スキーマ3種
      email.ts                      ← 新規: Email の Zod スキーマ3種
  app/api/
    cases/
      route.ts                      ← 新規: GET(一覧), POST(作成)
      [id]/route.ts                 ← 新規: GET(詳細), PATCH(更新), DELETE(削除)
      __tests__/
        route.test.ts               ← 新規: GET/POST テスト
        [id].test.ts                ← 新規: GET/PATCH/DELETE テスト
    talents/                        ← 同上パターン (4ファイル)
    matchings/                      ← 同上パターン (4ファイル)
    proposals/                      ← 同上パターン (4ファイル)
    contracts/                      ← 同上パターン (4ファイル)
    emails/                         ← 同上パターン (4ファイル)
```

---

## Task 1: 共通ヘルパー `src/lib/api.ts`

**Files:**
- Create: `src/lib/api.ts`
- Create: `src/lib/__tests__/api.test.ts`

### 背景知識

- `auth()` は `@/lib/auth` からインポートする NextAuth.js v5 の関数。セッションがない場合 `null` を返す。
- `session.user.role` は `'ADMIN'` または `'STAFF'`（`@prisma/client` の `Role` 型）。
- Route Handler から `NextResponse` をそのまま `return` する。

- [ ] **Step 1: テストを書く**

```ts
// src/lib/__tests__/api.test.ts
/**
 * @jest-environment node
 */
import { ok, created, unauthorized, forbidden, notFound, unprocessable, serverError } from '../api'

describe('api helpers', () => {
  it('ok returns 200 with data', async () => {
    const res = ok({ id: '1' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true, data: { id: '1' } })
  })

  it('ok returns 200 with meta', async () => {
    const res = ok([{ id: '1' }], { total: 1, page: 1, limit: 20 })
    const body = await res.json()
    expect(body).toEqual({ success: true, data: [{ id: '1' }], meta: { total: 1, page: 1, limit: 20 } })
  })

  it('created returns 201', async () => {
    const res = created({ id: '1' })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual({ success: true, data: { id: '1' } })
  })

  it('unauthorized returns 401', async () => {
    const res = unauthorized()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
  })

  it('forbidden returns 403', async () => {
    const res = forbidden()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('notFound returns 404', async () => {
    const res = notFound()
    expect(res.status).toBe(404)
  })

  it('unprocessable returns 422', async () => {
    const res = unprocessable([{ path: ['title'], message: 'Required' }])
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('serverError returns 500', async () => {
    const res = serverError()
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest src/lib/__tests__/api.test.ts --no-coverage
```

Expected: FAIL (モジュールが存在しない)

- [ ] **Step 3: `src/lib/api.ts` を実装**

```ts
// src/lib/api.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import type { Session } from 'next-auth'

export type PaginationMeta = { total: number; page: number; limit: number }

export function ok(data: unknown, meta?: PaginationMeta): NextResponse {
  const body = meta ? { success: true, data, meta } : { success: true, data }
  return NextResponse.json(body, { status: 200 })
}

export function created(data: unknown): NextResponse {
  return NextResponse.json({ success: true, data }, { status: 201 })
}

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 }
  )
}

export function forbidden(): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } },
    { status: 403 }
  )
}

export function notFound(): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } },
    { status: 404 }
  )
}

export function unprocessable(errors: unknown): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', errors } },
    { status: 422 }
  )
}

export function serverError(): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
    { status: 500 }
  )
}

export async function requireAuth(): Promise<{ session: Session; isAdmin: boolean } | NextResponse> {
  const session = await auth()
  if (!session?.user) return unauthorized()
  const isAdmin = session.user.role === 'ADMIN'
  return { session, isAdmin }
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest src/lib/__tests__/api.test.ts --no-coverage
```

Expected: PASS (8 tests)

- [ ] **Step 5: コミット**

```bash
git add src/lib/api.ts src/lib/__tests__/api.test.ts
git commit -m "feat: add shared API response helpers and requireAuth"
```

---

## Task 2: Zod スキーマ `src/lib/schemas/`

**Files:**
- Create: `src/lib/schemas/case.ts`
- Create: `src/lib/schemas/talent.ts`
- Create: `src/lib/schemas/matching.ts`
- Create: `src/lib/schemas/proposal.ts`
- Create: `src/lib/schemas/contract.ts`
- Create: `src/lib/schemas/email.ts`

### 背景知識

- スキーマはバリデーションのみ担当。DB 操作は含まない。
- STAFF が POST した際の `assignedUserId` の上書き処理はルートハンドラ側で行うため、スキーマは `assignedUserId` を受け取る。
- `z.coerce.date()` は文字列を `Date` に変換する（クエリパラメータは常に文字列で届く）。

- [ ] **Step 1: 6ファイルを作成**

```ts
// src/lib/schemas/case.ts
import { z } from 'zod'

export const CreateCaseSchema = z.object({
  title:          z.string().min(1),
  client:         z.string().min(1),
  clientEmail:    z.string().email().optional(),
  skills:         z.array(z.string()).min(1),
  unitPrice:      z.number().int().positive(),
  startDate:      z.coerce.date(),
  workStyle:      z.enum(['REMOTE', 'ONSITE', 'HYBRID']),
  assignedUserId: z.string().cuid(),
  sourceEmailId:  z.string().cuid().optional(),
})

export const UpdateCaseSchema = CreateCaseSchema.partial().extend({
  status: z.enum(['OPEN','MATCHING','PROPOSING','INTERVIEWING','CONTRACTED','CLOSED']).optional(),
})

export const CaseQuerySchema = z.object({
  status:   z.enum(['OPEN','MATCHING','PROPOSING','INTERVIEWING','CONTRACTED','CLOSED']).optional(),
  skills:   z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo:   z.coerce.date().optional(),
  page:     z.coerce.number().min(1).default(1),
  limit:    z.coerce.number().min(1).max(100).default(20),
})
```

```ts
// src/lib/schemas/talent.ts
import { z } from 'zod'

export const CreateTalentSchema = z.object({
  name:           z.string().min(1),
  skills:         z.array(z.string()).min(1),
  experience:     z.number().int().min(0),
  desiredRate:    z.number().int().positive(),
  location:       z.string().min(1),
  workStyle:      z.enum(['REMOTE', 'ONSITE', 'HYBRID']),
  availableFrom:  z.coerce.date().optional(),
  agencyEmail:    z.string().email().optional(),
  assignedUserId: z.string().cuid(),
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

```ts
// src/lib/schemas/matching.ts
import { z } from 'zod'

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

```ts
// src/lib/schemas/proposal.ts
import { z } from 'zod'

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
  status:   z.enum(['DRAFT','PENDING_AUTO','SENT','REPLIED','REJECTED']).optional(),
  subject:  z.string().min(1).optional(),
  bodyText: z.string().min(1).optional(),
  sentAt:   z.coerce.date().optional(),
})

export const ProposalQuerySchema = z.object({
  status: z.enum(['DRAFT','PENDING_AUTO','SENT','REPLIED','REJECTED']).optional(),
  page:   z.coerce.number().min(1).default(1),
  limit:  z.coerce.number().min(1).max(100).default(20),
})
```

```ts
// src/lib/schemas/contract.ts
import { z } from 'zod'

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

```ts
// src/lib/schemas/email.ts
import { z } from 'zod'

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

- [ ] **Step 2: TypeScript コンパイルエラーがないか確認**

```bash
npx tsc --noEmit
```

Expected: エラーなし（または api.ts 関連のエラーのみで schemas は通る）

- [ ] **Step 3: コミット**

```bash
git add src/lib/schemas/
git commit -m "feat: add Zod schemas for all 6 resources"
```

---

## Task 3: Cases API

**Files:**
- Create: `src/app/api/cases/route.ts`
- Create: `src/app/api/cases/[id]/route.ts`
- Create: `src/app/api/cases/__tests__/route.test.ts`
- Create: `src/app/api/cases/__tests__/[id].test.ts`

### 背景知識

- Route Handler のテストでは `new Request('http://localhost/api/cases')` でリクエストを作成する。
- `[id]` を受け取る Route Handler の第2引数は `{ params: Promise<{ id: string }> }` (Next.js 16 では Promise 型)。
- `prisma.case.findMany` は camelCase のモデル名を使う。
- STAFF の一覧取得は `where: { assignedUserId: session.user.id }` を追加する。
- テストの先頭に `/** @jest-environment node */` を記述することで、このファイルだけ Node 環境でテストできる。

- [ ] **Step 1: 一覧・作成のテストを書く**

```ts
// src/app/api/cases/__tests__/route.test.ts
/**
 * @jest-environment node
 */
import { GET, POST } from '../route'

const mockFindMany = jest.fn()
const mockCount = jest.fn()
const mockCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    case: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count:    (...args: unknown[]) => mockCount(...args),
      create:   (...args: unknown[]) => mockCreate(...args),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

const adminSession = { user: { id: 'admin-id', role: 'ADMIN' } }
const staffSession = { user: { id: 'staff-id', role: 'STAFF' } }

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/cases', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost/api/cases'))
    expect(res.status).toBe(401)
  })

  it('ADMIN gets all cases with pagination', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindMany.mockResolvedValueOnce([{ id: 'c1', title: 'Test Case' }])
    mockCount.mockResolvedValueOnce(1)
    const res = await GET(new Request('http://localhost/api/cases'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.meta).toEqual({ total: 1, page: 1, limit: 20 })
  })

  it('STAFF sees only own cases', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindMany.mockResolvedValueOnce([])
    mockCount.mockResolvedValueOnce(0)
    await GET(new Request('http://localhost/api/cases'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ assignedUserId: 'staff-id' }) })
    )
  })
})

describe('POST /api/cases', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const req = new Request('http://localhost/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 422 on invalid body', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    const req = new Request('http://localhost/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(422)
  })

  it('ADMIN creates a case', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    const newCase = { id: 'c1', title: 'New Case', assignedUserId: 'admin-id' }
    mockCreate.mockResolvedValueOnce(newCase)
    const req = new Request('http://localhost/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Case',
        client: 'Client Co',
        skills: ['React'],
        unitPrice: 800000,
        startDate: '2026-04-01',
        workStyle: 'REMOTE',
        assignedUserId: 'admin-id',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBe('c1')
  })

  it('STAFF assignedUserId is forced to own id', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockCreate.mockResolvedValueOnce({ id: 'c1', assignedUserId: 'staff-id' })
    const req = new Request('http://localhost/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Case',
        client: 'Client Co',
        skills: ['React'],
        unitPrice: 800000,
        startDate: '2026-04-01',
        workStyle: 'REMOTE',
        assignedUserId: 'other-user-id',  // STAFF が他人を指定してもサーバー側で上書き
      }),
    })
    await POST(req)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedUserId: 'staff-id' }) })
    )
  })
})
```

- [ ] **Step 2: 詳細・更新・削除のテストを書く**

```ts
// src/app/api/cases/__tests__/[id].test.ts
/**
 * @jest-environment node
 */
import { GET, PATCH, DELETE } from '../[id]/route'

const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
const mockDelete = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    case: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update:     (...args: unknown[]) => mockUpdate(...args),
      delete:     (...args: unknown[]) => mockDelete(...args),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

const adminSession = { user: { id: 'admin-id', role: 'ADMIN' } }
const staffSession = { user: { id: 'staff-id', role: 'STAFF' } }
const params = Promise.resolve({ id: 'case-1' })

beforeEach(() => jest.clearAllMocks())

describe('GET /api/cases/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost/api/cases/case-1'), { params })
    expect(res.status).toBe(401)
  })

  it('returns 404 when case not found', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost/api/cases/case-1'), { params })
    expect(res.status).toBe(404)
  })

  it('returns 403 when STAFF accesses another staff case', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'case-1', assignedUserId: 'other-staff-id' })
    const res = await GET(new Request('http://localhost/api/cases/case-1'), { params })
    expect(res.status).toBe(403)
  })

  it('ADMIN gets any case', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'case-1', assignedUserId: 'staff-id' })
    const res = await GET(new Request('http://localhost/api/cases/case-1'), { params })
    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/cases/[id]', () => {
  it('returns 403 when STAFF patches another staff case', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'case-1', assignedUserId: 'other-id' })
    const req = new Request('http://localhost/api/cases/case-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(403)
  })

  it('ADMIN updates a case', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'case-1', assignedUserId: 'staff-id' })
    mockUpdate.mockResolvedValueOnce({ id: 'case-1', title: 'Updated' })
    const req = new Request('http://localhost/api/cases/case-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/cases/[id]', () => {
  it('returns 403 when STAFF deletes', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    const res = await DELETE(new Request('http://localhost/api/cases/case-1'), { params })
    expect(res.status).toBe(403)
  })

  it('ADMIN deletes a case', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'case-1' })
    mockDelete.mockResolvedValueOnce({ id: 'case-1' })
    const res = await DELETE(new Request('http://localhost/api/cases/case-1'), { params })
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 3: テストが失敗することを確認**

```bash
npx jest src/app/api/cases --no-coverage
```

Expected: FAIL (モジュールが存在しない)

- [ ] **Step 4: `src/app/api/cases/route.ts` を実装**

```ts
// src/app/api/cases/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, created, unprocessable, serverError, requireAuth } from '@/lib/api'
import { CreateCaseSchema, CaseQuerySchema } from '@/lib/schemas/case'

export async function GET(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { searchParams } = new URL(request.url)
  const query = CaseQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!query.success) return unprocessable(query.error.errors)

  const { status, skills, dateFrom, dateTo, page, limit } = query.data
  const skillsArr = skills ? skills.split(',').map(s => s.trim()) : undefined

  const where = {
    ...(isAdmin ? {} : { assignedUserId: session.user.id }),
    ...(status ? { status } : {}),
    ...(skillsArr ? { skills: { hasEvery: skillsArr } } : {}),
    ...(dateFrom || dateTo ? { startDate: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
  }

  try {
    const [data, total] = await Promise.all([
      prisma.case.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.case.count({ where }),
    ])
    return ok(data, { total, page, limit })
  } catch {
    return serverError()
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const body = await request.json().catch(() => ({}))
  const parsed = CreateCaseSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.errors)

  const data = {
    ...parsed.data,
    assignedUserId: isAdmin ? parsed.data.assignedUserId : session.user.id,
  }

  try {
    const record = await prisma.case.create({ data })
    return created(record)
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 5: `src/app/api/cases/[id]/route.ts` を実装**

```ts
// src/app/api/cases/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, forbidden, notFound, unprocessable, serverError, requireAuth } from '@/lib/api'
import { UpdateCaseSchema } from '@/lib/schemas/case'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { id } = await params
  const record = await prisma.case.findUnique({ where: { id }, include: { matchings: true, contracts: true } })
  if (!record) return notFound()
  if (!isAdmin && record.assignedUserId !== session.user.id) return forbidden()
  return ok(record)
}

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { id } = await params
  const existing = await prisma.case.findUnique({ where: { id } })
  if (!existing) return notFound()
  if (!isAdmin && existing.assignedUserId !== session.user.id) return forbidden()

  const body = await request.json().catch(() => ({}))
  const parsed = UpdateCaseSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.errors)

  try {
    const record = await prisma.case.update({ where: { id }, data: parsed.data })
    return ok(record)
  } catch {
    return serverError()
  }
}

export async function DELETE(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { isAdmin } = authResult

  if (!isAdmin) return forbidden()

  const { id } = await params
  const existing = await prisma.case.findUnique({ where: { id } })
  if (!existing) return notFound()

  try {
    const record = await prisma.case.delete({ where: { id } })
    return ok(record)
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 6: テストが通ることを確認**

```bash
npx jest src/app/api/cases --no-coverage
```

Expected: PASS (全テスト)

- [ ] **Step 7: コミット**

```bash
git add src/app/api/cases/
git commit -m "feat: add Cases API (GET/POST/PATCH/DELETE) with RBAC"
```

---

## Task 4: Talents API

**Files:**
- Create: `src/app/api/talents/route.ts`
- Create: `src/app/api/talents/[id]/route.ts`
- Create: `src/app/api/talents/__tests__/route.test.ts`
- Create: `src/app/api/talents/__tests__/[id].test.ts`

### 背景知識

Cases API と全く同じパターン。`prisma.case` → `prisma.talent`、Zod スキーマを `talent.ts` に変えるだけ。

- [ ] **Step 1: テストを書く**

```ts
// src/app/api/talents/__tests__/route.test.ts
/**
 * @jest-environment node
 */
import { GET, POST } from '../route'

const mockFindMany = jest.fn()
const mockCount = jest.fn()
const mockCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    talent: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count:    (...args: unknown[]) => mockCount(...args),
      create:   (...args: unknown[]) => mockCreate(...args),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

const adminSession = { user: { id: 'admin-id', role: 'ADMIN' } }
const staffSession = { user: { id: 'staff-id', role: 'STAFF' } }

beforeEach(() => jest.clearAllMocks())

describe('GET /api/talents', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost/api/talents'))
    expect(res.status).toBe(401)
  })

  it('ADMIN gets all talents', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindMany.mockResolvedValueOnce([{ id: 't1' }])
    mockCount.mockResolvedValueOnce(1)
    const res = await GET(new Request('http://localhost/api/talents'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.meta.total).toBe(1)
  })

  it('STAFF sees only own talents', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindMany.mockResolvedValueOnce([])
    mockCount.mockResolvedValueOnce(0)
    await GET(new Request('http://localhost/api/talents'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ assignedUserId: 'staff-id' }) })
    )
  })
})

describe('POST /api/talents', () => {
  it('returns 422 on invalid body', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    const req = new Request('http://localhost/api/talents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(422)
  })

  it('ADMIN creates a talent', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockCreate.mockResolvedValueOnce({ id: 't1' })
    const req = new Request('http://localhost/api/talents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Taro Yamada',
        skills: ['Go'],
        experience: 5,
        desiredRate: 700000,
        location: 'Tokyo',
        workStyle: 'REMOTE',
        assignedUserId: 'admin-id',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})
```

```ts
// src/app/api/talents/__tests__/[id].test.ts
/**
 * @jest-environment node
 */
import { GET, PATCH, DELETE } from '../[id]/route'

const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
const mockDelete = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    talent: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update:     (...args: unknown[]) => mockUpdate(...args),
      delete:     (...args: unknown[]) => mockDelete(...args),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

const adminSession = { user: { id: 'admin-id', role: 'ADMIN' } }
const staffSession = { user: { id: 'staff-id', role: 'STAFF' } }
const params = Promise.resolve({ id: 'talent-1' })

beforeEach(() => jest.clearAllMocks())

describe('GET /api/talents/[id]', () => {
  it('returns 404 when not found', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/talents/t1'), { params })).status).toBe(404)
  })

  it('returns 403 when STAFF accesses other talent', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'talent-1', assignedUserId: 'other-id' })
    expect((await GET(new Request('http://localhost/api/talents/talent-1'), { params })).status).toBe(403)
  })
})

describe('DELETE /api/talents/[id]', () => {
  it('returns 403 when STAFF deletes', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    expect((await DELETE(new Request('http://localhost/api/talents/t1'), { params })).status).toBe(403)
  })

  it('ADMIN deletes', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'talent-1' })
    mockDelete.mockResolvedValueOnce({ id: 'talent-1' })
    expect((await DELETE(new Request('http://localhost/api/talents/talent-1'), { params })).status).toBe(200)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest src/app/api/talents --no-coverage
```

- [ ] **Step 3: `src/app/api/talents/route.ts` を実装**

Cases の `route.ts` と同パターン。`prisma.case` → `prisma.talent`、スキーマを talent.ts からインポート。

```ts
// src/app/api/talents/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, created, unprocessable, serverError, requireAuth } from '@/lib/api'
import { CreateTalentSchema, TalentQuerySchema } from '@/lib/schemas/talent'

export async function GET(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { searchParams } = new URL(request.url)
  const query = TalentQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!query.success) return unprocessable(query.error.errors)

  const { status, skills, workStyle, page, limit } = query.data
  const skillsArr = skills ? skills.split(',').map(s => s.trim()) : undefined

  const where = {
    ...(isAdmin ? {} : { assignedUserId: session.user.id }),
    ...(status ? { status } : {}),
    ...(workStyle ? { workStyle } : {}),
    ...(skillsArr ? { skills: { hasEvery: skillsArr } } : {}),
  }

  try {
    const [data, total] = await Promise.all([
      prisma.talent.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.talent.count({ where }),
    ])
    return ok(data, { total, page, limit })
  } catch {
    return serverError()
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const body = await request.json().catch(() => ({}))
  const parsed = CreateTalentSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.errors)

  const data = {
    ...parsed.data,
    assignedUserId: isAdmin ? parsed.data.assignedUserId : session.user.id,
  }

  try {
    const record = await prisma.talent.create({ data })
    return created(record)
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 4: `src/app/api/talents/[id]/route.ts` を実装**

```ts
// src/app/api/talents/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, forbidden, notFound, unprocessable, serverError, requireAuth } from '@/lib/api'
import { UpdateTalentSchema } from '@/lib/schemas/talent'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { id } = await params
  const record = await prisma.talent.findUnique({ where: { id }, include: { matchings: true, contracts: true } })
  if (!record) return notFound()
  if (!isAdmin && record.assignedUserId !== session.user.id) return forbidden()
  return ok(record)
}

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { id } = await params
  const existing = await prisma.talent.findUnique({ where: { id } })
  if (!existing) return notFound()
  if (!isAdmin && existing.assignedUserId !== session.user.id) return forbidden()

  const body = await request.json().catch(() => ({}))
  const parsed = UpdateTalentSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.errors)

  try {
    const record = await prisma.talent.update({ where: { id }, data: parsed.data })
    return ok(record)
  } catch {
    return serverError()
  }
}

export async function DELETE(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { isAdmin } = authResult

  if (!isAdmin) return forbidden()

  const { id } = await params
  const existing = await prisma.talent.findUnique({ where: { id } })
  if (!existing) return notFound()

  try {
    const record = await prisma.talent.delete({ where: { id } })
    return ok(record)
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 5: テストが通ることを確認**

```bash
npx jest src/app/api/talents --no-coverage
```

- [ ] **Step 6: コミット**

```bash
git add src/app/api/talents/
git commit -m "feat: add Talents API (GET/POST/PATCH/DELETE) with RBAC"
```

---

## Task 5: Matchings API

**Files:**
- Create: `src/app/api/matchings/route.ts`
- Create: `src/app/api/matchings/[id]/route.ts`
- Create: `src/app/api/matchings/__tests__/route.test.ts`
- Create: `src/app/api/matchings/__tests__/[id].test.ts`

### 背景知識

- Matching の担当者判定は `matching.case.assignedUserId` を使う。
- 一覧取得で STAFF フィルタ: `where: { case: { assignedUserId: session.user.id } }`
- 詳細・更新・削除時の権限チェック: `findUnique` 時に `include: { case: true }` して `case.assignedUserId` を確認する。

- [ ] **Step 1: テストを書く**

```ts
// src/app/api/matchings/__tests__/route.test.ts
/**
 * @jest-environment node
 */
import { GET, POST } from '../route'

const mockFindMany = jest.fn()
const mockCount = jest.fn()
const mockCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    matching: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count:    (...args: unknown[]) => mockCount(...args),
      create:   (...args: unknown[]) => mockCreate(...args),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

const adminSession = { user: { id: 'admin-id', role: 'ADMIN' } }
const staffSession = { user: { id: 'staff-id', role: 'STAFF' } }

beforeEach(() => jest.clearAllMocks())

describe('GET /api/matchings', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/matchings'))).status).toBe(401)
  })

  it('STAFF filter uses case.assignedUserId', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindMany.mockResolvedValueOnce([])
    mockCount.mockResolvedValueOnce(0)
    await GET(new Request('http://localhost/api/matchings'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ case: { assignedUserId: 'staff-id' } }) })
    )
  })
})

describe('POST /api/matchings', () => {
  it('returns 422 on missing required fields', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    const req = new Request('http://localhost/api/matchings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId: 'c1' }),
    })
    expect((await POST(req)).status).toBe(422)
  })

  it('ADMIN creates a matching', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockCreate.mockResolvedValueOnce({ id: 'm1' })
    const req = new Request('http://localhost/api/matchings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: 'c-cuid1234567890', talentId: 't-cuid1234567890',
        score: 80, skillMatchRate: 90, unitPriceOk: true, timingOk: true,
        locationOk: true, costPrice: 600000, sellPrice: 800000,
        grossProfitRate: 25.0, grossProfitOk: true,
      }),
    })
    expect((await POST(req)).status).toBe(201)
  })
})
```

```ts
// src/app/api/matchings/__tests__/[id].test.ts
/**
 * @jest-environment node
 */
import { GET, PATCH, DELETE } from '../[id]/route'

const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
const mockDelete = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    matching: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update:     (...args: unknown[]) => mockUpdate(...args),
      delete:     (...args: unknown[]) => mockDelete(...args),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

const adminSession = { user: { id: 'admin-id', role: 'ADMIN' } }
const staffSession = { user: { id: 'staff-id', role: 'STAFF' } }
const params = Promise.resolve({ id: 'matching-1' })

beforeEach(() => jest.clearAllMocks())

describe('GET /api/matchings/[id]', () => {
  it('returns 403 when STAFF accesses other case matching', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'm1', case: { assignedUserId: 'other-id' } })
    expect((await GET(new Request('http://localhost/api/matchings/m1'), { params })).status).toBe(403)
  })
})

describe('PATCH /api/matchings/[id]', () => {
  it('updates status', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'm1', case: { assignedUserId: 'admin-id' } })
    mockUpdate.mockResolvedValueOnce({ id: 'm1', status: 'SENT' })
    const req = new Request('http://localhost/api/matchings/m1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'SENT' }),
    })
    expect((await PATCH(req, { params })).status).toBe(200)
  })
})

describe('DELETE /api/matchings/[id]', () => {
  it('returns 403 when STAFF deletes', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    expect((await DELETE(new Request('http://localhost/api/matchings/m1'), { params })).status).toBe(403)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest src/app/api/matchings --no-coverage
```

- [ ] **Step 3: `src/app/api/matchings/route.ts` を実装**

```ts
// src/app/api/matchings/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, created, unprocessable, serverError, requireAuth } from '@/lib/api'
import { CreateMatchingSchema, MatchingQuerySchema } from '@/lib/schemas/matching'

export async function GET(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { searchParams } = new URL(request.url)
  const query = MatchingQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!query.success) return unprocessable(query.error.errors)

  const { caseId, talentId, status, page, limit } = query.data

  const where = {
    ...(isAdmin ? {} : { case: { assignedUserId: session.user.id } }),
    ...(caseId ? { caseId } : {}),
    ...(talentId ? { talentId } : {}),
    ...(status ? { status } : {}),
  }

  try {
    const [data, total] = await Promise.all([
      prisma.matching.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.matching.count({ where }),
    ])
    return ok(data, { total, page, limit })
  } catch {
    return serverError()
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const body = await request.json().catch(() => ({}))
  const parsed = CreateMatchingSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.errors)

  try {
    const record = await prisma.matching.create({ data: parsed.data })
    return created(record)
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 4: `src/app/api/matchings/[id]/route.ts` を実装**

```ts
// src/app/api/matchings/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, forbidden, notFound, unprocessable, serverError, requireAuth } from '@/lib/api'
import { UpdateMatchingSchema } from '@/lib/schemas/matching'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { id } = await params
  const record = await prisma.matching.findUnique({
    where: { id },
    include: { case: true, talent: true, proposal: true },
  })
  if (!record) return notFound()
  if (!isAdmin && record.case.assignedUserId !== session.user.id) return forbidden()
  return ok(record)
}

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { id } = await params
  const existing = await prisma.matching.findUnique({ where: { id }, include: { case: true } })
  if (!existing) return notFound()
  if (!isAdmin && existing.case.assignedUserId !== session.user.id) return forbidden()

  const body = await request.json().catch(() => ({}))
  const parsed = UpdateMatchingSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.errors)

  try {
    const record = await prisma.matching.update({ where: { id }, data: parsed.data })
    return ok(record)
  } catch {
    return serverError()
  }
}

export async function DELETE(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { isAdmin } = authResult

  if (!isAdmin) return forbidden()

  const { id } = await params
  const existing = await prisma.matching.findUnique({ where: { id } })
  if (!existing) return notFound()

  try {
    const record = await prisma.matching.delete({ where: { id } })
    return ok(record)
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 5: テストが通ることを確認**

```bash
npx jest src/app/api/matchings --no-coverage
```

- [ ] **Step 6: コミット**

```bash
git add src/app/api/matchings/
git commit -m "feat: add Matchings API (GET/POST/PATCH/DELETE) with RBAC"
```

---

## Task 6: Proposals API

**Files:**
- Create: `src/app/api/proposals/route.ts`
- Create: `src/app/api/proposals/[id]/route.ts`
- Create: `src/app/api/proposals/__tests__/route.test.ts`
- Create: `src/app/api/proposals/__tests__/[id].test.ts`

### 背景知識

- Proposal の担当者判定は `proposal.matching.case.assignedUserId`。
- 一覧の STAFF フィルタ: `where: { matching: { case: { assignedUserId: session.user.id } } }`
- DELETE は ADMIN のみ・DRAFT ステータスのみ。DRAFT 以外は 422 を返す。

- [ ] **Step 1: テストを書く**

```ts
// src/app/api/proposals/__tests__/route.test.ts
/**
 * @jest-environment node
 */
import { GET, POST } from '../route'

const mockFindMany = jest.fn()
const mockCount = jest.fn()
const mockCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    proposal: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count:    (...args: unknown[]) => mockCount(...args),
      create:   (...args: unknown[]) => mockCreate(...args),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

const adminSession = { user: { id: 'admin-id', role: 'ADMIN' } }
const staffSession = { user: { id: 'staff-id', role: 'STAFF' } }

beforeEach(() => jest.clearAllMocks())

describe('GET /api/proposals', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/proposals'))).status).toBe(401)
  })

  it('STAFF filter uses matching.case.assignedUserId', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindMany.mockResolvedValueOnce([])
    mockCount.mockResolvedValueOnce(0)
    await GET(new Request('http://localhost/api/proposals'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ matching: { case: { assignedUserId: 'staff-id' } } })
      })
    )
  })
})

describe('POST /api/proposals', () => {
  it('creates a proposal', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockCreate.mockResolvedValueOnce({ id: 'p1' })
    const req = new Request('http://localhost/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchingId: 'm-cuid1234567890',
        to: 'client@example.com',
        subject: 'Test Proposal',
        bodyText: 'Dear client...',
        costPrice: 600000,
        sellPrice: 800000,
        grossProfitRate: 25.0,
      }),
    })
    expect((await POST(req)).status).toBe(201)
  })
})
```

```ts
// src/app/api/proposals/__tests__/[id].test.ts
/**
 * @jest-environment node
 */
import { GET, PATCH, DELETE } from '../[id]/route'

const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
const mockDelete = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    proposal: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update:     (...args: unknown[]) => mockUpdate(...args),
      delete:     (...args: unknown[]) => mockDelete(...args),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

const adminSession = { user: { id: 'admin-id', role: 'ADMIN' } }
const staffSession = { user: { id: 'staff-id', role: 'STAFF' } }
const params = Promise.resolve({ id: 'proposal-1' })

beforeEach(() => jest.clearAllMocks())

describe('DELETE /api/proposals/[id]', () => {
  it('returns 403 when STAFF deletes', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    expect((await DELETE(new Request('http://localhost/api/proposals/p1'), { params })).status).toBe(403)
  })

  it('ADMIN can delete DRAFT proposal', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'proposal-1', status: 'DRAFT', matching: { case: { assignedUserId: 'admin-id' } } })
    mockDelete.mockResolvedValueOnce({ id: 'proposal-1' })
    expect((await DELETE(new Request('http://localhost/api/proposals/proposal-1'), { params })).status).toBe(200)
  })

  it('returns 422 when ADMIN deletes non-DRAFT proposal', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'proposal-1', status: 'SENT', matching: { case: { assignedUserId: 'admin-id' } } })
    expect((await DELETE(new Request('http://localhost/api/proposals/proposal-1'), { params })).status).toBe(422)
  })
})

describe('GET /api/proposals/[id]', () => {
  it('returns 403 when STAFF accesses other proposal', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'p1', status: 'DRAFT', matching: { case: { assignedUserId: 'other-id' } } })
    expect((await GET(new Request('http://localhost/api/proposals/p1'), { params })).status).toBe(403)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest src/app/api/proposals --no-coverage
```

- [ ] **Step 3: `src/app/api/proposals/route.ts` を実装**

```ts
// src/app/api/proposals/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, created, unprocessable, serverError, requireAuth } from '@/lib/api'
import { CreateProposalSchema, ProposalQuerySchema } from '@/lib/schemas/proposal'

export async function GET(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { searchParams } = new URL(request.url)
  const query = ProposalQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!query.success) return unprocessable(query.error.errors)

  const { status, page, limit } = query.data

  const where = {
    ...(isAdmin ? {} : { matching: { case: { assignedUserId: session.user.id } } }),
    ...(status ? { status } : {}),
  }

  try {
    const [data, total] = await Promise.all([
      prisma.proposal.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.proposal.count({ where }),
    ])
    return ok(data, { total, page, limit })
  } catch {
    return serverError()
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const body = await request.json().catch(() => ({}))
  const parsed = CreateProposalSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.errors)

  try {
    const record = await prisma.proposal.create({ data: parsed.data })
    return created(record)
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 4: `src/app/api/proposals/[id]/route.ts` を実装**

```ts
// src/app/api/proposals/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, forbidden, notFound, unprocessable, serverError, requireAuth } from '@/lib/api'
import { UpdateProposalSchema } from '@/lib/schemas/proposal'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { id } = await params
  const record = await prisma.proposal.findUnique({
    where: { id },
    include: { matching: { include: { case: true, talent: true } } },
  })
  if (!record) return notFound()
  if (!isAdmin && record.matching.case.assignedUserId !== session.user.id) return forbidden()
  return ok(record)
}

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { id } = await params
  const existing = await prisma.proposal.findUnique({ where: { id }, include: { matching: { include: { case: true } } } })
  if (!existing) return notFound()
  if (!isAdmin && existing.matching.case.assignedUserId !== session.user.id) return forbidden()

  const body = await request.json().catch(() => ({}))
  const parsed = UpdateProposalSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.errors)

  try {
    const record = await prisma.proposal.update({ where: { id }, data: parsed.data })
    return ok(record)
  } catch {
    return serverError()
  }
}

export async function DELETE(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { isAdmin } = authResult

  if (!isAdmin) return forbidden()

  const { id } = await params
  const existing = await prisma.proposal.findUnique({ where: { id } })
  if (!existing) return notFound()
  if (existing.status !== 'DRAFT') {
    return unprocessable([{ message: 'Only DRAFT proposals can be deleted' }])
  }

  try {
    const record = await prisma.proposal.delete({ where: { id } })
    return ok(record)
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 5: テストが通ることを確認**

```bash
npx jest src/app/api/proposals --no-coverage
```

- [ ] **Step 6: コミット**

```bash
git add src/app/api/proposals/
git commit -m "feat: add Proposals API (GET/POST/PATCH/DELETE) with RBAC"
```

---

## Task 7: Contracts API

**Files:**
- Create: `src/app/api/contracts/route.ts`
- Create: `src/app/api/contracts/[id]/route.ts`
- Create: `src/app/api/contracts/__tests__/route.test.ts`
- Create: `src/app/api/contracts/__tests__/[id].test.ts`

### 背景知識

- Contract は `Contract.assignedUserId` を直接担当者フィールドとして使う（Case を traverse しない）。
- 一覧の STAFF フィルタ: `where: { assignedUserId: session.user.id }`

- [ ] **Step 1: テストを書く**

```ts
// src/app/api/contracts/__tests__/route.test.ts
/**
 * @jest-environment node
 */
import { GET, POST } from '../route'

const mockFindMany = jest.fn()
const mockCount = jest.fn()
const mockCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count:    (...args: unknown[]) => mockCount(...args),
      create:   (...args: unknown[]) => mockCreate(...args),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

const adminSession = { user: { id: 'admin-id', role: 'ADMIN' } }
const staffSession = { user: { id: 'staff-id', role: 'STAFF' } }

beforeEach(() => jest.clearAllMocks())

describe('GET /api/contracts', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/contracts'))).status).toBe(401)
  })

  it('STAFF filter uses Contract.assignedUserId', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindMany.mockResolvedValueOnce([])
    mockCount.mockResolvedValueOnce(0)
    await GET(new Request('http://localhost/api/contracts'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ assignedUserId: 'staff-id' }) })
    )
  })
})

describe('POST /api/contracts', () => {
  it('creates a contract', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockCreate.mockResolvedValueOnce({ id: 'ct1' })
    const req = new Request('http://localhost/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: 'c-cuid1234567890',
        talentId: 't-cuid1234567890',
        assignedUserId: 'a-cuid1234567890',
        startDate: '2026-04-01',
        unitPrice: 800000,
        costPrice: 600000,
        grossProfitRate: 25.0,
      }),
    })
    expect((await POST(req)).status).toBe(201)
  })
})
```

```ts
// src/app/api/contracts/__tests__/[id].test.ts
/**
 * @jest-environment node
 */
import { GET, PATCH, DELETE } from '../[id]/route'

const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
const mockDelete = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update:     (...args: unknown[]) => mockUpdate(...args),
      delete:     (...args: unknown[]) => mockDelete(...args),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

const adminSession = { user: { id: 'admin-id', role: 'ADMIN' } }
const staffSession = { user: { id: 'staff-id', role: 'STAFF' } }
const params = Promise.resolve({ id: 'contract-1' })

beforeEach(() => jest.clearAllMocks())

describe('GET /api/contracts/[id]', () => {
  it('returns 403 when STAFF accesses other contract', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'contract-1', assignedUserId: 'other-id' })
    expect((await GET(new Request('http://localhost/api/contracts/contract-1'), { params })).status).toBe(403)
  })
})

describe('DELETE /api/contracts/[id]', () => {
  it('returns 403 when STAFF deletes', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    expect((await DELETE(new Request('http://localhost/api/contracts/contract-1'), { params })).status).toBe(403)
  })

  it('ADMIN deletes a contract', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'contract-1' })
    mockDelete.mockResolvedValueOnce({ id: 'contract-1' })
    expect((await DELETE(new Request('http://localhost/api/contracts/contract-1'), { params })).status).toBe(200)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest src/app/api/contracts --no-coverage
```

- [ ] **Step 3: `src/app/api/contracts/route.ts` を実装**

```ts
// src/app/api/contracts/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, created, unprocessable, serverError, requireAuth } from '@/lib/api'
import { CreateContractSchema, ContractQuerySchema } from '@/lib/schemas/contract'

export async function GET(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { searchParams } = new URL(request.url)
  const query = ContractQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!query.success) return unprocessable(query.error.errors)

  const { status, page, limit } = query.data

  const where = {
    ...(isAdmin ? {} : { assignedUserId: session.user.id }),
    ...(status ? { status } : {}),
  }

  try {
    const [data, total] = await Promise.all([
      prisma.contract.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.contract.count({ where }),
    ])
    return ok(data, { total, page, limit })
  } catch {
    return serverError()
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const body = await request.json().catch(() => ({}))
  const parsed = CreateContractSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.errors)

  try {
    const record = await prisma.contract.create({ data: parsed.data })
    return created(record)
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 4: `src/app/api/contracts/[id]/route.ts` を実装**

```ts
// src/app/api/contracts/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, forbidden, notFound, unprocessable, serverError, requireAuth } from '@/lib/api'
import { UpdateContractSchema } from '@/lib/schemas/contract'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { id } = await params
  const record = await prisma.contract.findUnique({ where: { id } })
  if (!record) return notFound()
  if (!isAdmin && record.assignedUserId !== session.user.id) return forbidden()
  return ok(record)
}

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { id } = await params
  const existing = await prisma.contract.findUnique({ where: { id } })
  if (!existing) return notFound()
  if (!isAdmin && existing.assignedUserId !== session.user.id) return forbidden()

  const body = await request.json().catch(() => ({}))
  const parsed = UpdateContractSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.errors)

  try {
    const record = await prisma.contract.update({ where: { id }, data: parsed.data })
    return ok(record)
  } catch {
    return serverError()
  }
}

export async function DELETE(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { isAdmin } = authResult

  if (!isAdmin) return forbidden()

  const { id } = await params
  const existing = await prisma.contract.findUnique({ where: { id } })
  if (!existing) return notFound()

  try {
    const record = await prisma.contract.delete({ where: { id } })
    return ok(record)
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 5: テストが通ることを確認**

```bash
npx jest src/app/api/contracts --no-coverage
```

- [ ] **Step 6: コミット**

```bash
git add src/app/api/contracts/
git commit -m "feat: add Contracts API (GET/POST/PATCH/DELETE) with RBAC"
```

---

## Task 8: Emails API

**Files:**
- Create: `src/app/api/emails/route.ts`
- Create: `src/app/api/emails/[id]/route.ts`
- Create: `src/app/api/emails/__tests__/route.test.ts`
- Create: `src/app/api/emails/__tests__/[id].test.ts`

### 背景知識

- Email は担当者フィールドを持たない。
- STAFF: GET（一覧・詳細）のみ許可。POST/PATCH/DELETE は 403。
- ADMIN: 全操作許可。

- [ ] **Step 1: テストを書く**

```ts
// src/app/api/emails/__tests__/route.test.ts
/**
 * @jest-environment node
 */
import { GET, POST } from '../route'

const mockFindMany = jest.fn()
const mockCount = jest.fn()
const mockCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    email: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count:    (...args: unknown[]) => mockCount(...args),
      create:   (...args: unknown[]) => mockCreate(...args),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

const adminSession = { user: { id: 'admin-id', role: 'ADMIN' } }
const staffSession = { user: { id: 'staff-id', role: 'STAFF' } }

beforeEach(() => jest.clearAllMocks())

describe('GET /api/emails', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/emails'))).status).toBe(401)
  })

  it('STAFF can list emails', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindMany.mockResolvedValueOnce([{ id: 'e1' }])
    mockCount.mockResolvedValueOnce(1)
    const res = await GET(new Request('http://localhost/api/emails'))
    expect(res.status).toBe(200)
  })
})

describe('POST /api/emails', () => {
  it('returns 403 when STAFF creates email', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    const req = new Request('http://localhost/api/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect((await POST(req)).status).toBe(403)
  })

  it('ADMIN creates an email', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockCreate.mockResolvedValueOnce({ id: 'e1' })
    const req = new Request('http://localhost/api/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receivedAt: '2026-03-19T00:00:00Z',
        from: 'Sender Name',
        fromEmail: 'sender@example.com',
        subject: 'Case Offer',
        bodyText: 'We have a case...',
        type: 'CASE',
      }),
    })
    expect((await POST(req)).status).toBe(201)
  })
})
```

```ts
// src/app/api/emails/__tests__/[id].test.ts
/**
 * @jest-environment node
 */
import { GET, PATCH, DELETE } from '../[id]/route'

const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
const mockDelete = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    email: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update:     (...args: unknown[]) => mockUpdate(...args),
      delete:     (...args: unknown[]) => mockDelete(...args),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

const adminSession = { user: { id: 'admin-id', role: 'ADMIN' } }
const staffSession = { user: { id: 'staff-id', role: 'STAFF' } }
const params = Promise.resolve({ id: 'email-1' })

beforeEach(() => jest.clearAllMocks())

describe('GET /api/emails/[id]', () => {
  it('STAFF can read email detail', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'email-1' })
    expect((await GET(new Request('http://localhost/api/emails/email-1'), { params })).status).toBe(200)
  })
})

describe('PATCH /api/emails/[id]', () => {
  it('returns 403 when STAFF patches email', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    const req = new Request('http://localhost/api/emails/email-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PARSED' }),
    })
    expect((await PATCH(req, { params })).status).toBe(403)
  })

  it('ADMIN patches email status', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'email-1' })
    mockUpdate.mockResolvedValueOnce({ id: 'email-1', status: 'PARSED' })
    const req = new Request('http://localhost/api/emails/email-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PARSED' }),
    })
    expect((await PATCH(req, { params })).status).toBe(200)
  })
})

describe('DELETE /api/emails/[id]', () => {
  it('returns 403 when STAFF deletes', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    expect((await DELETE(new Request('http://localhost/api/emails/email-1'), { params })).status).toBe(403)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest src/app/api/emails --no-coverage
```

- [ ] **Step 3: `src/app/api/emails/route.ts` を実装**

```ts
// src/app/api/emails/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, created, forbidden, unprocessable, serverError, requireAuth } from '@/lib/api'
import { CreateEmailSchema, EmailQuerySchema } from '@/lib/schemas/email'

export async function GET(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const { searchParams } = new URL(request.url)
  const query = EmailQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!query.success) return unprocessable(query.error.errors)

  const { type, status, page, limit } = query.data
  const where = {
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
  }

  try {
    const [data, total] = await Promise.all([
      prisma.email.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { receivedAt: 'desc' } }),
      prisma.email.count({ where }),
    ])
    return ok(data, { total, page, limit })
  } catch {
    return serverError()
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { isAdmin } = authResult

  if (!isAdmin) return forbidden()

  const body = await request.json().catch(() => ({}))
  const parsed = CreateEmailSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.errors)

  try {
    const record = await prisma.email.create({ data: parsed.data })
    return created(record)
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 4: `src/app/api/emails/[id]/route.ts` を実装**

```ts
// src/app/api/emails/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, forbidden, notFound, unprocessable, serverError, requireAuth } from '@/lib/api'
import { UpdateEmailSchema } from '@/lib/schemas/email'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params
  const record = await prisma.email.findUnique({ where: { id } })
  if (!record) return notFound()
  return ok(record)
}

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { isAdmin } = authResult

  if (!isAdmin) return forbidden()

  const { id } = await params
  const existing = await prisma.email.findUnique({ where: { id } })
  if (!existing) return notFound()

  const body = await request.json().catch(() => ({}))
  const parsed = UpdateEmailSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.errors)

  try {
    const record = await prisma.email.update({ where: { id }, data: parsed.data })
    return ok(record)
  } catch {
    return serverError()
  }
}

export async function DELETE(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { isAdmin } = authResult

  if (!isAdmin) return forbidden()

  const { id } = await params
  const existing = await prisma.email.findUnique({ where: { id } })
  if (!existing) return notFound()

  try {
    const record = await prisma.email.delete({ where: { id } })
    return ok(record)
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 5: テストが通ることを確認**

```bash
npx jest src/app/api/emails --no-coverage
```

- [ ] **Step 6: 全テストを通す**

```bash
npx jest --no-coverage
```

Expected: 全テスト PASS（既存のログインテストも含む）

- [ ] **Step 7: コミット**

```bash
git add src/app/api/emails/
git commit -m "feat: add Emails API (GET/POST/PATCH/DELETE) with RBAC"
```

---

## 完了チェック

全タスク完了後に確認すること:

```bash
# 全テスト実行
npx jest --no-coverage

# TypeScript コンパイル確認
npx tsc --noEmit
```

Expected:
- 全テスト PASS
- TypeScript エラーなし
