# プロパ人材管理機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 自社プロパ社員の人材情報をVatchで管理し、案件マッチング対象とするとともに、プロパ本人がログインして案件閲覧・お気に入り保存できるポータルを提供する。

**Architecture:** 既存の`Talent`モデルに`talentType`（PROPER/EXTERNAL）・`office`（TOKYO/NAGOYA）・`userId`フィールドを追加し、`Role`に`PROPER`を追加。プロパユーザーはbcryptjsでパスワード認証し、ミドルウェアが`/portal`へ誘導する。管理者は`/proper`画面でWord経歴書をアップロードするとClaudeが情報を抽出し、確認フォームを経てTalent+Userを作成する。

**Tech Stack:** Next.js 16 App Router, Prisma 7, PostgreSQL, next-auth v5 (Credentials+JWT), bcryptjs, mammoth（Wordテキスト抽出）, @anthropic-ai/sdk（経歴書構造化）, Tailwind CSS, Jest

---

## File Structure

**Modify:**
- `prisma/schema.prisma` — talentType/office/userId/password フィールド追加、Favorite モデル追加
- `src/lib/auth.ts` — bcryptjs パスワード検証
- `src/auth.config.ts` — PROPER ロールのルーティング + sign-in page を /login に変更
- `src/lib/api.ts` — requireStaff / requireProper 追加
- `src/app/api/talents/route.ts` — EXTERNAL のみフィルター追加
- `src/components/layout/Sidebar.tsx` — プロパ管理リンク追加

**Create:**
- `src/lib/schemas/proper.ts`
- `src/lib/resume-extractor.ts`
- `src/app/api/proper/route.ts` + `__tests__/route.test.ts`
- `src/app/api/proper/[id]/route.ts` + `__tests__/route.test.ts`
- `src/app/api/proper/[id]/reset-password/route.ts`
- `src/app/api/proper/extract/route.ts` + `__tests__/route.test.ts`
- `src/app/api/portal/cases/route.ts` + `__tests__/route.test.ts`
- `src/app/api/favorites/route.ts` + `[caseId]/route.ts` + `__tests__/route.test.ts`
- `src/app/(main)/proper/page.tsx`
- `src/app/(main)/proper/new/page.tsx`
- `src/app/(main)/proper/[id]/page.tsx`
- `src/app/(portal)/layout.tsx`
- `src/app/(portal)/portal/page.tsx`
- `src/app/(portal)/portal/favorites/page.tsx`

---

## Task 1: Prisma スキーマ更新とマイグレーション

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: スキーマを更新する**

`prisma/schema.prisma` の該当箇所を以下の通り変更する。

`Role` enum を更新:
```prisma
enum Role {
  ADMIN
  STAFF
  PROPER
}
```

`User` モデルに追加（既存フィールドの後ろに追加）:
```prisma
model User {
  // ...既存フィールド（id, name, email, emailVerified, image, role, createdAt, updatedAt）...
  password     String?
  accounts     Account[]
  sessions     Session[]
  cases        Case[]
  talents      Talent[]
  contracts    Contract[]
  activities   ActivityLog[]
  properTalent Talent?    @relation("ProperUser")
  favorites    Favorite[]
}
```

`Talent` モデルに追加（既存フィールドの後ろ、リレーションの前に追加）:
```prisma
model Talent {
  // ...既存フィールド（id〜resumeFilename）...
  talentType  TalentType  @default(EXTERNAL)
  office      Office?
  userId      String?     @unique

  assignedUser User        @relation(fields: [assignedUserId], references: [id])
  sourceEmail  Email?      @relation("EmailToTalent", fields: [sourceEmailId], references: [id])
  properUser   User?       @relation("ProperUser", fields: [userId], references: [id])
  matchings    Matching[]
  contracts    Contract[]
  activities   ActivityLog[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
}
```

新規 enum を追加（既存 enum の後ろ）:
```prisma
enum TalentType {
  PROPER
  EXTERNAL
}

enum Office {
  TOKYO
  NAGOYA
}
```

`Case` モデルに `favorites Favorite[]` を追加（既存リレーションの後ろ）。

`Favorite` モデルを新規追加（schema.prisma の末尾）:
```prisma
model Favorite {
  id        String   @id @default(cuid())
  userId    String
  caseId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  case      Case     @relation(fields: [caseId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([userId, caseId])
}
```

- [ ] **Step 2: マイグレーションを実行する**

```bash
npx prisma migrate dev --name proper-talent-management
```

Expected: マイグレーションファイルが生成され、DBに反映される。

- [ ] **Step 3: クライアントを再生成する**

```bash
npx prisma generate
```

- [ ] **Step 4: コミット**

```bash
git add prisma/
git commit -m "feat: プロパ人材管理のDBスキーマを追加（TalentType/Office/Favorite）"
```

---

## Task 2: パッケージインストール + 認証強化

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/auth.config.ts`

- [ ] **Step 1: パッケージをインストールする**

```bash
npm install mammoth bcryptjs
npm install --save-dev @types/bcryptjs
```

- [ ] **Step 2: auth.ts にパスワード検証を追加する**

`src/lib/auth.ts` を以下に更新:
```ts
// src/lib/auth.ts
import NextAuth from 'next-auth';
import type { Role } from '@prisma/client';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { authConfig } from '@/auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (typeof credentials?.email !== 'string' || typeof credentials?.password !== 'string') {
          return null;
        }
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user) return null;

        if (user.password) {
          const isValid = await bcrypt.compare(credentials.password, user.password);
          if (!isValid) return null;
        }
        return user;
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.role) session.user.role = token.role as Role;
      return session;
    },
  },
});
```

- [ ] **Step 3: auth.config.ts を更新してPROPERルーティングを追加する**

`src/auth.config.ts` を以下に更新:
```ts
// src/auth.config.ts
import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl
      if (!auth?.user) return false

      const role = (auth.user as { role?: string }).role

      if (role === 'PROPER' && !pathname.startsWith('/portal')) {
        return Response.redirect(new URL('/portal', request.url))
      }

      if (role !== 'PROPER' && pathname.startsWith('/portal')) {
        return Response.redirect(new URL('/dashboard', request.url))
      }

      return true
    },
  },
  providers: [],
} satisfies NextAuthConfig
```

- [ ] **Step 4: middleware.ts の matcher に login を追加確認**

`src/middleware.ts` の matcher を確認。既に `login` が除外されていることを確認する（`login|auto-login` が含まれていればOK）:
```ts
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login|auto-login|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.ico|.*\\.webp).*)'],
}
```

- [ ] **Step 5: コミット**

```bash
git add src/lib/auth.ts src/auth.config.ts src/middleware.ts package.json package-lock.json
git commit -m "feat: bcryptjsパスワード認証とPROPERロールのミドルウェアルーティングを追加"
```

---

## Task 3: API ヘルパー + Zodスキーマ

**Files:**
- Modify: `src/lib/api.ts`
- Create: `src/lib/schemas/proper.ts`

- [ ] **Step 1: requireStaff と requireProper を api.ts に追加する**

`src/lib/api.ts` の末尾に以下を追加:
```ts
export async function requireStaff(): Promise<{ session: Session; isAdmin: boolean } | NextResponse> {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result
  if (result.session.user.role === 'PROPER') return forbidden()
  return result
}

