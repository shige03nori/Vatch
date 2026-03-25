# 営業管理画面（Sales Pipeline）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/sales` ページに Matching ベースの営業パイプライン管理画面を実装する。5ステージ管理・ステージ変更・提案確認・成約登録・メモ記入をダークテーマで提供する。

**Architecture:** `Matching.status` を Single Source of Truth とし、`GET /api/sales/pipeline` で Case・Talent・Proposal をネストして取得。フロント側でタブフィルタ・検索を処理し、4種類のモーダルでアクションを実行する。

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Zod, NextAuth.js, Jest + @testing-library/react, Tailwind CSS

---

## File Structure

| ファイル | 変更種別 | 役割 |
|---|---|---|
| `prisma/schema.prisma` | 修正 | Matching に `memo String?` 追加・ActivityLogType に `STAGE_CHANGED`/`MEMO_UPDATED` 追加 |
| `prisma/migrations/` | 新規 | マイグレーションファイル |
| `src/lib/schemas/matching.ts` | 修正 | UpdateMatchingSchema に `memo` と optional `status` を追加 |
| `src/lib/schemas/sales.ts` | 新規 | PipelineQuerySchema（Zod） |
| `src/lib/schemas/contract.ts` | 修正 | `CreateContractSchema` の `proposalId` を必須フィールドに変更 |
| `src/app/api/contracts/route.ts` | 修正 | POST: `assignedUserId` をセッションから自動注入 |
| `src/app/api/matchings/[id]/route.ts` | 修正 | PATCH: `memo` フィールドの更新に対応・ActivityLog 記録 |
| `src/app/api/sales/pipeline/route.ts` | 新規 | GET: パイプラインデータ取得 |
| `src/app/api/sales/pipeline/__tests__/route.test.ts` | 新規 | GET エンドポイントのテスト |
| `src/components/sales/StageBadge.tsx` | 新規 | ステージ名・色定数とバッジコンポーネント |
| `src/components/sales/DetailModal.tsx` | 新規 | 詳細確認＋メモ入力モーダル |
| `src/components/sales/StageChangeModal.tsx` | 新規 | ステージ変更確認モーダル |
| `src/components/sales/ProposalModal.tsx` | 新規 | 提案確認・新規作成モーダル |
| `src/components/sales/ContractModal.tsx` | 新規 | 成約登録モーダル |
| `src/components/sales/PipelineTable.tsx` | 新規 | テーブル・KPIバー・フィルタータブを統合したメインコンポーネント |
| `src/app/(main)/sales/page.tsx` | 新規 | 営業管理画面ページ（データフェッチ） |
| `src/components/layout/Sidebar.tsx` | 修正 | 「営業管理」メニュー項目を営業セクションに追加 |

---

## Task 1: DB マイグレーション

**Files:**
- Modify: `prisma/schema.prisma`

**コンテキスト:** Prisma の `schema.prisma` に2か所変更を加えた後、`npx prisma migrate dev` でマイグレーションを生成する。

- [ ] **Step 1: schema.prisma を修正 — Matching に memo フィールドを追加**

`prisma/schema.prisma` の Matching モデルの `reason` フィールドの直下に追加:

```prisma
  reason          String?        @db.Text
  memo            String?        @db.Text  // 追加
  isAutoSend      Boolean        @default(false)
```

- [ ] **Step 2: schema.prisma を修正 — ActivityLogType enum に追加**

`ActivityLogType` enum の末尾に追加:

```prisma
enum ActivityLogType {
  EMAIL_RECEIVED
  EMAIL_PARSED
  CASE_CREATED
  TALENT_CREATED
  MATCHING_CREATED
  PROPOSAL_SENT
  PROPOSAL_REPLIED
  CONTRACT_CREATED
  CONTRACT_RENEWED
  STAGE_CHANGED   // 追加
  MEMO_UPDATED    // 追加
}
```

- [ ] **Step 3: マイグレーションを生成・適用**

```bash
npx prisma migrate dev --name add_matching_memo_and_activity_types
```

Expected: `The following migration(s) have been applied:` メッセージと新しいマイグレーションファイルが生成される。

- [ ] **Step 4: Prisma クライアントを再生成**

```bash
npx prisma generate
```

- [ ] **Step 5: コミット**

```bash
git add prisma/
git commit -m "feat: Matchingにmemoフィールド追加・ActivityLogTypeにSTAGE_CHANGED/MEMO_UPDATED追加"
```

---

## Task 2: スキーマ更新

**Files:**
- Modify: `src/lib/schemas/matching.ts`
- Create: `src/lib/schemas/sales.ts`

**コンテキスト:** `UpdateMatchingSchema` を拡張して `memo` と `status` を両方 optional に。`sales.ts` には pipeline クエリ用スキーマのみ定義。

- [ ] **Step 1: UpdateMatchingSchema を更新**

`src/lib/schemas/matching.ts` の `UpdateMatchingSchema` を以下に差し替え:

```typescript
export const UpdateMatchingSchema = z.object({
  status: z.enum(['UNPROPOSED','PENDING_AUTO','SENT','REPLIED','INTERVIEWING','CONTRACTED','REJECTED']).optional(),
  memo:   z.string().nullable().optional(),
}).refine(data => data.status !== undefined || data.memo !== undefined, {
  message: 'status または memo のいずれかが必要です',
})
```

- [ ] **Step 2: sales.ts を新規作成**

```typescript
// src/lib/schemas/sales.ts
import { z } from 'zod'

export const PipelineQuerySchema = z.object({
  status: z.enum(['UNPROPOSED','PENDING_AUTO','SENT','REPLIED','INTERVIEWING','CONTRACTED','REJECTED']).optional(),
})
```

- [ ] **Step 3: TypeScript コンパイルエラーがないことを確認**

```bash
npx tsc --noEmit
```

Expected: エラーなし（または関係ないエラーのみ）

- [ ] **Step 4: コミット**

```bash
git add src/lib/schemas/matching.ts src/lib/schemas/sales.ts
git commit -m "feat: UpdateMatchingSchemaにmemo対応追加・PipelineQuerySchema作成"
```

---

## Task 3: API — contracts スキーマ修正 + route.ts 修正

