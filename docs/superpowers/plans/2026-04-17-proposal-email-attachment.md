# 提案メール送信時の経歴書添付ロジック 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/api/emails/send` を `proposalId` 受け取りに変更し、経歴書添付情報をログ出力・DB更新を行う。

**Architecture:** `send/route.ts` のみを変更。Proposal→Matching→Talent を DB から取得し、`resumeKey` があればファイルを読んで添付情報を console.log に出力。送信後に Proposal/Matching の status を SENT に更新する。

**Tech Stack:** Next.js App Router, Prisma, Zod, Jest（テストフレームワーク）

---

## 変更ファイル一覧

| 操作 | パス | 内容 |
|------|------|------|
| Modify | `src/app/api/emails/send/route.ts` | proposalId受け取り・DB取得・添付ログ・DB更新に全面改修 |
| Create | `src/app/api/emails/send/__tests__/route.test.ts` | 新規テストファイル |

---

### Task 1: テストファイルを作成して失敗させる

**Files:**
- Create: `src/app/api/emails/send/__tests__/route.test.ts`

- [ ] **Step 1: テストファイルを作成する**

`src/app/api/emails/send/__tests__/route.test.ts` を以下の内容で作成：

```ts
/** @jest-environment node */
import { POST } from '../route'

// --- prisma モック ---
const mockProposalFindUnique = jest.fn()
const mockProposalUpdate = jest.fn()
const mockMatchingUpdate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    proposal: {
      findUnique: (...args: unknown[]) => mockProposalFindUnique(...args),
      update:     (...args: unknown[]) => mockProposalUpdate(...args),
    },
    matching: {
      update: (...args: unknown[]) => mockMatchingUpdate(...args),
    },
  },
}))

// --- auth モック ---
const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

// --- file-storage モック ---
const mockGetUrl = jest.fn()
jest.mock('@/lib/file-storage', () => ({
  getFileStorage: () => ({ getUrl: mockGetUrl }),
}))

// --- fs/promises モック ---
const mockReadFile = jest.fn()
jest.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}))

const adminSession  = { user: { id: 'admin-id',  role: 'ADMIN' } }
const staffSession  = { user: { id: 'staff-id',  role: 'STAFF' } }
const otherSession  = { user: { id: 'other-id',  role: 'STAFF' } }

const baseProposal = {
  id:         'proposal-1',
  matchingId: 'matching-1',
  to:         'client@example.com',
  cc:         null,
  subject:    '【提案】エンジニア紹介',
  bodyText:   '提案本文',
  matching: {
    case:   { assignedUserId: 'staff-id' },
    talent: { resumeKey: null, resumeFilename: null },
  },
}

function makeReq(body: unknown) {
  return new Request('http://localhost/api/emails/send', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockProposalUpdate.mockResolvedValue({})
  mockMatchingUpdate.mockResolvedValue({})
})

// ─────────────────────────────────────────────
describe('POST /api/emails/send', () => {

  it('401: 未認証', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const res = await POST(makeReq({ proposalId: 'claaaaaaaaaaaaaaaaaaaaaaaaa' }))
    expect(res.status).toBe(401)
  })

  it('422: proposalId が不正形式', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    const res = await POST(makeReq({ proposalId: 'not-a-cuid' }))
    expect(res.status).toBe(422)
  })

  it('404: Proposal が存在しない', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockProposalFindUnique.mockResolvedValueOnce(null)
    const res = await POST(makeReq({ proposalId: 'claaaaaaaaaaaaaaaaaaaaaaaaa' }))
    expect(res.status).toBe(404)
  })

  it('403: 他人の Proposal', async () => {
    mockAuth.mockResolvedValueOnce(otherSession)
    mockProposalFindUnique.mockResolvedValueOnce(baseProposal)
    const res = await POST(makeReq({ proposalId: 'claaaaaaaaaaaaaaaaaaaaaaaaa' }))
    expect(res.status).toBe(403)
  })

  it('200: 正常系・経歴書なし', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockProposalFindUnique.mockResolvedValueOnce(baseProposal)
    const res = await POST(makeReq({ proposalId: 'claaaaaaaaaaaaaaaaaaaaaaaaa' }))
    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual({ sent: true })
    expect(mockProposalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) })
    )
    expect(mockMatchingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'SENT' } })
    )
    expect(mockReadFile).not.toHaveBeenCalled()
  })

  it('200: 正常系・経歴書あり', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockProposalFindUnique.mockResolvedValueOnce({
      ...baseProposal,
      matching: {
        ...baseProposal.matching,
        talent: { resumeKey: 'resumes/talent-1-111.pdf', resumeFilename: '田中太郎_経歴書.pdf' },
      },
    })
    mockGetUrl.mockReturnValueOnce('/uploads/resumes/talent-1-111.pdf')
    mockReadFile.mockResolvedValueOnce(Buffer.from('dummy'))
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const res = await POST(makeReq({ proposalId: 'claaaaaaaaaaaaaaaaaaaaaaaaa' }))
    expect(res.status).toBe(200)
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('田中太郎_経歴書.pdf'))
    consoleSpy.mockRestore()
  })

  it('200: 経歴書ファイル読み取り失敗でも送信継続', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockProposalFindUnique.mockResolvedValueOnce({
      ...baseProposal,
      matching: {
        ...baseProposal.matching,
        talent: { resumeKey: 'resumes/missing.pdf', resumeFilename: '経歴書.pdf' },
      },
    })
    mockGetUrl.mockReturnValueOnce('/uploads/resumes/missing.pdf')
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'))
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await POST(makeReq({ proposalId: 'claaaaaaaaaaaaaaaaaaaaaaaaa' }))
    expect(res.status).toBe(200)
    expect(warnSpy).toHaveBeenCalled()
    expect(mockProposalUpdate).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('200: ADMIN は他人の Proposal も送信できる', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockProposalFindUnique.mockResolvedValueOnce(baseProposal)
    const res = await POST(makeReq({ proposalId: 'claaaaaaaaaaaaaaaaaaaaaaaaa' }))
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```bash
npx jest src/app/api/emails/send/__tests__/route.test.ts --no-coverage
```

期待結果: すべてのテストが **FAIL**（`POST` が現在の実装と合わないため）

---

### Task 2: `send/route.ts` を実装する

**Files:**
- Modify: `src/app/api/emails/send/route.ts`

- [ ] **Step 3: `send/route.ts` を以下の内容に全面置き換える**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import * as fs from 'fs/promises'
import { ok, unprocessable, notFound, forbidden, serverError, requireAuth } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { getFileStorage } from '@/lib/file-storage'

const SendEmailSchema = z.object({
  proposalId: z.string().cuid(),
})

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { session, isAdmin } = authResult

  const body = await request.json().catch(() => null)
  const parsed = SendEmailSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.issues)

  const { proposalId } = parsed.data

  try {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        matching: {
          include: {
            case:   { select: { assignedUserId: true } },
            talent: { select: { resumeKey: true, resumeFilename: true } },
          },
        },
      },
    })
    if (!proposal) return notFound()
    if (!isAdmin && proposal.matching.case.assignedUserId !== session.user.id) return forbidden()

    // 経歴書添付（スタブ: ファイルの存在確認とログ出力のみ）
    let attachmentFilename: string | null = null
    const { resumeKey, resumeFilename } = proposal.matching.talent
    if (resumeKey) {
      try {
        const filePath = getFileStorage().getUrl(resumeKey)
        await fs.readFile(filePath)
        attachmentFilename = resumeFilename ?? resumeKey
      } catch {
        console.warn(`[EMAIL SEND] 経歴書ファイルの読み取り失敗: ${resumeKey}`)
      }
    }

    console.log('=== [EMAIL SEND] ===========================')
    console.log(`To:      ${proposal.to}`)
    if (proposal.cc) console.log(`CC:      ${proposal.cc}`)
    console.log(`Subject: ${proposal.subject}`)
    if (attachmentFilename) console.log(`Attachment: ${attachmentFilename}`)
    console.log('--------------------------------------------')
    console.log(proposal.bodyText)
    console.log('============================================')

    await Promise.all([
      prisma.proposal.update({
        where: { id: proposalId },
        data:  { status: 'SENT', sentAt: new Date() },
      }),
      prisma.matching.update({
        where: { id: proposal.matchingId },
        data:  { status: 'SENT' },
      }),
    ])

    return ok({ sent: true })
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 4: テストを実行してすべて PASS を確認する**

```bash
npx jest src/app/api/emails/send/__tests__/route.test.ts --no-coverage
```

期待結果: **7 tests passed**

- [ ] **Step 5: 全テストがリグレッションしていないことを確認する**

```bash
npx jest --no-coverage
```

期待結果: すべての既存テストが **PASS**

- [ ] **Step 6: コミットする**

```bash
git add src/app/api/emails/send/route.ts src/app/api/emails/send/__tests__/route.test.ts
git commit -m "feat: 提案メール送信APIをproposalId受け取りに変更し経歴書添付ロジックを追加"
```