export async function requireProper(): Promise<{ session: Session } | NextResponse> {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result
  if (result.session.user.role !== 'PROPER') return forbidden()
  return { session: result.session }
}
```

- [ ] **Step 2: proper.ts スキーマを作成する**

`src/lib/schemas/proper.ts`:
```ts
import { z } from 'zod'

export const CreateProperSchema = z.object({
  name:         z.string().min(1),
  email:        z.string().email(),
  skills:       z.array(z.string()).min(1),
  experience:   z.number().int().min(0),
  desiredRate:  z.number().int().min(0),
  location:     z.string().min(1),
  workStyle:    z.enum(['REMOTE', 'ONSITE', 'HYBRID']),
  office:       z.enum(['TOKYO', 'NAGOYA']),
  availableFrom: z.coerce.date().optional(),
})

export const UpdateProperSchema = z.object({
  name:         z.string().min(1).optional(),
  skills:       z.array(z.string()).min(1).optional(),
  experience:   z.number().int().min(0).optional(),
  desiredRate:  z.number().int().min(0).optional(),
  location:     z.string().min(1).optional(),
  workStyle:    z.enum(['REMOTE', 'ONSITE', 'HYBRID']).optional(),
  office:       z.enum(['TOKYO', 'NAGOYA']).optional(),
  status:       z.enum(['AVAILABLE','ACTIVE','NEGOTIATING','ENDING_SOON','INACTIVE']).optional(),
  availableFrom: z.coerce.date().optional(),
})

export const ProperQuerySchema = z.object({
  office: z.enum(['TOKYO', 'NAGOYA']).optional(),
  status: z.enum(['AVAILABLE','ACTIVE','NEGOTIATING','ENDING_SOON','INACTIVE']).optional(),
  page:   z.coerce.number().min(1).default(1),
  limit:  z.coerce.number().min(1).max(500).default(100),
})
```

- [ ] **Step 3: コミット**

```bash
git add src/lib/api.ts src/lib/schemas/proper.ts
git commit -m "feat: requireStaff/requireProperヘルパーとProperスキーマを追加"
```

---

## Task 4: 経歴書 AI 抽出ライブラリ

**Files:**
- Create: `src/lib/resume-extractor.ts`

- [ ] **Step 1: resume-extractor.ts を作成する**

`src/lib/resume-extractor.ts`:
```ts
import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

const EXTRACT_TOOL: Anthropic.Tool = {
  name: 'extract_talent_info',
  description: '経歴書テキストからSES人材情報を抽出する',
  input_schema: {
    type: 'object' as const,
    properties: {
      name:        { type: 'string',  description: '氏名（フルネーム）' },
      skills:      { type: 'array',   items: { type: 'string' }, description: '技術スキル・言語・フレームワーク一覧（空の場合は[]）' },
      experience:  { type: 'integer', description: 'IT経験年数（不明な場合は0）' },
      desiredRate: { type: 'integer', description: '希望単価（万円）。記載がなければ0' },
      location:    { type: 'string',  description: '居住地または最寄り地域。不明な場合は空文字' },
      workStyle:   { type: 'string',  enum: ['REMOTE', 'ONSITE', 'HYBRID'], description: '希望勤務形式。不明な場合はHYBRID' },
      email:       { type: 'string',  description: 'メールアドレス。見つからない場合は空文字' },
    },
    required: ['name', 'skills', 'experience', 'desiredRate', 'location', 'workStyle', 'email'],
  },
}

export type ExtractedTalent = {
  name: string
  skills: string[]
  experience: number
  desiredRate: number
  location: string
  workStyle: 'REMOTE' | 'ONSITE' | 'HYBRID'
  email: string
}

export async function extractTalentInfo(resumeText: string): Promise<ExtractedTalent> {
  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'extract_talent_info' },
    messages: [
      {
        role: 'user',
        content: `以下の経歴書テキストからSES人材情報を抽出してください。\n\n${resumeText.slice(0, 8000)}`,
      },
    ],
  })

  const toolUse = response.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === 'tool_use'
  )
  if (!toolUse) throw new Error('AI extraction failed: no tool_use block')
  return toolUse.input as ExtractedTalent
}
```

- [ ] **Step 2: コミット**

```bash
git add src/lib/resume-extractor.ts
git commit -m "feat: 経歴書AIテキスト抽出ライブラリを追加"
```

---

## Task 5: プロパ管理 API

**Files:**
- Create: `src/app/api/proper/route.ts`
- Create: `src/app/api/proper/__tests__/route.test.ts`
- Create: `src/app/api/proper/[id]/route.ts`
- Create: `src/app/api/proper/[id]/__tests__/route.test.ts`
- Create: `src/app/api/proper/[id]/reset-password/route.ts`
- Create: `src/app/api/proper/extract/route.ts`
- Create: `src/app/api/proper/extract/__tests__/route.test.ts`

- [ ] **Step 1: テストファイルを作成する**

`src/app/api/proper/__tests__/route.test.ts`:
```ts
/** @jest-environment node */
import { GET, POST } from '../route'

const mockFindMany = jest.fn()
const mockCount    = jest.fn()
const mockFindUnique = jest.fn()
const mockUserCreate   = jest.fn()
const mockTalentCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    talent: { findMany: (...a: unknown[]) => mockFindMany(...a), count: (...a: unknown[]) => mockCount(...a), create: (...a: unknown[]) => mockTalentCreate(...a) },
    user:   { findUnique: (...a: unknown[]) => mockFindUnique(...a), create: (...a: unknown[]) => mockUserCreate(...a) },
  },
}))

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
const mockAuth = auth as jest.Mock

beforeEach(() => jest.clearAllMocks())

describe('GET /api/proper', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/proper'))).status).toBe(401)
  })

  it('returns 403 for PROPER role', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'u1', role: 'PROPER' } })
    expect((await GET(new Request('http://localhost/api/proper'))).status).toBe(403)
  })

  it('filters by talentType PROPER and optional office', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'admin', role: 'ADMIN' } })
    mockFindMany.mockResolvedValueOnce([{ id: 't1', talentType: 'PROPER', office: 'TOKYO' }])
    mockCount.mockResolvedValueOnce(1)
    const res = await GET(new Request('http://localhost/api/proper?office=TOKYO'))
    expect(res.status).toBe(200)
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ talentType: 'PROPER', office: 'TOKYO' }) })
    )
  })
})