**Files:**
- Modify: `src/lib/schemas/contract.ts`
- Modify: `src/app/api/contracts/route.ts`

**コンテキスト:** `proposalId` を必須フィールドに変更し、`POST /api/contracts` の `assignedUserId` をセッションから自動注入する。既存の GET は変更しない。

- [ ] **Step 1: CreateContractSchema の proposalId を必須に変更**

`src/lib/schemas/contract.ts` の `CreateContractSchema` を修正:

```typescript
export const CreateContractSchema = z.object({
  caseId:          z.string().cuid(),
  talentId:        z.string().cuid(),
  assignedUserId:  z.string().cuid().optional(),  // route 側でセッションから注入するため optional に
  proposalId:      z.string().cuid(),              // optional() を削除して必須に
  startDate:       z.coerce.date(),
  endDate:         z.coerce.date().optional(),
  unitPrice:       z.number().int().positive(),
  costPrice:       z.number().int().positive(),
  grossProfitRate: z.number(),
})
```

- [ ] **Step 3: テストを書く（失敗状態）**

`src/app/api/contracts/__tests__/route.test.ts` を確認し、以下のテストが存在しなければ追加する（ファイルがなければ新規作成）。**既存テストに `assignedUserId` をボディに含んでいるケースがあれば削除する。**

```typescript
/** @jest-environment node */
import { POST } from '../route'

const mockCreate = jest.fn()
const mockFindMany = jest.fn()
const mockCount = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      create:   (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count:    (...args: unknown[]) => mockCount(...args),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

const adminSession = { user: { id: 'admin-id', role: 'ADMIN' } }

beforeEach(() => jest.clearAllMocks())

describe('POST /api/contracts', () => {
  it('assignedUserId はセッションユーザーIDで自動設定される', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockCreate.mockResolvedValueOnce({ id: 'c1' })

    const body = {
      caseId: 'claaaaaaaaaaaaaaaaaaaaaa1',
      talentId: 'claaaaaaaaaaaaaaaaaaaaaa2',
      proposalId: 'claaaaaaaaaaaaaaaaaaaaaa3',
      // assignedUserId は送らない（セッションから自動注入）
      startDate: '2026-04-01',
      unitPrice: 80,
      costPrice: 65,
      grossProfitRate: 18.75,
    }
    const res = await POST(new Request('http://localhost/api/contracts', {
      method: 'POST',
      body: JSON.stringify(body),
    }))
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedUserId: 'admin-id' }) })
    )
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest src/app/api/contracts/__tests__/route.test.ts --no-coverage
```

Expected: FAIL（assignedUserId がセッションから注入されていない）

- [ ] **Step 4: contracts/route.ts の POST を修正**

`POST` 関数内の `parsed.success` 後を以下に差し替え:

```typescript
export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session } = authResult

  const body = await request.json().catch(() => ({}))
  const parsed = CreateContractSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.issues)

  try {
    const record = await prisma.contract.create({
      data: { ...parsed.data, assignedUserId: session.user.id },
    })
    return created(record)
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 5: テストが通ることを確認**

```bash
npx jest src/app/api/contracts/__tests__/route.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/lib/schemas/contract.ts src/app/api/contracts/
git commit -m "feat: CreateContractSchemaのproposalId必須化・contracts POSTでassignedUserId自動注入"
```

---

## Task 4: API — PATCH /api/matchings/[id] 修正

**Files:**
- Modify: `src/app/api/matchings/[id]/route.ts`
- Modify: `src/app/api/matchings/__tests__/[id].test.ts`（既存テストへの追記）

**コンテキスト:** `PATCH` が `memo` の更新に対応していない。`memo` と `status` を両方 optional で受け付け、変更があれば ActivityLog にも記録する。

- [ ] **Step 1: テストを追加（失敗状態）**

`src/app/api/matchings/__tests__/[id].test.ts` に以下を追加:

まずファイルに `mockActivityCreate` モックを追加:

```typescript
const mockActivityCreate = jest.fn()
// 既存の prisma モック内に追加:
// activityLog: { create: (...args: unknown[]) => mockActivityCreate(...args) }
```

テストケースを追加:

```typescript
describe('PATCH /api/matchings/[id] — memo', () => {
  it('memo を更新できる', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    const existing = { id: 'm1', case: { assignedUserId: 'admin-id' } }
    mockFindUnique.mockResolvedValueOnce(existing)
    mockUpdate.mockResolvedValueOnce({ id: 'm1', memo: 'テストメモ' })
    mockActivityCreate.mockResolvedValueOnce({})

    const res = await PATCH(
      new Request('http://localhost/api/matchings/m1', {
        method: 'PATCH',
        body: JSON.stringify({ memo: 'テストメモ' }),
      }),
      { params: Promise.resolve({ id: 'm1' }) }
    )
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ memo: 'テストメモ' }) })
    )
  })

  it('status 変更時に STAGE_CHANGED を ActivityLog に記録する', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    const existing = { id: 'm1', status: 'SENT', case: { assignedUserId: 'admin-id', id: 'case-1' }, talentId: 'talent-1' }
    mockFindUnique.mockResolvedValueOnce(existing)
    mockUpdate.mockResolvedValueOnce({ id: 'm1', status: 'REPLIED' })
    mockActivityCreate.mockResolvedValueOnce({})

    await PATCH(
      new Request('http://localhost/api/matchings/m1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'REPLIED' }),
      }),
      { params: Promise.resolve({ id: 'm1' }) }
    )
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'STAGE_CHANGED', matchingId: 'm1' }),
      })
    )
  })

  it('status も memo も未指定の場合 422 を返す', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'm1', case: { assignedUserId: 'admin-id' } })
    const res = await PATCH(
      new Request('http://localhost/api/matchings/m1', {
        method: 'PATCH',
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: 'm1' }) }
    )
    expect(res.status).toBe(422)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest "src/app/api/matchings/__tests__/\[id\].test.ts" --no-coverage
```

Expected: FAIL

- [ ] **Step 3: PATCH 実装を更新**

`src/app/api/matchings/[id]/route.ts` の PATCH 関数を更新:

```typescript
export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { id } = await params
  try {
    const existing = await prisma.matching.findUnique({ where: { id }, include: { case: true } })
    if (!existing) return notFound()
    if (!isAdmin && existing.case.assignedUserId !== session.user.id) return forbidden()

    const body = await request.json().catch(() => ({}))
    const parsed = UpdateMatchingSchema.safeParse(body)
    if (!parsed.success) return unprocessable(parsed.error.issues)

    const record = await prisma.matching.update({ where: { id }, data: parsed.data })

    // ActivityLog 記録
    if (parsed.data.status !== undefined) {
      await prisma.activityLog.create({
        data: {
          type: 'STAGE_CHANGED',
          description: `ステージ変更: ${existing.status} → ${parsed.data.status}`,
          userId: session.user.id,
          matchingId: id,
          caseId: existing.caseId,
          talentId: existing.talentId,
        },
      })
    }
    if (parsed.data.memo !== undefined) {
      await prisma.activityLog.create({
        data: {
          type: 'MEMO_UPDATED',
          description: 'メモを更新しました',
          userId: session.user.id,
          matchingId: id,
          caseId: existing.caseId,
          talentId: existing.talentId,
        },
      })
    }

    return ok(record)
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest "src/app/api/matchings/__tests__/\[id\].test.ts" --no-coverage
```

Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/app/api/matchings/
git commit -m "feat: PATCH /api/matchings/[id] にmemo対応・ActivityLog記録を追加"
```

---

## Task 5: API — GET /api/sales/pipeline

**Files:**
- Create: `src/app/api/sales/pipeline/route.ts`
- Create: `src/app/api/sales/pipeline/__tests__/route.test.ts`

**コンテキスト:** Matching 一覧を Case（assignedUser 含む）・Talent・Proposal をネストして返す。既存 GET /api/matchings とは別の専用エンドポイント。

- [ ] **Step 1: テストファイルを作成（失敗状態）**

```typescript
// src/app/api/sales/pipeline/__tests__/route.test.ts
/** @jest-environment node */
import { GET } from '../route'

const mockFindMany = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    matching: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

const adminSession = { user: { id: 'admin-id', role: 'ADMIN' } }
const staffSession = { user: { id: 'staff-id', role: 'STAFF' } }

beforeEach(() => jest.clearAllMocks())

describe('GET /api/sales/pipeline', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost/api/sales/pipeline'))
    expect(res.status).toBe(401)
  })

  it('ADMIN gets all matchings with nested case/talent/proposal', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindMany.mockResolvedValueOnce([{
      id: 'm1',
      status: 'SENT',
      score: 92,
      memo: null,
      case: { id: 'c1', title: 'Java案件', client: '株式会社A', unitPrice: 80, assignedUser: { name: '佐藤' } },
      talent: { id: 't1', name: '田中', skills: ['Java'], experience: 8 },
      proposal: { id: 'p1', status: 'SENT', to: 'a@example.com', sentAt: new Date() },
    }])

    const res = await GET(new Request('http://localhost/api/sales/pipeline'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].case.assignedUser).toBeDefined()
    expect(body.data[0].proposal).toBeDefined()
  })

  it('STAFF gets only matchings for their assigned cases', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindMany.mockResolvedValueOnce([])

    await GET(new Request('http://localhost/api/sales/pipeline'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ case: { assignedUserId: 'staff-id' } }),
      })
    )
  })

  it('status クエリパラメータでフィルタリングできる', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindMany.mockResolvedValueOnce([])

    await GET(new Request('http://localhost/api/sales/pipeline?status=SENT'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'SENT' }) })
    )
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest src/app/api/sales/pipeline/__tests__/route.test.ts --no-coverage
```

Expected: FAIL（ファイルが存在しない）

- [ ] **Step 3: ルートを実装**

```typescript
// src/app/api/sales/pipeline/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, unprocessable, serverError, requireAuth } from '@/lib/api'
import { PipelineQuerySchema } from '@/lib/schemas/sales'

export async function GET(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const { searchParams } = new URL(request.url)
  const query = PipelineQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!query.success) return unprocessable(query.error.issues)

  const { status } = query.data

  const where = {
    ...(isAdmin ? {} : { case: { assignedUserId: session.user.id } }),
    ...(status ? { status } : {}),
  }

  try {
    const data = await prisma.matching.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        case: {
          include: {
            assignedUser: { select: { id: true, name: true } },
          },
        },
        talent: {
          select: { id: true, name: true, skills: true, experience: true, desiredRate: true },
        },
        proposal: {
          select: { id: true, status: true, to: true, cc: true, subject: true, bodyText: true, sentAt: true, grossProfitRate: true, costPrice: true, sellPrice: true },
        },
      },
    })
    return ok(data)
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest src/app/api/sales/pipeline/__tests__/route.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/app/api/sales/ src/lib/schemas/sales.ts
git commit -m "feat: GET /api/sales/pipeline エンドポイントを追加"
```

---

## Task 6: StageBadge コンポーネント

**Files:**
- Create: `src/components/sales/StageBadge.tsx`

**コンテキスト:** ステージ名・色・ラベルの定数定義とバッジコンポーネント。他のコンポーネントから参照される共通の定義ファイル。

- [ ] **Step 1: StageBadge.tsx を作成**

```typescript
// src/components/sales/StageBadge.tsx

export type PipelineStage =
  | 'UNPROPOSED'
  | 'PENDING_AUTO'
  | 'SENT'
  | 'REPLIED'
  | 'INTERVIEWING'
  | 'CONTRACTED'
  | 'REJECTED'

export const STAGE_CONFIG: Record<PipelineStage, { label: string; color: string; bg: string; border: string }> = {
  UNPROPOSED:  { label: '未提案',       color: '#9ca3af', bg: '#1a1a1a',  border: '#374151' },
  PENDING_AUTO:{ label: '提案準備中',   color: '#fbbf24', bg: '#1c1408',  border: '#78350f' },
  SENT:        { label: '提案送信済み', color: '#60a5fa', bg: '#0d1f3c',  border: '#1e3a5f' },
  REPLIED:     { label: '返答あり',     color: '#c084fc', bg: '#1a1230',  border: '#4c1d95' },
  INTERVIEWING:{ label: '商談中',       color: '#c084fc', bg: '#1a1230',  border: '#4c1d95' },
  CONTRACTED:  { label: '成約',         color: '#4ade80', bg: '#052e16',  border: '#166534' },
  REJECTED:    { label: '失注',         color: '#f87171', bg: '#1f0a0a',  border: '#7f1d1d' },
}

/** パイプライン上の表示ステージ（未提案を除く5段階） */
export const PIPELINE_STAGES: PipelineStage[] = [
  'PENDING_AUTO',
  'SENT',
  'REPLIED',
  'INTERVIEWING',
  'CONTRACTED',
  'REJECTED',
]

interface StageBadgeProps {
  status: PipelineStage
  className?: string
}

export function StageBadge({ status, className = '' }: StageBadgeProps) {
  const config = STAGE_CONFIG[status]
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${className}`}
      style={{ color: config.color, background: config.bg, border: `1px solid ${config.border}` }}
    >
      {config.label}
    </span>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/sales/StageBadge.tsx