describe('POST /api/proper', () => {
  const validBody = {
    name: '山田花子', email: 'hanako@example.com', skills: ['Java'],
    experience: 5, desiredRate: 60, location: '東京', workStyle: 'HYBRID', office: 'TOKYO',
  }

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await POST(new Request('http://localhost/api/proper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validBody) }))).status).toBe(401)
  })

  it('returns 422 on invalid body', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'admin', role: 'ADMIN' } })
    expect((await POST(new Request('http://localhost/api/proper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '' }) }))).status).toBe(422)
  })

  it('returns 409 when email already exists', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'admin', role: 'ADMIN' } })
    mockFindUnique.mockResolvedValueOnce({ id: 'existing' })
    const res = await POST(new Request('http://localhost/api/proper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validBody) }))
    expect(res.status).toBe(409)
  })

  it('creates user and talent, returns tempPassword', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'admin', role: 'ADMIN' } })
    mockFindUnique.mockResolvedValueOnce(null)
    mockUserCreate.mockResolvedValueOnce({ id: 'u2', email: 'hanako@example.com', role: 'PROPER' })
    mockTalentCreate.mockResolvedValueOnce({ id: 't1', name: '山田花子', talentType: 'PROPER' })
    const res = await POST(new Request('http://localhost/api/proper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validBody) }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.tempPassword).toBeDefined()
    expect(typeof body.data.tempPassword).toBe('string')
    expect(body.data.tempPassword.length).toBeGreaterThanOrEqual(8)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest src/app/api/proper/__tests__/route.test.ts --no-coverage
```

Expected: FAIL (route.ts が存在しない)

- [ ] **Step 3: /api/proper/route.ts を作成する**

`src/app/api/proper/route.ts`:
```ts
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { ok, created, forbidden, unprocessable, serverError, requireStaff } from '@/lib/api'
import { CreateProperSchema, ProperQuerySchema } from '@/lib/schemas/proper'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function GET(request: Request): Promise<NextResponse> {
  const authResult = await requireStaff()
  if (authResult instanceof NextResponse) return authResult

  const { searchParams } = new URL(request.url)
  const query = ProperQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!query.success) return unprocessable(query.error.issues)

  const { office, status, page, limit } = query.data
  const where = {
    talentType: 'PROPER' as const,
    ...(office ? { office } : {}),
    ...(status ? { status } : {}),
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
  const authResult = await requireStaff()
  if (authResult instanceof NextResponse) return authResult
  const { session } = authResult

  const body = await request.json().catch(() => ({}))
  const parsed = CreateProperSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.issues)

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    return NextResponse.json(
      { success: false, error: { code: 'CONFLICT', message: 'このメールアドレスは既に登録されています' } },
      { status: 409 }
    )
  }

  const tempPassword = generateTempPassword()
  const hashedPassword = await bcrypt.hash(tempPassword, 10)

  try {
    const user = await prisma.user.create({
      data: { name: parsed.data.name, email: parsed.data.email, role: 'PROPER', password: hashedPassword },
    })
    const talent = await prisma.talent.create({
      data: {
        name:           parsed.data.name,
        skills:         parsed.data.skills,
        experience:     parsed.data.experience,
        desiredRate:    parsed.data.desiredRate,
        location:       parsed.data.location,
        workStyle:      parsed.data.workStyle,
        talentType:     'PROPER',
        office:         parsed.data.office,
        userId:         user.id,
        assignedUserId: session.user.id,
        ...(parsed.data.availableFrom ? { availableFrom: parsed.data.availableFrom } : {}),
      },
    })
    return created({ talent, user: { id: user.id, email: user.email, name: user.name }, tempPassword })
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest src/app/api/proper/__tests__/route.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: /api/proper/[id]/route.ts のテストを作成する**

`src/app/api/proper/[id]/__tests__/route.test.ts`:
```ts
/** @jest-environment node */
import { GET, PATCH } from '../route'

const mockFindUnique = jest.fn()
const mockUpdate     = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: { talent: { findUnique: (...a: unknown[]) => mockFindUnique(...a), update: (...a: unknown[]) => mockUpdate(...a) } },
}))

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
const mockAuth = auth as jest.Mock

const adminSession = { user: { id: 'admin', role: 'ADMIN' } }
beforeEach(() => jest.clearAllMocks())

describe('GET /api/proper/[id]', () => {
  it('returns 404 when talent not found', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost/api/proper/t1'), { params: Promise.resolve({ id: 't1' }) })
    expect(res.status).toBe(404)
  })

  it('returns talent data', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 't1', talentType: 'PROPER', name: 'A', properUser: { email: 'a@a.com' } })
    const res = await GET(new Request('http://localhost/api/proper/t1'), { params: Promise.resolve({ id: 't1' }) })
    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/proper/[id]', () => {
  it('updates talent and returns updated record', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockUpdate.mockResolvedValueOnce({ id: 't1', name: '山田花子更新', talentType: 'PROPER' })
    const res = await PATCH(
      new Request('http://localhost/api/proper/t1', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '山田花子更新' }) }),
      { params: Promise.resolve({ id: 't1' }) }
    )
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 6: テストが失敗することを確認する**

```bash
npx jest src/app/api/proper/__tests__/ --no-coverage
```

Expected: [id] tests FAIL

- [ ] **Step 7: /api/proper/[id]/route.ts を作成する**

`src/app/api/proper/[id]/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, notFound, unprocessable, serverError, requireStaff } from '@/lib/api'
import { UpdateProperSchema } from '@/lib/schemas/proper'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authResult = await requireStaff()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params
  try {
    const talent = await prisma.talent.findUnique({
      where: { id, talentType: 'PROPER' },
      include: { properUser: { select: { id: true, email: true, name: true } } },
    })
    if (!talent) return notFound()
    return ok(talent)
  } catch {
    return serverError()
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authResult = await requireStaff()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = UpdateProperSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.issues)

  try {
    const talent = await prisma.talent.update({
      where: { id, talentType: 'PROPER' },
      data: parsed.data,
    })
    return ok(talent)
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 8: /api/proper/[id]/reset-password/route.ts を作成する**

`src/app/api/proper/[id]/reset-password/route.ts`:
```ts
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { ok, notFound, serverError, requireStaff } from '@/lib/api'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authResult = await requireStaff()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params
  try {
    const talent = await prisma.talent.findUnique({
      where: { id, talentType: 'PROPER' },
      select: { userId: true },
    })
    if (!talent?.userId) return notFound()

    const tempPassword = generateTempPassword()
    await prisma.user.update({
      where: { id: talent.userId },
      data: { password: await bcrypt.hash(tempPassword, 10) },
    })
    return ok({ tempPassword })
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 9: /api/proper/extract/route.ts のテストを作成する**

`src/app/api/proper/extract/__tests__/route.test.ts`:
```ts
/** @jest-environment node */
import { POST } from '../route'

const mockExtract = jest.fn()
jest.mock('@/lib/resume-extractor', () => ({ extractTalentInfo: (...a: unknown[]) => mockExtract(...a) }))
jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
const mockAuth = auth as jest.Mock
beforeEach(() => jest.clearAllMocks())

describe('POST /api/proper/extract', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const formData = new FormData()
    formData.append('file', new Blob(['dummy'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'test.docx')
    const req = new Request('http://localhost/api/proper/extract', { method: 'POST', body: formData })
    expect((await POST(req)).status).toBe(401)
  })

  it('returns 422 when no file provided', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'admin', role: 'ADMIN' } })
    const formData = new FormData()
    const req = new Request('http://localhost/api/proper/extract', { method: 'POST', body: formData })
    expect((await POST(req)).status).toBe(422)
  })

  it('returns extracted talent info on success', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'admin', role: 'ADMIN' } })
    mockExtract.mockResolvedValueOnce({
      name: '山田花子', skills: ['Java', 'Spring'], experience: 5,
      desiredRate: 60, location: '東京', workStyle: 'HYBRID', email: 'hanako@example.com',
    })
    const formData = new FormData()
    formData.append('file', new Blob(['dummy docx content'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'test.docx')
    const req = new Request('http://localhost/api/proper/extract', { method: 'POST', body: formData })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name).toBe('山田花子')
    expect(body.data.skills).toContain('Java')
  })
})
```

- [ ] **Step 10: /api/proper/extract/route.ts を作成する**

`src/app/api/proper/extract/route.ts`:
```ts
import { NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { ok, unprocessable, serverError, requireStaff } from '@/lib/api'
import { extractTalentInfo } from '@/lib/resume-extractor'

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireStaff()
  if (authResult instanceof NextResponse) return authResult

  const formData = await request.formData().catch(() => null)
  if (!formData) return unprocessable([{ path: ['body'], message: 'multipart/form-data が必要です' }])

  const file = formData.get('file') as File | null
  if (!file) return unprocessable([{ path: ['file'], message: 'ファイルが必要です' }])

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const { value: text } = await mammoth.extractRawText({ buffer })
    if (!text.trim()) return unprocessable([{ path: ['file'], message: 'ファイルからテキストを抽出できませんでした' }])

    const extracted = await extractTalentInfo(text)
    return ok(extracted)
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 11: 全テストを実行して確認する**

```bash
npx jest src/app/api/proper/ --no-coverage
```

Expected: PASS (全テスト)

- [ ] **Step 12: コミット**

```bash
git add src/app/api/proper/
git commit -m "feat: プロパ管理API（一覧/作成/詳細/更新/パスワードリセット/経歴書抽出）を追加"
```

---

## Task 6: タレント API EXTERNAL フィルター + ポータル・お気に入り API

**Files:**
- Modify: `src/app/api/talents/route.ts`
- Create: `src/app/api/portal/cases/route.ts` + `__tests__/route.test.ts`
- Create: `src/app/api/favorites/route.ts` + `[caseId]/route.ts` + `__tests__/route.test.ts`

- [ ] **Step 1: talents/route.ts に EXTERNAL フィルターを追加する**

`src/app/api/talents/route.ts` の `where` オブジェクトに `talentType: 'EXTERNAL' as const` を追加:
```ts
const where = {
  talentType: 'EXTERNAL' as const,
  ...(isAdmin ? {} : { assignedUserId: session.user.id }),
  ...(status ? { status } : {}),
  ...(workStyle ? { workStyle } : {}),
  ...(skillsArr ? { skills: { hasEvery: skillsArr } } : {}),
}
```

- [ ] **Step 2: ポータル案件 API のテストを作成する**

`src/app/api/portal/cases/__tests__/route.test.ts`:
```ts
/** @jest-environment node */
import { GET } from '../route'

const mockFindFirst = jest.fn()
const mockFindMany  = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    talent:   { findFirst: (...a: unknown[]) => mockFindFirst(...a) },
    matching: { findMany:  (...a: unknown[]) => mockFindMany(...a)  },
    favorite: { findMany:  (...a: unknown[]) => mockFindMany(...a)  },
  },
}))

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
const mockAuth = auth as jest.Mock
beforeEach(() => jest.clearAllMocks())

describe('GET /api/portal/cases', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/portal/cases'))).status).toBe(401)
  })

  it('returns 403 for non-PROPER users', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'u1', role: 'ADMIN' } })
    expect((await GET(new Request('http://localhost/api/portal/cases'))).status).toBe(403)
  })

  it('returns 404 when PROPER talent not found', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'u1', role: 'PROPER' } })
    mockFindFirst.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/portal/cases'))).status).toBe(404)
  })

  it('returns matching cases with isFavorited flag', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'u1', role: 'PROPER' } })
    mockFindFirst.mockResolvedValueOnce({ id: 't1', userId: 'u1' })
    mockFindMany
      .mockResolvedValueOnce([{ id: 'm1', score: 85, caseId: 'c1', case: { id: 'c1', title: 'React案件' } }])
      .mockResolvedValueOnce([{ caseId: 'c1' }])
    const res = await GET(new Request('http://localhost/api/portal/cases'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data[0].isFavorited).toBe(true)
  })
})
```

- [ ] **Step 3: portal/cases/route.ts を作成する**

`src/app/api/portal/cases/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, notFound, serverError, requireProper } from '@/lib/api'

export async function GET(_request: Request): Promise<NextResponse> {
  const authResult = await requireProper()
  if (authResult instanceof NextResponse) return authResult
  const { session } = authResult

  try {
    const talent = await prisma.talent.findFirst({
      where: { userId: session.user.id, talentType: 'PROPER' },
    })
    if (!talent) return notFound()

    const [matchings, favorites] = await Promise.all([
      prisma.matching.findMany({
        where: { talentId: talent.id, status: { not: 'REJECTED' } },
        include: { case: true },
        orderBy: { score: 'desc' },
      }),
      prisma.favorite.findMany({
        where: { userId: session.user.id },
        select: { caseId: true },
      }),
    ])

    const favCaseIds = new Set(favorites.map((f) => f.caseId))
    const data = matchings.map((m) => ({ ...m, isFavorited: favCaseIds.has(m.caseId) }))
    return ok(data)
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 4: お気に入り API のテストを作成する**

`src/app/api/favorites/__tests__/route.test.ts`:
```ts
/** @jest-environment node */
import { POST } from '../route'
import { DELETE } from '../[caseId]/route'

const mockCreate     = jest.fn()
const mockDeleteMany = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: { favorite: { create: (...a: unknown[]) => mockCreate(...a), deleteMany: (...a: unknown[]) => mockDeleteMany(...a) } },
}))

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
const mockAuth = auth as jest.Mock
const properSession = { user: { id: 'u1', role: 'PROPER' } }
beforeEach(() => jest.clearAllMocks())

describe('POST /api/favorites', () => {
  it('returns 403 for non-PROPER user', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'u1', role: 'ADMIN' } })
    expect((await POST(new Request('http://localhost/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: 'clxxxxxx' }) }))).status).toBe(403)
  })

  it('creates favorite', async () => {
    mockAuth.mockResolvedValueOnce(properSession)
    mockCreate.mockResolvedValueOnce({ id: 'f1', userId: 'u1', caseId: 'clxxxxxx' })
    const res = await POST(new Request('http://localhost/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: 'clxxxxxx0000000000000000000' }) }))
    expect(res.status).toBe(201)
  })
})

describe('DELETE /api/favorites/[caseId]', () => {
  it('deletes favorite', async () => {
    mockAuth.mockResolvedValueOnce(properSession)
    mockDeleteMany.mockResolvedValueOnce({ count: 1 })
    const res = await DELETE(new Request('http://localhost/api/favorites/c1'), { params: Promise.resolve({ caseId: 'c1' }) })
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 5: favorites API を作成する**

`src/app/api/favorites/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, created, unprocessable, serverError, requireProper } from '@/lib/api'

export async function GET(_request: Request): Promise<NextResponse> {
  const authResult = await requireProper()
  if (authResult instanceof NextResponse) return authResult
  const { session } = authResult

  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: session.user.id },
      include: { case: true },
      orderBy: { createdAt: 'desc' },
    })
    return ok(favorites)
  } catch {
    return serverError()
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireProper()
  if (authResult instanceof NextResponse) return authResult
  const { session } = authResult

  const body = await request.json().catch(() => ({}))
  const parsed = z.object({ caseId: z.string().cuid() }).safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.issues)

  try {
    const record = await prisma.favorite.create({
      data: { userId: session.user.id, caseId: parsed.data.caseId },
    })
    return created(record)
  } catch {
    return serverError()
  }
}
```

`src/app/api/favorites/[caseId]/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, serverError, requireProper } from '@/lib/api'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> }
): Promise<NextResponse> {
  const authResult = await requireProper()
  if (authResult instanceof NextResponse) return authResult
  const { session } = authResult

  const { caseId } = await params
  try {
    await prisma.favorite.deleteMany({ where: { userId: session.user.id, caseId } })
    return ok({ deleted: true })
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 6: テストを実行して確認する**

```bash
npx jest src/app/api/portal/ src/app/api/favorites/ --no-coverage
```

Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/app/api/talents/route.ts src/app/api/portal/ src/app/api/favorites/
git commit -m "feat: ポータル案件API・お気に入りAPI・タレントEXTERNALフィルターを追加"
```

---

## Task 7: サイドバー更新

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: navSections にプロパ管理を追加する**

`src/components/layout/Sidebar.tsx` の `navSections` の `'メイン'` セクションに追加:
```ts
const navSections = [
  {
    label: 'メイン',
    links: [
      { href: '/dashboard', label: 'ダッシュボード', icon: '▪' },
      { href: '/emails',    label: 'メール取込',     icon: '✉',  badge: 8,  badgeColor: 'amber' as const },
      { href: '/cases',     label: '案件管理',        icon: '📋' },
      { href: '/talents',   label: '人材管理',        icon: '👤' },
      { href: '/proper',    label: 'プロパ管理',      icon: '🏢' },
    ],
  },
  // ...残りのセクションはそのまま
```

- [ ] **Step 2: コミット**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: サイドバーにプロパ管理リンクを追加"
```

---

## Task 8: プロパ一覧画面

**Files:**
- Create: `src/app/(main)/proper/page.tsx`

- [ ] **Step 1: プロパ一覧ページを作成する**

`src/app/(main)/proper/page.tsx`:
```tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'

type TalentStatus = 'AVAILABLE' | 'ACTIVE' | 'NEGOTIATING' | 'ENDING_SOON' | 'INACTIVE'
type Office = 'TOKYO' | 'NAGOYA'

type ProperItem = {
  id: string
  name: string
  skills: string[]
  experience: number
  desiredRate: number
  location: string
  office: Office
  status: TalentStatus
  createdAt: string
}

const STATUS_CONFIG: Record<TalentStatus, { label: string; color: string; bg: string }> = {
  AVAILABLE:   { label: '空き',     color: 'text-[#4ade80]', bg: 'bg-[#4ade80]/10' },
  ACTIVE:      { label: '稼働中',   color: 'text-[#38bdf8]', bg: 'bg-[#38bdf8]/10' },
  NEGOTIATING: { label: '交渉中',   color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
  ENDING_SOON: { label: '終了間近', color: 'text-[#f87171]', bg: 'bg-[#f87171]/10' },
  INACTIVE:    { label: '非活動',   color: 'text-[#64748b]', bg: 'bg-[#64748b]/10' },
}

export default function ProperPage() {
  const router = useRouter()
  const [items, setItems] = useState<ProperItem[]>([])
  const [loading, setLoading] = useState(true)
  const [officeTab, setOfficeTab] = useState<Office | 'all'>('all')

  useEffect(() => {
    const url = officeTab === 'all' ? '/api/proper?limit=200' : `/api/proper?limit=200&office=${officeTab}`
    fetch(url)
      .then((r) => r.json())
      .then((j) => { if (j.success) setItems(j.data) })
      .finally(() => setLoading(false))
  }, [officeTab])

  const tokyoCount  = useMemo(() => items.filter((i) => i.office === 'TOKYO').length, [items])
  const nagoyaCount = useMemo(() => items.filter((i) => i.office === 'NAGOYA').length, [items])

  return (
    <div className="flex flex-col h-full bg-vatch-bg">
      <Topbar title="プロパ管理" />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">

          {/* サマリーカード */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: '全員', count: items.length, color: 'text-[#38bdf8]' },
              { label: '東京', count: tokyoCount,  color: 'text-[#4ade80]' },
              { label: '名古屋', count: nagoyaCount, color: 'text-[#f59e0b]' },
            ].map(({ label, count, color }) => (
              <div key={label} className="bg-vatch-surface border border-vatch-border rounded-lg p-4">
                <div className={`text-xs font-medium mb-2 ${color}`}>{label}</div>
                <div className="text-2xl font-bold text-white">{count}</div>
                <div className="text-xs text-vatch-muted mt-1">名</div>
              </div>
            ))}
          </div>

          {/* タブ + 登録ボタン */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1 bg-vatch-surface border border-vatch-border rounded-lg p-1">
              {(['all', 'TOKYO', 'NAGOYA'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setLoading(true); setOfficeTab(tab) }}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    officeTab === tab
                      ? 'bg-[#0c2d5a] text-[#38bdf8]'
                      : 'text-vatch-muted hover:text-white'
                  }`}
                >
                  {tab === 'all' ? '全員' : tab === 'TOKYO' ? '東京' : '名古屋'}
                </button>
              ))}
            </div>
            <button
              onClick={() => router.push('/proper/new')}
              className="px-4 py-2 bg-[#38bdf8] text-black text-xs font-bold rounded-lg hover:bg-[#38bdf8]/90 transition-colors"
            >
              ＋ プロパを登録
            </button>
          </div>

          {/* テーブル */}
          <div className="bg-vatch-surface border border-vatch-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-vatch-border text-vatch-muted text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">氏名 / 拠点</th>
                    <th className="text-left px-4 py-3 font-medium">スキル</th>
                    <th className="text-right px-4 py-3 font-medium">経験年数</th>
                    <th className="text-right px-4 py-3 font-medium">希望単価</th>
                    <th className="text-left px-4 py-3 font-medium">ステータス</th>
                    <th className="text-center px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="text-center py-12 text-vatch-muted">読み込み中...</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-vatch-muted">登録されたプロパがありません</td></tr>
                  ) : items.map((item, idx) => {
                    const sc = STATUS_CONFIG[item.status]
                    return (
                      <tr key={item.id} className={`border-b border-vatch-border/50 hover:bg-white/[0.02] transition-colors ${idx === items.length - 1 ? 'border-b-0' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{item.name}</div>
                          <div className="text-xs text-vatch-muted mt-0.5">
                            {item.office === 'TOKYO' ? '東京' : '名古屋'} · {item.location}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {item.skills.slice(0, 3).map((s) => (
                              <span key={s} className="px-1.5 py-0.5 bg-vatch-border/50 text-vatch-muted rounded text-xs">{s}</span>
                            ))}
                            {item.skills.length > 3 && <span className="px-1.5 py-0.5 bg-vatch-border/50 text-vatch-muted rounded text-xs">+{item.skills.length - 3}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right"><span className="text-white font-semibold">{item.experience}</span><span className="text-vatch-muted text-xs ml-1">年</span></td>
                        <td className="px-4 py-3 text-right whitespace-nowrap"><span className="text-white font-semibold">{item.desiredRate}</span><span className="text-vatch-muted text-xs ml-1">万円</span></td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sc.color} ${sc.bg}`}>{sc.label}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => router.push(`/proper/${item.id}`)} className="px-3 py-1 text-xs border border-vatch-border rounded hover:border-[#38bdf8] hover:text-[#38bdf8] text-vatch-muted transition-colors">
                            詳細
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add src/app/(main)/proper/page.tsx
git commit -m "feat: プロパ一覧画面を追加（東京/名古屋タブ切り替え）"
```

---

## Task 9: プロパ登録画面

**Files:**
- Create: `src/app/(main)/proper/new/page.tsx`

- [ ] **Step 1: プロパ登録ページを作成する**

`src/app/(main)/proper/new/page.tsx`:
```tsx
'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'

type Office = 'TOKYO' | 'NAGOYA'
type WorkStyle = 'REMOTE' | 'ONSITE' | 'HYBRID'

type ExtractedForm = {
  name: string
  email: string
  skills: string
  experience: number
  desiredRate: number
  location: string
  workStyle: WorkStyle
  office: Office
}

const WORK_STYLE_LABELS: Record<WorkStyle, string> = { REMOTE: 'リモート', ONSITE: '常駐', HYBRID: 'ハイブリッド' }

export default function ProperNewPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [office, setOffice] = useState<Office>('TOKYO')
  const [step, setStep] = useState<'upload' | 'confirm' | 'done'>('upload')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [form, setForm] = useState<ExtractedForm>({ name: '', email: '', skills: '', experience: 0, desiredRate: 0, location: '', workStyle: 'HYBRID', office: 'TOKYO' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<{ email: string; tempPassword: string } | null>(null)

  async function handleExtract() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setExtracting(true)
    setExtractError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/proper/extract', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? '抽出に失敗しました')
      const d = json.data
      setForm({
        name:       d.name ?? '',
        email:      d.email ?? '',
        skills:     (d.skills ?? []).join(', '),
        experience: d.experience ?? 0,
        desiredRate: d.desiredRate ?? 0,
        location:   d.location ?? '',
        workStyle:  d.workStyle ?? 'HYBRID',
        office,
      })
      setStep('confirm')
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : '抽出に失敗しました')
    } finally {
      setExtracting(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/proper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        form.name,
          email:       form.email,
          skills:      form.skills.split(',').map((s) => s.trim()).filter(Boolean),
          experience:  form.experience,
          desiredRate: form.desiredRate,
          location:    form.location,
          workStyle:   form.workStyle,
          office:      form.office,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? '登録に失敗しました')
      setCredentials({ email: json.data.user.email, tempPassword: json.data.tempPassword })
      setStep('done')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '登録に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-vatch-bg">
      <Topbar title="プロパ登録" />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-2xl mx-auto">

          {step === 'upload' && (
            <div className="bg-vatch-surface border border-vatch-border rounded-xl p-6 space-y-6">
              <h2 className="text-base font-bold text-white">Step 1: 拠点選択 + 経歴書アップロード</h2>

              <div>
                <label className="block text-xs text-vatch-muted mb-2">拠点</label>
                <div className="flex gap-2">
                  {(['TOKYO', 'NAGOYA'] as Office[]).map((o) => (
                    <button key={o} onClick={() => setOffice(o)} className={`px-5 py-2 rounded-lg text-sm font-medium border transition-colors ${office === o ? 'bg-[#0c2d5a] border-[#38bdf8] text-[#38bdf8]' : 'border-vatch-border text-vatch-muted hover:text-white'}`}>
                      {o === 'TOKYO' ? '東京' : '名古屋'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-vatch-muted mb-2">経歴書ファイル（.doc / .docx）</label>
                <input ref={fileRef} type="file" accept=".doc,.docx" className="block w-full text-sm text-vatch-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-vatch-border file:text-xs file:text-vatch-muted file:bg-vatch-bg hover:file:border-[#38bdf8] hover:file:text-[#38bdf8] transition-colors cursor-pointer" />
              </div>

              {extractError && <p className="text-red-400 text-xs">{extractError}</p>}

              <button onClick={handleExtract} disabled={extracting} className="w-full py-2.5 bg-[#38bdf8] text-black text-sm font-bold rounded-lg disabled:opacity-50">
                {extracting ? 'AI解析中...' : '経歴書を解析する'}
              </button>
            </div>
          )}

          {step === 'confirm' && (
            <div className="bg-vatch-surface border border-vatch-border rounded-xl p-6 space-y-4">
              <h2 className="text-base font-bold text-white">Step 2: 内容確認・編集</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: '氏名', key: 'name', type: 'text' },
                  { label: 'メールアドレス', key: 'email', type: 'email' },
                  { label: '経験年数（年）', key: 'experience', type: 'number' },
                  { label: '希望単価（万円）', key: 'desiredRate', type: 'number' },
                  { label: '居住地', key: 'location', type: 'text' },
                ].map(({ label, key, type }) => (
                  <div key={key} className={key === 'email' ? 'col-span-2' : ''}>
                    <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">{label}</label>
                    <input type={type} value={(form as Record<string, unknown>)[key] as string} onChange={(e) => setForm((f) => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors" />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">スキル（カンマ区切り）</label>
                  <input type="text" value={form.skills} onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">勤務形式</label>
                  <select value={form.workStyle} onChange={(e) => setForm((f) => ({ ...f, workStyle: e.target.value as WorkStyle }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors">
                    {(Object.keys(WORK_STYLE_LABELS) as WorkStyle[]).map((w) => <option key={w} value={w}>{WORK_STYLE_LABELS[w]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">拠点</label>
                  <select value={form.office} onChange={(e) => setForm((f) => ({ ...f, office: e.target.value as Office }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors">
                    <option value="TOKYO">東京</option>
                    <option value="NAGOYA">名古屋</option>
                  </select>
                </div>
              </div>
              {saveError && <p className="text-red-400 text-xs">{saveError}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep('upload')} className="flex-1 py-2.5 border border-vatch-border text-vatch-muted text-sm rounded-lg hover:border-[#38bdf8] hover:text-[#38bdf8] transition-colors">戻る</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-[#38bdf8] text-black text-sm font-bold rounded-lg disabled:opacity-50">{saving ? '登録中...' : '登録する'}</button>
              </div>
            </div>
          )}

          {step === 'done' && credentials && (
            <div className="bg-vatch-surface border border-[#4ade80] rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[#4ade80] text-xl">✓</span>
                <h2 className="text-base font-bold text-white">登録完了</h2>
              </div>
              <p className="text-sm text-vatch-muted">以下のログイン情報をプロパ本人に伝えてください。</p>
              <div className="bg-vatch-bg rounded-lg p-4 space-y-3">
                <div>
                  <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">ログインURL</div>
                  <div className="text-sm text-white font-mono">/login</div>
                </div>
                <div>
                  <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">メールアドレス</div>
                  <div className="text-sm text-white font-mono">{credentials.email}</div>
                </div>
                <div>
                  <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">仮パスワード</div>
                  <div className="text-lg text-[#38bdf8] font-mono font-bold tracking-widest">{credentials.tempPassword}</div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setStep('upload'); setCredentials(null) }} className="flex-1 py-2.5 border border-vatch-border text-vatch-muted text-sm rounded-lg hover:text-white transition-colors">続けて登録</button>
                <button onClick={() => router.push('/proper')} className="flex-1 py-2.5 bg-[#38bdf8] text-black text-sm font-bold rounded-lg">一覧に戻る</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add src/app/(main)/proper/new/page.tsx
git commit -m "feat: プロパ登録画面（経歴書アップロード→AI抽出→確認→登録）を追加"
```

---

## Task 10: プロパ詳細画面

**Files:**
- Create: `src/app/(main)/proper/[id]/page.tsx`

- [ ] **Step 1: プロパ詳細ページを作成する**

`src/app/(main)/proper/[id]/page.tsx`:
```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'

type WorkStyle = 'REMOTE' | 'ONSITE' | 'HYBRID'
type TalentStatus = 'AVAILABLE' | 'ACTIVE' | 'NEGOTIATING' | 'ENDING_SOON' | 'INACTIVE'
type Office = 'TOKYO' | 'NAGOYA'

type ProperDetail = {
  id: string; name: string; skills: string[]; experience: number; desiredRate: number
  location: string; workStyle: WorkStyle; status: TalentStatus; office: Office
  properUser?: { email: string } | null
}

const WORK_STYLE_LABELS: Record<WorkStyle, string> = { REMOTE: 'リモート', ONSITE: '常駐', HYBRID: 'ハイブリッド' }
const STATUS_LABELS: Record<TalentStatus, string>  = { AVAILABLE: '空き', ACTIVE: '稼働中', NEGOTIATING: '交渉中', ENDING_SOON: '終了間近', INACTIVE: '非活動' }

export default function ProperDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [talent, setTalent] = useState<ProperDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<ProperDetail>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetResult, setResetResult] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/proper/${id}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) { setTalent(j.data); setForm(j.data) } })
      .finally(() => setLoading(false))
  }, [id])

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/proper/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, skills: form.skills, experience: form.experience, desiredRate: form.desiredRate, location: form.location, workStyle: form.workStyle, status: form.status, office: form.office }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? '保存に失敗しました')
      setTalent(json.data); setEditing(false)
    } catch (e) { setError(e instanceof Error ? e.message : '保存に失敗しました') }
    finally { setSaving(false) }
  }

  async function handleResetPassword() {
    setResetResult(null)
    const res = await fetch(`/api/proper/${id}/reset-password`, { method: 'POST' })
    const json = await res.json()
    if (res.ok) setResetResult(`新しい仮パスワード: ${json.data.tempPassword}`)
    else setResetResult('リセットに失敗しました')
  }

  if (loading) return <div className="flex flex-col h-full bg-vatch-bg"><Topbar title="プロパ詳細" /><div className="flex-1 flex items-center justify-center text-vatch-muted">読み込み中...</div></div>
  if (!talent) return <div className="flex flex-col h-full bg-vatch-bg"><Topbar title="プロパ詳細" /><div className="flex-1 flex items-center justify-center text-vatch-muted">データが見つかりません</div></div>

  return (
    <div className="flex flex-col h-full bg-vatch-bg">
      <Topbar title={`プロパ詳細: ${talent.name}`} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-2xl mx-auto space-y-4">
          <div className="flex gap-3">
            <button onClick={() => router.push('/proper')} className="px-3 py-1.5 text-xs border border-vatch-border text-vatch-muted rounded-lg hover:border-[#38bdf8] hover:text-[#38bdf8] transition-colors">← 一覧に戻る</button>
            {!editing && <button onClick={() => setEditing(true)} className="px-3 py-1.5 text-xs border border-vatch-border text-vatch-muted rounded-lg hover:border-[#38bdf8] hover:text-[#38bdf8] transition-colors">✏ 編集</button>}
          </div>

          <div className="bg-vatch-surface border border-vatch-border rounded-xl p-6">
            {editing ? (
              <div className="grid grid-cols-2 gap-4">
                {([['name','氏名','text'],['experience','経験年数（年）','number'],['desiredRate','希望単価（万円）','number'],['location','居住地','text']] as [keyof ProperDetail, string, string][]).map(([key, label, type]) => (
                  <div key={key}>
                    <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">{label}</label>
                    <input type={type} value={(form as Record<string, unknown>)[key] as string ?? ''} onChange={(e) => setForm((f) => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors" />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">スキル（カンマ区切り）</label>
                  <input type="text" value={(form.skills ?? []).join(', ')} onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">ステータス</label>
                  <select value={form.status ?? 'AVAILABLE'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TalentStatus }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors">
                    {(Object.keys(STATUS_LABELS) as TalentStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-vatch-muted uppercase tracking-wide mb-1">拠点</label>
                  <select value={form.office ?? 'TOKYO'} onChange={(e) => setForm((f) => ({ ...f, office: e.target.value as Office }))} className="w-full bg-vatch-bg border border-vatch-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38bdf8] transition-colors">
                    <option value="TOKYO">東京</option><option value="NAGOYA">名古屋</option>
                  </select>
                </div>
                {error && <p className="col-span-2 text-red-400 text-xs">{error}</p>}
                <div className="col-span-2 flex gap-3">
                  <button onClick={() => { setEditing(false); setForm(talent) }} className="flex-1 py-2 border border-vatch-border text-vatch-muted text-sm rounded-lg hover:border-[#38bdf8] hover:text-[#38bdf8] transition-colors">キャンセル</button>
                  <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-[#38bdf8] text-black text-sm font-bold rounded-lg disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['拠点', talent.office === 'TOKYO' ? '東京' : '名古屋'],
                  ['居住地', talent.location],
                  ['経験年数', `${talent.experience}年`],
                  ['希望単価', `${talent.desiredRate}万円`],
                  ['勤務形式', WORK_STYLE_LABELS[talent.workStyle]],
                  ['ステータス', STATUS_LABELS[talent.status]],
                  ['ログインメール', talent.properUser?.email ?? '—'],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">{label}</div>
                    <div className="text-sm text-white">{value}</div>
                  </div>
                ))}
                <div className="col-span-2">
                  <div className="text-[10px] text-vatch-muted uppercase tracking-wide mb-1">スキル</div>
                  <div className="flex flex-wrap gap-1">{talent.skills.map((s) => <span key={s} className="px-2 py-0.5 bg-vatch-border/50 text-vatch-muted rounded text-xs">{s}</span>)}</div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-vatch-surface border border-vatch-border rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-3">パスワード管理</h3>
            <button onClick={handleResetPassword} className="px-4 py-2 border border-vatch-border text-vatch-muted text-xs rounded-lg hover:border-[#f59e0b] hover:text-[#f59e0b] transition-colors">仮パスワードを再発行</button>
            {resetResult && <p className="mt-3 text-sm text-[#38bdf8] font-mono">{resetResult}</p>}
          </div>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add src/app/(main)/proper/[id]/page.tsx
git commit -m "feat: プロパ詳細・編集・パスワードリセット画面を追加"
```

---

## Task 11: ポータルレイアウト + ポータル画面 + お気に入り画面

**Files:**
- Create: `src/app/(portal)/layout.tsx`
- Create: `src/app/(portal)/portal/page.tsx`
- Create: `src/app/(portal)/portal/favorites/page.tsx`

- [ ] **Step 1: ポータルレイアウトを作成する**

`src/app/(portal)/layout.tsx`:
```tsx
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-vatch-bg">
      <header className="border-b border-vatch-border bg-vatch-surface px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-[18px] font-black text-amber-400 tracking-widest">VATCH</div>
          <div className="text-[9px] text-slate-600 tracking-wide">PORTAL</div>
        </div>
        <nav className="flex gap-1">
          <a href="/portal" className="px-3 py-1.5 text-xs text-vatch-muted hover:text-white rounded-md hover:bg-vatch-border transition-colors">案件一覧</a>
          <a href="/portal/favorites" className="px-3 py-1.5 text-xs text-vatch-muted hover:text-white rounded-md hover:bg-vatch-border transition-colors">お気に入り</a>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: ポータル案件一覧ページを作成する**

`src/app/(portal)/portal/page.tsx`:
```tsx
'use client'

import { useState, useEffect } from 'react'

type WorkStyle = 'REMOTE' | 'ONSITE' | 'HYBRID'

type PortalCase = {
  id: string
  caseId: string
  score: number
  isFavorited: boolean
  case: {
    id: string; title: string; client: string; skills: string[]
    unitPrice: number; workStyle: WorkStyle; startDate: string
  }
}

const WS_LABELS: Record<WorkStyle, string> = { REMOTE: 'リモート', ONSITE: '常駐', HYBRID: 'ハイブリッド' }
const WS_COLORS: Record<WorkStyle, string> = { REMOTE: 'text-[#38bdf8]', ONSITE: 'text-[#f59e0b]', HYBRID: 'text-[#a78bfa]' }

function scoreColor(s: number) {
  if (s >= 80) return '#4ade80'
  if (s >= 60) return '#38bdf8'
  return '#a78bfa'
}

export default function PortalPage() {
  const [items, setItems] = useState<PortalCase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal/cases')
      .then((r) => r.json())
      .then((j) => { if (j.success) setItems(j.data) })
      .finally(() => setLoading(false))
  }, [])

  async function toggleFavorite(item: PortalCase) {
    const optimistic = items.map((i) => i.id === item.id ? { ...i, isFavorited: !i.isFavorited } : i)
    setItems(optimistic)
    try {
      if (item.isFavorited) {
        await fetch(`/api/favorites/${item.caseId}`, { method: 'DELETE' })
      } else {
        await fetch('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: item.caseId }) })
      }
    } catch {
      setItems(items)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">あなたにマッチする案件</h1>
        <p className="text-sm text-vatch-muted mt-1">{loading ? '読み込み中...' : `${items.length}件`}</p>
      </div>

      {!loading && items.length === 0 && (
        <div className="text-center py-16 text-vatch-muted">マッチする案件がまだありません</div>
      )}

      <div className="grid gap-4">
        {items.map((item) => (
          <div key={item.id} className="bg-vatch-surface border border-vatch-border rounded-xl p-5 hover:border-[#38bdf8]/40 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: scoreColor(item.score), backgroundColor: `${scoreColor(item.score)}18` }}>
                    スコア {item.score}
                  </span>
                  <span className={`text-xs ${WS_COLORS[item.case.workStyle]}`}>{WS_LABELS[item.case.workStyle]}</span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1 truncate">{item.case.title}</h3>
                <p className="text-xs text-vatch-muted mb-3">{item.case.client}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {item.case.skills.slice(0, 5).map((s) => (
                    <span key={s} className="px-1.5 py-0.5 bg-vatch-border/50 text-vatch-muted rounded text-xs">{s}</span>
                  ))}
                </div>
                <div className="text-xs text-vatch-muted">
                  <span className="text-white font-semibold">{item.case.unitPrice}万円</span>
                  <span className="mx-2">·</span>
                  <span>開始: {new Date(item.case.startDate).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit' })}</span>
                </div>
              </div>
              <button
                onClick={() => toggleFavorite(item)}
                className={`shrink-0 text-2xl transition-colors ${item.isFavorited ? 'text-[#f59e0b]' : 'text-vatch-border hover:text-[#f59e0b]'}`}
                aria-label={item.isFavorited ? 'お気に入りを解除' : 'お気に入りに追加'}
              >
                {item.isFavorited ? '★' : '☆'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: お気に入りページを作成する**

`src/app/(portal)/portal/favorites/page.tsx`:
```tsx
'use client'

import { useState, useEffect } from 'react'

type WorkStyle = 'REMOTE' | 'ONSITE' | 'HYBRID'

type FavoriteItem = {
  id: string
  caseId: string
  case: { id: string; title: string; client: string; skills: string[]; unitPrice: number; workStyle: WorkStyle; startDate: string }
}

const WS_LABELS: Record<WorkStyle, string> = { REMOTE: 'リモート', ONSITE: '常駐', HYBRID: 'ハイブリッド' }

export default function FavoritesPage() {
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/favorites')
      .then((r) => r.json())
      .then((j) => { if (j.success) setItems(j.data) })
      .finally(() => setLoading(false))
  }, [])

  async function removeFavorite(caseId: string) {
    setItems((prev) => prev.filter((i) => i.caseId !== caseId))
    await fetch(`/api/favorites/${caseId}`, { method: 'DELETE' })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">お気に入り案件</h1>
        <p className="text-sm text-vatch-muted mt-1">{loading ? '読み込み中...' : `${items.length}件`}</p>
      </div>

      {!loading && items.length === 0 && (
        <div className="text-center py-16 text-vatch-muted">
          <p>お気に入り案件はありません</p>
          <a href="/portal" className="mt-3 inline-block text-xs text-[#38bdf8] hover:underline">案件一覧に戻る</a>
        </div>
      )}

      <div className="grid gap-4">
        {items.map((item) => (
          <div key={item.id} className="bg-vatch-surface border border-vatch-border rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-vatch-muted">{WS_LABELS[item.case.workStyle]}</span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1 truncate">{item.case.title}</h3>
                <p className="text-xs text-vatch-muted mb-3">{item.case.client}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {item.case.skills.slice(0, 5).map((s) => (
                    <span key={s} className="px-1.5 py-0.5 bg-vatch-border/50 text-vatch-muted rounded text-xs">{s}</span>
                  ))}
                </div>
                <div className="text-xs text-vatch-muted">
                  <span className="text-white font-semibold">{item.case.unitPrice}万円</span>
                  <span className="mx-2">·</span>
                  <span>開始: {new Date(item.case.startDate).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit' })}</span>
                </div>
              </div>
              <button onClick={() => removeFavorite(item.caseId)} className="shrink-0 text-2xl text-[#f59e0b] hover:text-[#f59e0b]/60 transition-colors" aria-label="お気に入りを解除">★</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: コミット**

```bash
git add src/app/(portal)/
git commit -m "feat: ポータルレイアウト・マッチング案件一覧・お気に入り画面を追加"
```

---

## Task 12: 全テスト実行 + 動作確認

- [ ] **Step 1: 全テストを実行する**

```bash
npx jest --no-coverage
```

Expected: 全テスト PASS

- [ ] **Step 2: 開発サーバーを起動して動作確認する**

```bash
npm run dev
```

確認項目:
1. `/proper` — プロパ一覧（東京/名古屋タブ）が表示される
2. `/proper/new` — 経歴書アップロードフォームが表示される
3. `/portal` にアクセスしようとすると → ダッシュボードにリダイレクトされる（管理者の場合）
4. `/login` — ログインフォームが表示される

- [ ] **Step 3: 最終コミット**

```bash
git add -A
git commit -m "feat: プロパ人材管理機能を実装（一覧・登録・詳細・ポータル・お気に入り）"
```