git commit -m "feat: StageBadgeコンポーネントとステージ定数を追加"
```

---

## Task 7: DetailModal コンポーネント

**Files:**
- Create: `src/components/sales/DetailModal.tsx`

**コンテキスト:** Matching の詳細情報（案件・人材・スコア内訳）を表示し、メモを入力・保存するモーダル。`PATCH /api/matchings/[id]` に `memo` を送って更新する。

- [ ] **Step 1: DetailModal.tsx を作成**

```typescript
// src/components/sales/DetailModal.tsx
'use client'

import { useState } from 'react'
import type { PipelineMatching } from '@/app/(main)/sales/page'

interface Props {
  matching: PipelineMatching
  onClose: () => void
  onMemoSaved: (matchingId: string, memo: string) => void
}

export function DetailModal({ matching, onClose, onMemoSaved }: Props) {
  const [memo, setMemo] = useState(matching.memo ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/matchings/${matching.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo }),
      })
      if (!res.ok) throw new Error('保存失敗')
      onMemoSaved(matching.id, memo)
    } finally {
      setSaving(false)
    }
  }

  const { case: c, talent } = matching

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#111] border border-[#2a2a2a] rounded-xl w-[540px] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-bold text-white">
            詳細 — {c.title} × {talent.name}
          </h2>
          <button onClick={onClose} className="text-[#555] hover:text-white text-lg">✕</button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* 案件情報 */}
          <section>
            <p className="text-[10px] text-[#555] uppercase tracking-widest mb-2">案件情報</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['顧客', c.client],
                ['単価', `${c.unitPrice}万円/月`],
                ['スタート', c.startDate ? new Date(c.startDate).toLocaleDateString('ja-JP') : '—'],
                ['勤務形態', c.workStyle],
              ].map(([k, v]) => (
                <div key={k} className="bg-[#1a1a1a] rounded-lg px-3 py-2">
                  <p className="text-[10px] text-[#555]">{k}</p>
                  <p className="text-sm font-semibold text-[#e0e0e0]">{v}</p>
                </div>
              ))}
            </div>
            {c.skills?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {c.skills.map((s: string) => (
                  <span key={s} className="text-[11px] px-2 py-0.5 rounded bg-[#0d1f3c] text-[#60a5fa]">{s}</span>
                ))}
              </div>
            )}
          </section>

          {/* 人材情報 */}
          <section>
            <p className="text-[10px] text-[#555] uppercase tracking-widest mb-2">人材情報</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#1a1a1a] rounded-lg px-3 py-2">
                <p className="text-[10px] text-[#555]">経験年数</p>
                <p className="text-sm font-semibold text-[#e0e0e0]">{talent.experience}年</p>
              </div>
              <div className="bg-[#1a1a1a] rounded-lg px-3 py-2">
                <p className="text-[10px] text-[#555]">希望単価</p>
                <p className="text-sm font-semibold text-[#e0e0e0]">{talent.desiredRate}万円/月</p>
              </div>
            </div>
          </section>

          {/* スコア内訳 */}
          <section>
            <p className="text-[10px] text-[#555] uppercase tracking-widest mb-2">
              マッチングスコア {matching.score}%
            </p>
            <div className="bg-[#1a1a1a] rounded-lg px-3 py-2 space-y-2">
              {[
                ['スキルマッチ', matching.skillMatchRate, true],
                ['単価適合', matching.unitPriceOk ? 100 : 0, matching.unitPriceOk],
                ['タイミング', matching.timingOk ? 100 : 0, matching.timingOk],
                ['勤務地', matching.locationOk ? 100 : 0, matching.locationOk],
              ].map(([label, val, ok]) => (
                <div key={label as string} className="flex items-center gap-3 text-xs">
                  <span className="w-24 text-[#888]">{label as string}</span>
                  <div className="flex-1 h-1 bg-[#2a2a2a] rounded">
                    <div
                      className="h-1 rounded"
                      style={{
                        width: `${val}%`,
                        background: ok ? '#4ade80' : '#f87171',
                      }}
                    />
                  </div>
                  <span style={{ color: ok ? '#4ade80' : '#f87171' }}>
                    {typeof val === 'number' && val !== 100 && val !== 0 ? `${val}%` : (ok ? 'OK' : 'NG')}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* メモ */}
          <section>
            <p className="text-[10px] text-[#555] uppercase tracking-widest mb-2">メモ</p>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              rows={3}
              placeholder="商談メモを入力..."
              className="w-full bg-[#1a1a1a] border border-[#333] text-[#e0e0e0] rounded-lg px-3 py-2 text-xs resize-none outline-none placeholder:text-[#555]"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg bg-[#1e1e1e] text-[#888] border border-[#333]">
                閉じる
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-xs rounded-lg bg-[#2563eb] text-white font-semibold disabled:opacity-50"
              >
                {saving ? '保存中...' : 'メモ保存'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/sales/DetailModal.tsx
git commit -m "feat: DetailModalコンポーネントを追加（案件・人材詳細＋メモ入力）"
```

---

## Task 8: StageChangeModal コンポーネント

**Files:**
- Create: `src/components/sales/StageChangeModal.tsx`

**コンテキスト:** ステージ変更時の確認モーダル。変更前後のステージバッジを表示し、確認後に `PATCH /api/matchings/[id]` で `status` を更新する。

- [ ] **Step 1: StageChangeModal.tsx を作成**

```typescript
// src/components/sales/StageChangeModal.tsx
'use client'

import { useState } from 'react'
import { StageBadge, STAGE_CONFIG, type PipelineStage } from './StageBadge'

interface Props {
  matchingId: string
  fromStatus: PipelineStage
  toStatus: PipelineStage
  onClose: () => void
  onConfirmed: (matchingId: string, newStatus: PipelineStage) => void
}

export function StageChangeModal({ matchingId, fromStatus, toStatus, onClose, onConfirmed }: Props) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      const res = await fetch(`/api/matchings/${matchingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: toStatus }),
      })
      if (!res.ok) throw new Error('更新失敗')
      onConfirmed(matchingId, toStatus)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#111] border border-[#2a2a2a] rounded-xl w-[420px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-bold text-white">ステージ変更の確認</h2>
          <button onClick={onClose} className="text-[#555] hover:text-white text-lg">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-3">
            <StageBadge status={fromStatus} />
            <span className="text-[#555] text-lg">→</span>
            <StageBadge status={toStatus} />
          </div>

          <p className="text-xs text-[#888]">
            ステージを <strong className="text-[#e0e0e0]">{STAGE_CONFIG[fromStatus].label}</strong> から{' '}
            <strong className="text-[#e0e0e0]">{STAGE_CONFIG[toStatus].label}</strong> に変更します。
          </p>

          <div>
            <p className="text-[10px] text-[#555] uppercase tracking-widest mb-1.5">変更メモ（任意）</p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="例：先方から連絡があり商談を設定"
              className="w-full bg-[#1a1a1a] border border-[#333] text-[#e0e0e0] rounded-lg px-3 py-2 text-xs resize-none outline-none placeholder:text-[#555]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg bg-[#1e1e1e] text-[#888] border border-[#333]">
              キャンセル
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="px-4 py-2 text-xs rounded-lg bg-[#2563eb] text-white font-semibold disabled:opacity-50"
            >
              {loading ? '更新中...' : '変更する'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/sales/StageChangeModal.tsx
git commit -m "feat: StageChangeModalコンポーネントを追加"
```

---

## Task 9: ProposalModal コンポーネント

**Files:**
- Create: `src/components/sales/ProposalModal.tsx`

**コンテキスト:** Matching に紐づく Proposal の確認・再送信・取り消し・新規作成を行うモーダル。Proposal は Matching に一対一で対応する（`Proposal.matchingId @unique`）。

- [ ] **Step 1: ProposalModal.tsx を作成**

```typescript
// src/components/sales/ProposalModal.tsx
'use client'

import { useState } from 'react'
import type { PipelineMatching } from '@/app/(main)/sales/page'

interface Props {
  matching: PipelineMatching
  onClose: () => void
  onUpdated: () => void
}

const PROPOSAL_STATUS_LABEL: Record<string, string> = {
  DRAFT: '下書き',
  PENDING_AUTO: '自動送信待ち',
  SENT: '送信済み',
  REPLIED: '返答あり',
  REJECTED: '不採用',
}

export function ProposalModal({ matching, onClose, onUpdated }: Props) {
  const [loading, setLoading] = useState(false)
  const proposal = matching.proposal

  async function handleResend() {
    if (!proposal) return
    setLoading(true)
    try {
      await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.id }),
      })
      onUpdated()
    } finally {
      setLoading(false)
    }
  }

  async function handleRevoke() {
    if (!proposal) return
    setLoading(true)
    try {
      await fetch(`/api/proposals/${proposal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DRAFT' }),
      })
      onUpdated()
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    setLoading(true)
    try {
      await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchingId: matching.id }),
      })
      onUpdated()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#111] border border-[#2a2a2a] rounded-xl w-[540px] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-bold text-white">
            提案 — {matching.case.title} × {matching.talent.name}
          </h2>
          <button onClick={onClose} className="text-[#555] hover:text-white text-lg">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {proposal ? (
            <>
              {/* 提案状況 */}
              <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-lg px-4 py-3 space-y-2 text-xs">
                {[
                  ['ステータス', PROPOSAL_STATUS_LABEL[proposal.status] ?? proposal.status],
                  ['送信日時', proposal.sentAt ? new Date(proposal.sentAt).toLocaleString('ja-JP') : '—'],
                  ['送信先', proposal.to],
                  ['粗利率', `${proposal.grossProfitRate?.toFixed(1)}%`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-[#888]">{k}</span>
                    <span className="text-[#e0e0e0]">{v}</span>
                  </div>
                ))}
              </div>

              {/* メール本文 */}
              <div>
                <p className="text-[10px] text-[#555] uppercase tracking-widest mb-1.5">提案メール本文</p>
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-[#ccc] leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {proposal.bodyText}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg bg-[#1e1e1e] text-[#888] border border-[#333]">
                  閉じる
                </button>
                <button
                  onClick={handleRevoke}
                  disabled={loading}
                  className="px-4 py-2 text-xs rounded-lg bg-[#1f0a0a] text-[#f87171] border border-[#7f1d1d] disabled:opacity-50"
                >
                  提案を取り消す
                </button>
                <button
                  onClick={handleResend}
                  disabled={loading}
                  className="px-4 py-2 text-xs rounded-lg bg-[#2563eb] text-white font-semibold disabled:opacity-50"
                >
                  {loading ? '処理中...' : '再送信'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-[#888]">このマッチングにはまだ提案がありません。新規作成します。</p>
              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg bg-[#1e1e1e] text-[#888] border border-[#333]">
                  キャンセル
                </button>
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className="px-4 py-2 text-xs rounded-lg bg-[#2563eb] text-white font-semibold disabled:opacity-50"
                >
                  {loading ? '作成中...' : '提案を作成'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/sales/ProposalModal.tsx
git commit -m "feat: ProposalModalコンポーネントを追加（提案確認・再送信・取り消し）"
```

---

## Task 10: ContractModal コンポーネント

**Files:**
- Create: `src/components/sales/ContractModal.tsx`

**コンテキスト:** 成約登録モーダル。`POST /api/contracts` に `proposalId`・`caseId`・`talentId`・`unitPrice`・`costPrice` を送る。`assignedUserId` はサーバー側でセッションから自動注入。成約後に `PATCH /api/matchings/[id]` で status を `CONTRACTED` に更新。

- [ ] **Step 1: ContractModal.tsx を作成**

```typescript
// src/components/sales/ContractModal.tsx
'use client'

import { useState } from 'react'
import type { PipelineMatching } from '@/app/(main)/sales/page'

interface Props {
  matching: PipelineMatching
  onClose: () => void
  onContracted: (matchingId: string) => void
}

export function ContractModal({ matching, onClose, onContracted }: Props) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [unitPrice, setUnitPrice] = useState(String(matching.case.unitPrice ?? ''))
  const [costPrice, setCostPrice] = useState(String(matching.costPrice ?? ''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const grossProfitRate = unitPrice && costPrice
    ? ((Number(unitPrice) - Number(costPrice)) / Number(unitPrice)) * 100
    : null
  const grossProfitAmount = unitPrice && costPrice
    ? Number(unitPrice) - Number(costPrice)
    : null

  async function handleSubmit() {
    if (!startDate || !unitPrice || !costPrice) {
      setError('契約開始日・売価・原価は必須です')
      return
    }
    if (!matching.proposal?.id) {
      setError('提案が存在しないため成約登録できません')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: matching.caseId,
          talentId: matching.talentId,
          proposalId: matching.proposal.id,
          startDate,
          endDate: endDate || undefined,
          unitPrice: Number(unitPrice),
          costPrice: Number(costPrice),
          grossProfitRate: grossProfitRate ?? 0,
        }),
      })
      if (!res.ok) throw new Error('成約登録失敗')

      // ステージを CONTRACTED に更新
      await fetch(`/api/matchings/${matching.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CONTRACTED' }),
      })

      onContracted(matching.id)
    } catch (e) {
      setError('登録に失敗しました。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#111] border border-[#2a2a2a] rounded-xl w-[440px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-bold text-white">
            成約登録 — {matching.case.title} × {matching.talent.name}
          </h2>
          <button onClick={onClose} className="text-[#555] hover:text-white text-lg">✕</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {[
            { label: '契約開始日', value: startDate, setter: setStartDate, placeholder: '2026-04-01', required: true },
            { label: '契約終了予定日', value: endDate, setter: setEndDate, placeholder: '2026-09-30', required: false },
          ].map(({ label, value, setter, placeholder, required }) => (
            <div key={label}>
              <label className="text-[11px] text-[#888] block mb-1">{label}{required && <span className="text-[#f87171] ml-1">*</span>}</label>
              <input
                type="text"
                value={value}
                onChange={e => setter(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-[#1a1a1a] border border-[#333] text-[#e0e0e0] rounded-lg px-3 py-2 text-xs outline-none"
              />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '売価（万円/月）', value: unitPrice, setter: setUnitPrice },
              { label: '原価（万円/月）', value: costPrice, setter: setCostPrice },
            ].map(({ label, value, setter }) => (
              <div key={label}>
                <label className="text-[11px] text-[#888] block mb-1">{label} <span className="text-[#f87171]">*</span></label>
                <input
                  type="number"
                  value={value}
                  onChange={e => setter(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#333] text-[#e0e0e0] rounded-lg px-3 py-2 text-xs outline-none"
                />
              </div>
            ))}
          </div>

          {grossProfitRate !== null && (
            <div className="bg-[#052e16] border border-[#166534] rounded-lg px-4 py-2 flex gap-6 text-xs">
              <span className="text-[#888]">粗利率：<strong className="text-[#4ade80] text-base">{grossProfitRate.toFixed(1)}%</strong></span>
              <span className="text-[#888]">粗利額：<strong className="text-[#4ade80]">{grossProfitAmount}万円/月</strong></span>
            </div>
          )}

          {error && <p className="text-xs text-[#f87171]">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg bg-[#1e1e1e] text-[#888] border border-[#333]">
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 text-xs rounded-lg bg-[#166534] text-[#4ade80] font-semibold disabled:opacity-50"
            >
              {loading ? '登録中...' : '成約登録'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/sales/ContractModal.tsx
git commit -m "feat: ContractModalコンポーネントを追加（成約登録・粗利率リアルタイム計算）"
```

---

## Task 11: PipelineTable コンポーネント

**Files:**
- Create: `src/components/sales/PipelineTable.tsx`

**コンテキスト:** KPIバー・タブフィルター・検索・テーブルを統合したメインコンポーネント。モーダルの開閉状態を管理する。`PipelineMatching` 型は `page.tsx` で定義されたものをインポートする。

- [ ] **Step 1: PipelineTable.tsx を作成**

```typescript
// src/components/sales/PipelineTable.tsx
'use client'

import { useState, useMemo } from 'react'
import type { PipelineMatching } from '@/app/(main)/sales/page'
import { StageBadge, STAGE_CONFIG, PIPELINE_STAGES, type PipelineStage } from './StageBadge'
import { DetailModal } from './DetailModal'
import { StageChangeModal } from './StageChangeModal'
import { ProposalModal } from './ProposalModal'
import { ContractModal } from './ContractModal'

interface Props {
  initialData: PipelineMatching[]
}

type ModalState =
  | { type: 'detail'; matching: PipelineMatching }
  | { type: 'stage'; matching: PipelineMatching; toStatus: PipelineStage }
  | { type: 'proposal'; matching: PipelineMatching }
  | { type: 'contract'; matching: PipelineMatching }
  | null

export function PipelineTable({ initialData }: Props) {
  const [data, setData] = useState<PipelineMatching[]>(initialData)
  const [activeTab, setActiveTab] = useState<PipelineStage | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>(null)

  // KPI カウント
  const kpi = useMemo(() => {
    const counts: Record<string, number> = {}
    let contractedRevenue = 0
    for (const m of data) {
      counts[m.status] = (counts[m.status] ?? 0) + 1
      if (m.status === 'CONTRACTED') contractedRevenue += m.sellPrice ?? 0
    }
    return { counts, contractedRevenue }
  }, [data])

  // フィルタリング
  const filtered = useMemo(() => {
    return data.filter(m => {
      if (activeTab !== 'ALL' && m.status !== activeTab) return false
      if (search) {
        const q = search.toLowerCase()
        if (!m.case.title.toLowerCase().includes(q) && !m.talent.name.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [data, activeTab, search])

  // ステージ変更ドロップダウン
  function handleStageSelect(matching: PipelineMatching, newStatus: PipelineStage) {
    if (newStatus === matching.status) return
    setModal({ type: 'stage', matching, toStatus: newStatus })
  }

  // モーダルコールバック
  function handleMemoSaved(matchingId: string, memo: string) {
    setData(prev => prev.map(m => m.id === matchingId ? { ...m, memo } : m))
    setModal(null)
  }

  function handleStageConfirmed(matchingId: string, newStatus: PipelineStage) {
    setData(prev => prev.map(m => m.id === matchingId ? { ...m, status: newStatus } : m))
    setModal(null)
  }

  function handleContracted(matchingId: string) {
    setData(prev => prev.map(m => m.id === matchingId ? { ...m, status: 'CONTRACTED' as PipelineStage } : m))
    setModal(null)
  }

  const kpiItems: { key: PipelineStage; label: string; color: string }[] = [
    { key: 'PENDING_AUTO', label: '提案準備中', color: '#fbbf24' },
    { key: 'SENT',         label: '提案送信済み', color: '#60a5fa' },
    { key: 'INTERVIEWING', label: '商談中',      color: '#c084fc' },
    { key: 'CONTRACTED',   label: '成約',         color: '#4ade80' },
    { key: 'REJECTED',     label: '失注',          color: '#f87171' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* KPI バー */}
      <div className="grid grid-cols-5 border-b border-[#2a2a2a]">
        {kpiItems.map(({ key, label, color }) => (
          <div key={key} className="px-4 py-3 text-center border-r border-[#2a2a2a] last:border-r-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color }}>
              {label}
            </p>
            <p className="text-2xl font-bold mt-0.5" style={{ color }}>
              {(kpi.counts[key] ?? 0)}
            </p>
            <p className="text-[10px] text-[#555]">
              {key === 'CONTRACTED' ? `件 / ¥${kpi.contractedRevenue.toLocaleString()}万` : '件'}
            </p>
          </div>
        ))}
      </div>

      {/* フィルタータブ + 検索 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2a2a2a] bg-[#0d0d0d]">
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-1 rounded-full text-xs font-semibold ${activeTab === 'ALL' ? 'bg-[#2563eb] text-white' : 'bg-[#1e1e1e] text-[#aaa]'}`}
          >
            全件 ({data.length})
          </button>
          {kpiItems.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-3.5 py-1 rounded-full text-xs ${activeTab === key ? 'bg-[#2563eb] text-white font-semibold' : 'bg-[#1e1e1e] text-[#aaa]'}`}
            >
              {label} ({kpi.counts[key] ?? 0})
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="案件名・人材名で検索..."
          className="bg-[#1a1a1a] border border-[#333] text-[#ddd] px-3 py-1.5 rounded-lg text-xs w-52 outline-none placeholder:text-[#555]"
        />
      </div>

      {/* テーブルヘッダー */}
      <div className="grid grid-cols-[2fr_1.5fr_60px_70px_70px_80px_110px_140px] gap-2 px-4 py-2 bg-[#0d0d0d] text-[10px] font-semibold text-[#555] uppercase tracking-widest border-b border-[#2a2a2a]">
        <span>案件名</span><span>人材名</span><span>スコア</span>
        <span>単価</span><span>粗利率</span><span>担当者</span>
        <span>ステージ</span><span>アクション</span>
      </div>

      {/* テーブル本体 */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-[#444]">
            該当するデータがありません
          </div>
        ) : (
          filtered.map(m => {
            const scoreColor = m.score >= 85 ? '#4ade80' : m.score >= 70 ? '#facc15' : '#9ca3af'
            const profitColor = m.grossProfitRate >= 0.15 ? '#4ade80' : m.grossProfitRate >= 0.10 ? '#facc15' : '#9ca3af'
            const canContract = m.status === 'REPLIED' || m.status === 'INTERVIEWING'

            return (
              <div
                key={m.id}
                className="grid grid-cols-[2fr_1.5fr_60px_70px_70px_80px_110px_140px] gap-2 px-4 py-2.5 border-b border-[#1a1a1a] text-xs items-center hover:bg-[#181818] transition-colors"
              >
                <div>
                  <p className="font-semibold text-[#e0e0e0]">{m.case.title}</p>
                  <p className="text-[#555] text-[11px]">{m.case.client}</p>
                  {m.memo && (
                    <p className="text-[10px] text-[#a78bfa] mt-0.5 truncate max-w-[180px]">
                      📝 {m.memo}
                    </p>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-[#e0e0e0]">{m.talent.name}</p>
                  <p className="text-[#555] text-[11px]">
                    {m.talent.skills?.slice(0, 2).join('/')} {m.talent.experience}年
                  </p>
                </div>
                <span style={{ color: scoreColor }} className="font-bold">{m.score}%</span>
                <span className="text-[#e0e0e0]">{m.case.unitPrice}万</span>
                <span style={{ color: profitColor }}>
                  {(m.grossProfitRate * 100).toFixed(0)}%
                </span>
                <span className="text-[#888]">{m.case.assignedUser?.name ?? '—'}</span>

                {/* ステージドロップダウン */}
                <select
                  value={m.status}
                  onChange={e => handleStageSelect(m, e.target.value as PipelineStage)}
                  className="text-[11px] px-2 py-1.5 rounded-md border outline-none w-full"
                  style={{
                    background: STAGE_CONFIG[m.status as PipelineStage]?.bg ?? '#1a1a1a',
                    color: STAGE_CONFIG[m.status as PipelineStage]?.color ?? '#e0e0e0',
                    borderColor: STAGE_CONFIG[m.status as PipelineStage]?.border ?? '#333',
                  }}
                >
                  {PIPELINE_STAGES.map(s => (
                    <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>
                  ))}
                </select>

                {/* アクションボタン */}
                <div className="flex gap-1 flex-wrap">
                  <button
                    onClick={() => setModal({ type: 'detail', matching: m })}
                    className="px-2 py-1 text-[10px] rounded bg-[#1e1e1e] text-[#aaa] border border-[#333] hover:bg-[#2a2a2a]"
                  >
                    詳細
                  </button>
                  <button
                    onClick={() => setModal({ type: 'proposal', matching: m })}
                    className="px-2 py-1 text-[10px] rounded bg-[#1e3a5f] text-[#60a5fa] hover:bg-[#163556]"
                  >
                    提案
                  </button>
                  <button
                    onClick={() => canContract && setModal({ type: 'contract', matching: m })}
                    className={`px-2 py-1 text-[10px] rounded ${canContract ? 'bg-[#052e16] text-[#4ade80] hover:bg-[#073d1e]' : 'bg-[#111] text-[#333] cursor-not-allowed'}`}
                    disabled={!canContract}
                  >
                    成約
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* モーダル */}
      {modal?.type === 'detail' && (
        <DetailModal
          matching={modal.matching}
          onClose={() => setModal(null)}
          onMemoSaved={handleMemoSaved}
        />
      )}
      {modal?.type === 'stage' && (
        <StageChangeModal
          matchingId={modal.matching.id}
          fromStatus={modal.matching.status as PipelineStage}
          toStatus={modal.toStatus}
          onClose={() => setModal(null)}
          onConfirmed={handleStageConfirmed}
        />
      )}
      {modal?.type === 'proposal' && (
        <ProposalModal
          matching={modal.matching}
          onClose={() => setModal(null)}
          onUpdated={() => setModal(null)}
        />
      )}
      {modal?.type === 'contract' && (
        <ContractModal
          matching={modal.matching}
          onClose={() => setModal(null)}
          onContracted={handleContracted}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/sales/PipelineTable.tsx
git commit -m "feat: PipelineTableコンポーネントを追加（KPIバー・タブ・テーブル・モーダル統合）"
```

---

## Task 12: /sales/page.tsx

**Files:**
- Create: `src/app/(main)/sales/page.tsx`

**コンテキスト:** Server Component としてデータを取得し、`PipelineTable` に渡す。`PipelineMatching` 型をここで定義してエクスポートし、各コンポーネントからインポートさせる。

- [ ] **Step 1: page.tsx を作成**

Prisma を直接呼び出す Server Component として実装する（API フェッチよりも安全で確実）。

```typescript
// src/app/(main)/sales/page.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PipelineTable } from '@/components/sales/PipelineTable'

// 型定義をここで集約してエクスポート（各コンポーネントからインポートする）
export type PipelineMatching = {
  id: string
  caseId: string
  talentId: string
  status: string
  score: number
  skillMatchRate: number
  unitPriceOk: boolean
  timingOk: boolean
  locationOk: boolean
  costPrice: number
  sellPrice: number
  grossProfitRate: number
  memo: string | null
  case: {
    id: string
    title: string
    client: string
    unitPrice: number
    workStyle: string
    startDate: Date | null
    skills: string[]
    assignedUser: { id: string; name: string | null } | null
  }
  talent: {
    id: string
    name: string
    skills: string[]
    experience: number
    desiredRate: number | null
  }
  proposal: {
    id: string
    status: string
    to: string
    cc: string | null
    subject: string
    bodyText: string
    sentAt: Date | null
    grossProfitRate: number
    costPrice: number
    sellPrice: number
  } | null
}

export default async function SalesPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const isAdmin = session.user.role === 'ADMIN'
  const where = isAdmin ? {} : { case: { assignedUserId: session.user.id } }

  const data = await prisma.matching.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      case: {
        include: { assignedUser: { select: { id: true, name: true } } },
      },
      talent: {
        select: { id: true, name: true, skills: true, experience: true, desiredRate: true },
      },
      proposal: {
        select: {
          id: true, status: true, to: true, cc: true,
          subject: true, bodyText: true, sentAt: true,
          grossProfitRate: true, costPrice: true, sellPrice: true,
        },
      },
    },
  })

  return (
    <div className="flex flex-col h-full bg-[#0f0f0f]">
      <div className="px-6 py-4 border-b border-[#2a2a2a]">
        <h1 className="text-lg font-bold text-white">営業管理</h1>
        <p className="text-xs text-[#555] mt-0.5">マッチングベースのパイプライン管理</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <PipelineTable initialData={data as PipelineMatching[]} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript コンパイルエラーがないか確認**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/app/\(main\)/sales/
git commit -m "feat: /sales ページを追加（営業パイプライン管理）"
```

---

## Task 13: サイドバー更新 + 動作確認

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**コンテキスト:** 既存の「営業」セクションに「営業管理」リンクを追加する。

- [ ] **Step 1: Sidebar.tsx を修正**

`navSections` の「営業」セクションを以下に変更:

```typescript
{
  label: '営業',
  links: [
    { href: '/sales',     label: '営業管理',    icon: '💼' },  // 追加
    { href: '/matching',  label: 'マッチング',  icon: '⚡', badge: 5, badgeColor: 'blue' as const },
    { href: '/proposals', label: '提案メール',  icon: '📨' },
    { href: '/progress',  label: '営業進捗',    icon: '📊' },
  ],
},
```

- [ ] **Step 2: 開発サーバーを起動して動作確認**

```bash
npm run dev
```

ブラウザで `http://localhost:3000/sales` を開き、以下を確認:
- サイドバーに「営業管理」が表示される
- KPIバーが正しく表示される
- タブフィルターが動作する
- テーブル行が表示される
- 各モーダルが開閉できる

- [ ] **Step 3: 全テストを実行**

```bash
npm test -- --no-coverage
```

Expected: PASS（新規テスト含む）

- [ ] **Step 4: コミット**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: サイドバーに営業管理メニューを追加"
```

---

## 完了後の確認チェックリスト

- [ ] `/sales` ページが認証なしでアクセスするとログイン画面にリダイレクトされる
- [ ] KPIバーの件数がテーブルのデータと一致している
- [ ] ステージ変更ドロップダウンでモーダルが開き、確認後にテーブルが更新される
- [ ] 詳細モーダルでメモを保存するとテーブルの行にメモが表示される
- [ ] 成約ボタンが REPLIED/INTERVIEWING 以外では非活性になっている
- [ ] 全テストが通っている（`npm test -- --no-coverage`）
