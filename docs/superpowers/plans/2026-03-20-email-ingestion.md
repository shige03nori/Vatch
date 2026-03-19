# Email Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 特定のIMAPメールボックスから受信メールを取得し、Claude APIで案件/人材情報を抽出してDBに自動登録する。

**Architecture:** IMAP接続でメールを取得し（imap-simple）、Claude API（tool_use方式）で本文を解析して EmailType を判定。Case または Talent レコードを自動作成する。手動トリガー（UIボタン + POST /api/emails/fetch）と定期実行（fly.io Scheduled Machines）の両方に対応。

**Tech Stack:** `imap-simple`, `mailparser`, `@anthropic-ai/sdk`, AES-256-GCM（Node.js crypto組み込み）, Prisma, Next.js Route Handlers

**Spec:** `docs/superpowers/specs/2026-03-20-email-ingestion-design.md`

---

## File Map

### 新規作成

| ファイル | 責務 |
|---|---|
| `prisma/migrations/<timestamp>_email_ingestion/` | スキーマ変更のマイグレーション |
| `src/lib/crypto.ts` | IMAPパスワードのAES-256-GCM暗号化・復号 |
| `src/lib/email-fetcher.ts` | IMAP接続・未読メール取得・重複チェック |
| `src/lib/email-parser.ts` | Claude API（tool_use）でメール本文を解析 |
| `src/lib/email-ingestion.ts` | 取込フロー全体のオーケストレーター |
| `src/lib/schemas/email-source.ts` | EmailSource の Zod バリデーションスキーマ |
| `src/app/api/emails/fetch/route.ts` | POST /api/emails/fetch（取込トリガー） |
| `src/app/api/email-sources/route.ts` | GET・POST /api/email-sources |
| `src/app/api/email-sources/[id]/route.ts` | PATCH・DELETE /api/email-sources/[id] |
| `src/app/(main)/settings/email-sources/page.tsx` | EmailSource 管理画面 |
| `src/lib/__tests__/crypto.test.ts` | crypto.ts のユニットテスト |
| `src/lib/__tests__/email-parser.test.ts` | email-parser.ts のユニットテスト |
| `src/lib/__tests__/email-ingestion.test.ts` | email-ingestion.ts の統合テスト |
| `src/app/api/emails/fetch/__tests__/route.test.ts` | fetch route のユニットテスト |
| `src/app/api/email-sources/__tests__/route.test.ts` | email-sources route のユニットテスト |

> **email-fetcher.ts のテストについて:** IMAPはネットワークIOを伴うため、ユニットテストは作成しない。email-ingestion.ts のテスト内で email-fetcher をモックすることでカバーする。

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `prisma/schema.prisma` | EmailType.UNKNOWN追加、Email.messageId追加、Email.activities追加、ActivityLog.emailId追加、EmailSource追加 |
| `src/lib/schemas/email.ts` | EmailType に UNKNOWN を追加 |
| `src/app/(main)/emails/page.tsx` | ダミーデータ削除、API連携、UNKNOWN型表示対応 |
| `.env.example` | EMAIL_SOURCE_ENCRYPTION_KEY, INTERNAL_API_KEY の追記 |

---

## Task 1: Prismaスキーマ変更とマイグレーション

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/schemas/email.ts`

- [ ] **Step 1: schema.prisma を変更する**

`prisma/schema.prisma` の該当箇所を以下のように変更する：

```prisma
// EmailType enum に UNKNOWN を追加
enum EmailType {
  CASE
  TALENT
  UNKNOWN
}

// Email モデルに messageId と activities を追加
model Email {
  id            String      @id @default(cuid())
  receivedAt    DateTime
  from          String
  fromEmail     String
  subject       String
  bodyText      String      @db.Text
  type          EmailType
  status        EmailStatus @default(PENDING)
  skills        String[]
  extractedName String?
  confidence    Int?
  s3Key         String?
  messageId     String?     @unique   // 追加

  cases      Case[]        @relation("EmailToCase")
  talents    Talent[]      @relation("EmailToTalent")
  activities ActivityLog[]            // 追加

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ActivityLog モデルに emailId を追加
model ActivityLog {
  id          String          @id @default(cuid())
  type        ActivityLogType
  description String
  userId      String?
  caseId      String?
  talentId    String?
  matchingId  String?
  proposalId  String?
  emailId     String?                  // 追加

  user     User?     @relation(fields: [userId], references: [id])
  case     Case?     @relation(fields: [caseId], references: [id])
  talent   Talent?   @relation(fields: [talentId], references: [id])
  matching Matching? @relation(fields: [matchingId], references: [id])
  proposal Proposal? @relation(fields: [proposalId], references: [id])
  email    Email?    @relation(fields: [emailId], references: [id])  // 追加

  createdAt DateTime @default(now())
}

// EmailSource を追加（既存モデルの後に）
model EmailSource {
  id        String   @id @default(cuid())
  label     String
  imapHost  String
  imapPort  Int      @default(993)
  imapUser  String
  imapPass  String   // AES-256-GCMで暗号化して保存
  isActive  Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ActivityLogType に EMAIL_SOURCE_CREATED は追加しない（YAGNIに従い最小限）
```

- [ ] **Step 2: マイグレーションを実行する**

```bash
npx prisma migrate dev --name email_ingestion
```

期待：マイグレーションファイルが生成されて `prisma/migrations/` に保存される

- [ ] **Step 3: Prismaクライアントを再生成する**

```bash
npx prisma generate
```

- [ ] **Step 4: `src/lib/schemas/email.ts` の EmailType を更新する**

既存の `CreateEmailSchema` の type フィールドを変更：

```typescript
type: z.enum(['CASE', 'TALENT', 'UNKNOWN']),
```

`EmailQuerySchema` の type フィールドも同様に更新：

```typescript
type: z.enum(['CASE', 'TALENT', 'UNKNOWN']).optional(),
```

- [ ] **Step 5: TypeScript コンパイルエラーを確認する**

```bash
npx tsc --noEmit
```

期待：エラー0件。もしエラーが出た場合は EmailType を参照している箇所に `UNKNOWN` ケースを追加する。

- [ ] **Step 6: 既存テストが通ることを確認する**

```bash
npx jest --testPathPattern="emails" --no-coverage
```

期待：全テストPASS

- [ ] **Step 7: コミットする**

```bash
git add prisma/schema.prisma prisma/migrations/ src/lib/schemas/email.ts
git commit -m "feat: add EmailSource model, messageId, UNKNOWN type, ActivityLog.emailId"
```

---

## Task 2: 環境変数の設定

**Files:**
- Modify: `.env.example`（存在しない場合は作成）
- ローカルの `.env` にも追記（gitignore済みのため手動で）

- [ ] **Step 1: `.env.example` に新規キーを追記する**

```bash
# Email Ingestion
EMAIL_SOURCE_ENCRYPTION_KEY=   # 32バイトのランダム16進数文字列（openssl rand -hex 32 で生成）
INTERNAL_API_KEY=              # /api/emails/fetch のcron認証キー（openssl rand -hex 32 で生成）
```

- [ ] **Step 2: ローカルの `.env` に実際の値を設定する**

```bash
openssl rand -hex 32
# 出力された値を EMAIL_SOURCE_ENCRYPTION_KEY に設定

openssl rand -hex 32
# 出力された値を INTERNAL_API_KEY に設定
```

`.env` に追記：
```
EMAIL_SOURCE_ENCRYPTION_KEY=<生成した値>
INTERNAL_API_KEY=<生成した値>
```

- [ ] **Step 3: コミットする**

```bash
git add .env.example
git commit -m "chore: add EMAIL_SOURCE_ENCRYPTION_KEY and INTERNAL_API_KEY to env example"
```

---

## Task 3: パッケージのインストール

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: 必要なパッケージをインストールする**

```bash
npm install imap-simple mailparser @anthropic-ai/sdk
npm install --save-dev @types/imap-simple @types/mailparser
```

- [ ] **Step 2: インストール確認**

```bash
node -e "require('imap-simple'); require('mailparser'); require('@anthropic-ai/sdk'); console.log('OK')"
```

期待：`OK` が出力される

- [ ] **Step 3: コミットする**

```bash
git add package.json package-lock.json
git commit -m "chore: install imap-simple, mailparser, @anthropic-ai/sdk"
```

---

## Task 4: crypto.ts（IMAPパスワード暗号化）

**Files:**
- Create: `src/lib/crypto.ts`
- Create: `src/lib/__tests__/crypto.test.ts`

- [ ] **Step 1: テストファイルを作成する**

`src/lib/__tests__/crypto.test.ts`:

```typescript
/** @jest-environment node */
import { encrypt, decrypt } from '../crypto'

describe('crypto', () => {
  const key = '0'.repeat(64) // 32バイト = 64文字の16進数

  it('encrypt returns a non-empty string different from input', () => {
    const encrypted = encrypt('secret-password', key)
    expect(encrypted).toBeTruthy()
    expect(encrypted).not.toBe('secret-password')
  })

  it('decrypt recovers the original string', () => {
    const original = 'my-imap-password'
    const encrypted = encrypt(original, key)
    expect(decrypt(encrypted, key)).toBe(original)
  })

  it('same input produces different ciphertext each time (random IV)', () => {
    const a = encrypt('same', key)
    const b = encrypt('same', key)
    expect(a).not.toBe(b)
  })

  it('decrypt throws on tampered ciphertext', () => {
    const encrypted = encrypt('data', key)
    const tampered = encrypted.slice(0, -2) + 'XX'
    expect(() => decrypt(tampered, key)).toThrow()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest src/lib/__tests__/crypto.test.ts --no-coverage
```

期待：FAIL（モジュールが見つからない）

- [ ] **Step 3: `src/lib/crypto.ts` を実装する**

```typescript
// src/lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // GCMの推奨IVサイズ
const TAG_LENGTH = 16

function getKey(hexKey: string): Buffer {
  return Buffer.from(hexKey, 'hex')
}

export function encrypt(plaintext: string, hexKey: string): string {
  const key = getKey(hexKey)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // iv + tag + encrypted を base64 にまとめて返す
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decrypt(ciphertext: string, hexKey: string): string {
  const key = getKey(hexKey)
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  // Buffer.toString('utf8') で明示的にエンコードしてマルチバイト文字の文字化けを防ぐ
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
```

- [ ] **Step 4: テストを実行して全件PASSを確認する**

```bash
npx jest src/lib/__tests__/crypto.test.ts --no-coverage
```

期待：4件すべてPASS

- [ ] **Step 5: コミットする**

```bash
git add src/lib/crypto.ts src/lib/__tests__/crypto.test.ts
git commit -m "feat: add AES-256-GCM encrypt/decrypt for IMAP passwords"
```

---

## Task 5: email-parser.ts（Claude API解析）

**Files:**
- Create: `src/lib/email-parser.ts`
- Create: `src/lib/__tests__/email-parser.test.ts`

- [ ] **Step 1: テストファイルを作成する**

`src/lib/__tests__/email-parser.test.ts`:

```typescript
/** @jest-environment node */
import { parseEmailBody, type ParsedEmailResult } from '../email-parser'

const mockCreate = jest.fn()
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: { create: (...args: unknown[]) => mockCreate(...args) },
  })),
}))

function makeToolUseResponse(input: ParsedEmailResult) {
  return {
    content: [{ type: 'tool_use', name: 'extract_email_info', input }],
  }
}

beforeEach(() => jest.clearAllMocks())

describe('parseEmailBody', () => {
  it('returns CASE type with extracted case info', async () => {
    mockCreate.mockResolvedValueOnce(makeToolUseResponse({
      type: 'CASE',
      confidence: 90,
      extractedName: 'Javaエンジニア募集',
      skills: ['Java', 'Spring Boot'],
      case: {
        title: 'Javaエンジニア募集',
        client: '株式会社テスト',
        clientEmail: 'test@example.com',
        unitPrice: 700000,
        startDate: '2026-04-01T00:00:00Z',
        workStyle: 'REMOTE',
      },
    }))

    const result = await parseEmailBody('案件のメール本文')
    expect(result.type).toBe('CASE')
    expect(result.case?.title).toBe('Javaエンジニア募集')
    expect(result.skills).toContain('Java')
  })

  it('returns TALENT type with extracted talent info', async () => {
    mockCreate.mockResolvedValueOnce(makeToolUseResponse({
      type: 'TALENT',
      confidence: 85,
      extractedName: '山田太郎',
      skills: ['React', 'TypeScript'],
      talent: {
        name: '山田太郎',
        experience: 5,
        desiredRate: 600000,
        location: '東京都',
        workStyle: 'HYBRID',
      },
    }))

    const result = await parseEmailBody('人材のメール本文')
    expect(result.type).toBe('TALENT')
    expect(result.talent?.name).toBe('山田太郎')
  })

  it('returns UNKNOWN when Claude returns UNKNOWN type', async () => {
    mockCreate.mockResolvedValueOnce(makeToolUseResponse({
      type: 'UNKNOWN',
      confidence: 20,
      extractedName: undefined,
      skills: [],
    }))

    const result = await parseEmailBody('判定不能なメール')
    expect(result.type).toBe('UNKNOWN')
  })

  it('retries once on API failure and throws after second failure', async () => {
    mockCreate
      .mockRejectedValueOnce(new Error('API Error'))
      .mockRejectedValueOnce(new Error('API Error'))

    await expect(parseEmailBody('test')).rejects.toThrow('API Error')
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it('truncates long email body to 3000 characters', async () => {
    mockCreate.mockResolvedValueOnce(makeToolUseResponse({
      type: 'UNKNOWN', confidence: 10, extractedName: undefined, skills: [],
    }))

    const longBody = 'a'.repeat(5000)
    await parseEmailBody(longBody)

    const calledBody = mockCreate.mock.calls[0][0].messages[0].content
    expect(calledBody.length).toBeLessThanOrEqual(3000)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest src/lib/__tests__/email-parser.test.ts --no-coverage
```

期待：FAIL（モジュールが見つからない）

- [ ] **Step 3: `src/lib/email-parser.ts` を実装する**

```typescript
// src/lib/email-parser.ts
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type ParsedEmailResult = {
  type: 'CASE' | 'TALENT' | 'UNKNOWN'
  confidence: number
  extractedName?: string
  skills: string[]
  case?: {
    title: string
    client: string
    clientEmail?: string
    unitPrice: number
    startDate: string
    workStyle: 'REMOTE' | 'ONSITE' | 'HYBRID'
  }
  talent?: {
    name: string
    experience: number
    desiredRate: number
    location: string
    workStyle: 'REMOTE' | 'ONSITE' | 'HYBRID'
  }
}

const TOOL_DEFINITION: Anthropic.Tool = {
  name: 'extract_email_info',
  description: 'SES営業メールから案件または人材情報を抽出する',
  input_schema: {
    type: 'object' as const,
    properties: {
      type: { type: 'string', enum: ['CASE', 'TALENT', 'UNKNOWN'] },
      confidence: { type: 'number', minimum: 0, maximum: 100 },
      extractedName: { type: 'string' },
      skills: { type: 'array', items: { type: 'string' } },
      case: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          client: { type: 'string' },
          clientEmail: { type: 'string' },
          unitPrice: { type: 'number' },
          startDate: { type: 'string' },
          workStyle: { type: 'string', enum: ['REMOTE', 'ONSITE', 'HYBRID'] },
        },
        required: ['title', 'client', 'unitPrice', 'startDate', 'workStyle'],
      },
      talent: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          experience: { type: 'number' },
          desiredRate: { type: 'number' },
          location: { type: 'string' },
          workStyle: { type: 'string', enum: ['REMOTE', 'ONSITE', 'HYBRID'] },
        },
        required: ['name', 'experience', 'desiredRate', 'location', 'workStyle'],
      },
    },
    required: ['type', 'confidence', 'skills'],
  },
}

async function callClaude(bodyText: string): Promise<ParsedEmailResult> {
  const truncated = bodyText.slice(0, 3000)
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    tools: [TOOL_DEFINITION],
    tool_choice: { type: 'tool', name: 'extract_email_info' },
    messages: [
      {
        role: 'user',
        content: `以下のSES営業メールを解析して案件または人材情報を抽出してください。\n\n${truncated}`,
      },
    ],
  })

  const toolUse = response.content.find((c) => c.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not return tool_use response')
  }
  return toolUse.input as ParsedEmailResult
}

export async function parseEmailBody(bodyText: string): Promise<ParsedEmailResult> {
  try {
    return await callClaude(bodyText)
  } catch {
    // 1回リトライ
    return await callClaude(bodyText)
  }
}
```

- [ ] **Step 4: テストを実行して全件PASSを確認する**

```bash
npx jest src/lib/__tests__/email-parser.test.ts --no-coverage
```

期待：5件すべてPASS

- [ ] **Step 5: コミットする**

```bash
git add src/lib/email-parser.ts src/lib/__tests__/email-parser.test.ts
git commit -m "feat: add Claude API email parser with tool_use and retry"
```

---

## Task 6: EmailSource の Zodスキーマ

**Files:**
- Create: `src/lib/schemas/email-source.ts`

- [ ] **Step 1: スキーマファイルを作成する**

`src/lib/schemas/email-source.ts`:

```typescript
// src/lib/schemas/email-source.ts
import { z } from 'zod'

export const CreateEmailSourceSchema = z.object({
  label:    z.string().min(1),
  imapHost: z.string().min(1),
  imapPort: z.number().int().min(1).max(65535).default(993),
  imapUser: z.string().email(),
  imapPass: z.string().min(1),
})

export const UpdateEmailSourceSchema = z.object({
  label:    z.string().min(1).optional(),
  imapHost: z.string().min(1).optional(),
  imapPort: z.number().int().min(1).max(65535).optional(),
  imapUser: z.string().email().optional(),
  imapPass: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
})
```

- [ ] **Step 2: TypeScriptコンパイル確認**

```bash
npx tsc --noEmit
```

期待：エラーなし

- [ ] **Step 3: コミットする**

```bash
git add src/lib/schemas/email-source.ts
git commit -m "feat: add EmailSource Zod schemas"
```

---

## Task 7: email-fetcher.ts（IMAP取得）

**Files:**
- Create: `src/lib/email-fetcher.ts`

> **注意:** imap-simple はネットワークIOを伴うため、このタスクではユニットテストではなく手動検証を行う。テストはemail-ingestion.tsのモック経由で担保する。

- [ ] **Step 1: `src/lib/email-fetcher.ts` を作成する**

```typescript
// src/lib/email-fetcher.ts
import imaps from 'imap-simple'
import { simpleParser } from 'mailparser'

export type FetchedEmail = {
  messageId: string | null
  from: string
  fromEmail: string
  subject: string
  bodyText: string
  receivedAt: Date
}

export type ImapConfig = {
  imapHost: string
  imapPort: number
  imapUser: string
  imapPass: string
}

export async function fetchUnreadEmails(config: ImapConfig): Promise<FetchedEmail[]> {
  const connection = await imaps.connect({
    imap: {
      host: config.imapHost,
      port: config.imapPort,
      user: config.imapUser,
      password: config.imapPass,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
    },
  })

  await connection.openBox('INBOX')

  const searchCriteria = ['UNSEEN']
  const fetchOptions = { bodies: ['HEADER', 'TEXT', ''], markSeen: true }

  const messages = await connection.search(searchCriteria, fetchOptions)
  connection.end()

  const results: FetchedEmail[] = []

  for (const message of messages) {
    const all = message.parts.find((p) => p.which === '')
    if (!all) continue

    const parsed = await simpleParser(all.body as string)
    const from = parsed.from?.value[0]

    results.push({
      messageId: parsed.messageId ?? null,
      from:      from?.name ?? from?.address ?? '',
      fromEmail: from?.address ?? '',
      subject:   parsed.subject ?? '(件名なし)',
      bodyText:  parsed.text ?? '',
      receivedAt: parsed.date ?? new Date(),
    })
  }

  return results
}
```

- [ ] **Step 2: TypeScriptコンパイル確認**

```bash
npx tsc --noEmit
```

期待：エラーなし

- [ ] **Step 3: コミットする**

```bash
git add src/lib/email-fetcher.ts
git commit -m "feat: add IMAP email fetcher"
```

---

## Task 8: email-ingestion.ts（オーケストレーター）

**Files:**
- Create: `src/lib/email-ingestion.ts`
- Create: `src/lib/__tests__/email-ingestion.test.ts`

- [ ] **Step 1: テストファイルを作成する**

`src/lib/__tests__/email-ingestion.test.ts`:

```typescript
/** @jest-environment node */
import { runIngestion, type IngestionResult } from '../email-ingestion'

// Prismaモック
const mockEmailCreate = jest.fn()
const mockEmailUpdate = jest.fn()
const mockEmailFindUnique = jest.fn()
const mockCaseCreate = jest.fn()
const mockTalentCreate = jest.fn()
const mockUserFindFirst = jest.fn()
const mockActivityCreate = jest.fn()
const mockEmailSourceFindMany = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    email:       { create: (...a: unknown[]) => mockEmailCreate(...a), update: (...a: unknown[]) => mockEmailUpdate(...a), findUnique: (...a: unknown[]) => mockEmailFindUnique(...a) },
    case:        { create: (...a: unknown[]) => mockCaseCreate(...a) },
    talent:      { create: (...a: unknown[]) => mockTalentCreate(...a) },
    user:        { findFirst: (...a: unknown[]) => mockUserFindFirst(...a) },
    activityLog: { create: (...a: unknown[]) => mockActivityCreate(...a) },
    emailSource: { findMany: (...a: unknown[]) => mockEmailSourceFindMany(...a) },
  },
}))

// email-fetcherモック
const mockFetchUnreadEmails = jest.fn()
jest.mock('../email-fetcher', () => ({
  fetchUnreadEmails: (...a: unknown[]) => mockFetchUnreadEmails(...a),
}))

// email-parserモック
const mockParseEmailBody = jest.fn()
jest.mock('../email-parser', () => ({
  parseEmailBody: (...a: unknown[]) => mockParseEmailBody(...a),
}))

// cryptoモック
jest.mock('../crypto', () => ({
  decrypt: (v: string) => `decrypted:${v}`,
}))

const mockSource = {
  id: 'src1', label: 'Test', imapHost: 'imap.example.com',
  imapPort: 993, imapUser: 'user@example.com', imapPass: 'encrypted-pass', isActive: true,
}

const mockFetchedEmail = {
  messageId: '<test@example.com>',
  from: 'Sender Name',
  fromEmail: 'sender@example.com',
  subject: 'Java案件のご紹介',
  bodyText: 'Java Springの案件です',
  receivedAt: new Date('2026-03-20T10:00:00Z'),
}

const mockAdminUser = { id: 'admin1', role: 'ADMIN' }

beforeEach(() => jest.clearAllMocks())

describe('runIngestion', () => {
  it('fetches emails from active sources and creates CASE record', async () => {
    mockEmailSourceFindMany.mockResolvedValueOnce([mockSource])
    mockFetchUnreadEmails.mockResolvedValueOnce([mockFetchedEmail])
    mockEmailFindUnique.mockResolvedValueOnce(null) // 重複なし
    mockEmailCreate.mockResolvedValueOnce({ id: 'email1' })
    mockEmailUpdate.mockResolvedValueOnce({})
    mockParseEmailBody.mockResolvedValueOnce({
      type: 'CASE', confidence: 90, extractedName: 'Java案件', skills: ['Java'],
      case: { title: 'Java案件', client: '顧客A', unitPrice: 700000, startDate: '2026-04-01T00:00:00Z', workStyle: 'REMOTE' },
    })
    mockUserFindFirst.mockResolvedValueOnce(mockAdminUser)
    mockCaseCreate.mockResolvedValueOnce({ id: 'case1' })
    mockActivityCreate.mockResolvedValue({})

    const result: IngestionResult = await runIngestion()

    expect(result.fetched).toBe(1)
    expect(result.parsed).toBe(1)
    expect(result.errors).toBe(0)
    expect(mockCaseCreate).toHaveBeenCalledTimes(1)
    // EMAIL_RECEIVED + EMAIL_PARSED + CASE_CREATED の3回ログが記録される
    expect(mockActivityCreate).toHaveBeenCalledTimes(3)
  })

  it('skips duplicate email by messageId', async () => {
    mockEmailSourceFindMany.mockResolvedValueOnce([mockSource])
    mockFetchUnreadEmails.mockResolvedValueOnce([mockFetchedEmail])
    mockEmailFindUnique.mockResolvedValueOnce({ id: 'existing' }) // 重複あり

    const result = await runIngestion()

    expect(result.fetched).toBe(0)
    expect(mockEmailCreate).not.toHaveBeenCalled()
  })

  it('sets status=ERROR when parser throws', async () => {
    mockEmailSourceFindMany.mockResolvedValueOnce([mockSource])
    mockFetchUnreadEmails.mockResolvedValueOnce([mockFetchedEmail])
    mockEmailFindUnique.mockResolvedValueOnce(null)
    mockEmailCreate.mockResolvedValueOnce({ id: 'email1' })
    mockParseEmailBody.mockRejectedValueOnce(new Error('API Error'))
    mockEmailUpdate.mockResolvedValue({})
    mockActivityCreate.mockResolvedValue({})

    const result = await runIngestion()

    expect(result.errors).toBe(1)
    expect(mockEmailUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'ERROR' }),
    }))
  })

  it('creates TALENT record for TALENT type', async () => {
    mockEmailSourceFindMany.mockResolvedValueOnce([mockSource])
    mockFetchUnreadEmails.mockResolvedValueOnce([mockFetchedEmail])
    mockEmailFindUnique.mockResolvedValueOnce(null)
    mockEmailCreate.mockResolvedValueOnce({ id: 'email1' })
    mockEmailUpdate.mockResolvedValue({})
    mockParseEmailBody.mockResolvedValueOnce({
      type: 'TALENT', confidence: 85, extractedName: '山田太郎', skills: ['React'],
      talent: { name: '山田太郎', experience: 5, desiredRate: 600000, location: '東京都', workStyle: 'HYBRID' },
    })
    mockUserFindFirst.mockResolvedValueOnce(mockAdminUser)
    mockTalentCreate.mockResolvedValueOnce({ id: 'talent1' })
    mockActivityCreate.mockResolvedValue({})

    const result = await runIngestion()

    expect(result.parsed).toBe(1)
    expect(mockTalentCreate).toHaveBeenCalledTimes(1)
  })

  it('returns unknown count when type is UNKNOWN', async () => {
    mockEmailSourceFindMany.mockResolvedValueOnce([mockSource])
    mockFetchUnreadEmails.mockResolvedValueOnce([mockFetchedEmail])
    mockEmailFindUnique.mockResolvedValueOnce(null)
    mockEmailCreate.mockResolvedValueOnce({ id: 'email1' })
    mockEmailUpdate.mockResolvedValue({})
    mockParseEmailBody.mockResolvedValueOnce({
      type: 'UNKNOWN', confidence: 20, extractedName: undefined, skills: [],
    })
    mockActivityCreate.mockResolvedValue({})

    const result = await runIngestion()

    expect(result.unknown).toBe(1)
    expect(mockCaseCreate).not.toHaveBeenCalled()
    expect(mockTalentCreate).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest src/lib/__tests__/email-ingestion.test.ts --no-coverage
```

期待：FAIL

- [ ] **Step 3: `src/lib/email-ingestion.ts` を実装する**

```typescript
// src/lib/email-ingestion.ts
import { prisma } from '@/lib/prisma'
import { fetchUnreadEmails } from './email-fetcher'
import { parseEmailBody } from './email-parser'
import { decrypt } from './crypto'

const ENCRYPTION_KEY = process.env.EMAIL_SOURCE_ENCRYPTION_KEY ?? ''

export type IngestionResult = {
  fetched: number
  parsed: number
  errors: number
  unknown: number
}

export async function runIngestion(): Promise<IngestionResult> {
  const result: IngestionResult = { fetched: 0, parsed: 0, errors: 0, unknown: 0 }

  const sources = await prisma.emailSource.findMany({ where: { isActive: true } })

  for (const source of sources) {
    let emails: Awaited<ReturnType<typeof fetchUnreadEmails>> = []

    try {
      emails = await fetchUnreadEmails({
        imapHost: source.imapHost,
        imapPort: source.imapPort,
        imapUser: source.imapUser,
        imapPass: decrypt(source.imapPass, ENCRYPTION_KEY),
      })
    } catch (err) {
      console.error(`[ingestion] IMAP fetch failed for ${source.imapUser}:`, err)
      continue
    }

    for (const fetched of emails) {
      // 重複チェック（Message-ID）
      if (fetched.messageId) {
        const existing = await prisma.email.findUnique({ where: { messageId: fetched.messageId } })
        if (existing) continue
      }

      // Email を PENDING/UNKNOWN で保存
      const emailRecord = await prisma.email.create({
        data: {
          receivedAt:   fetched.receivedAt,
          from:         fetched.from,
          fromEmail:    fetched.fromEmail,
          subject:      fetched.subject,
          bodyText:     fetched.bodyText,
          type:         'UNKNOWN',
          status:       'PENDING',
          skills:       [],
          messageId:    fetched.messageId,
        },
      })
      result.fetched++

      await prisma.activityLog.create({
        data: { type: 'EMAIL_RECEIVED', description: `メール取込: ${fetched.subject}`, emailId: emailRecord.id },
      })

      // AI解析
      await prisma.email.update({ where: { id: emailRecord.id }, data: { status: 'PARSING' } })

      try {
        const parsed = await parseEmailBody(fetched.bodyText)

        await prisma.email.update({
          where: { id: emailRecord.id },
          data: {
            type:          parsed.type,
            status:        'PARSED',
            skills:        parsed.skills,
            extractedName: parsed.extractedName,
            confidence:    parsed.confidence,
          },
        })

        // 解析完了ログ（種別問わず常に記録）
        await prisma.activityLog.create({
          data: { type: 'EMAIL_PARSED', description: `AI解析完了: ${parsed.type} (信頼度${parsed.confidence}%)`, emailId: emailRecord.id },
        })

        if (parsed.type === 'CASE' && parsed.case) {
          const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } })
          if (!adminUser) throw new Error('No ADMIN user found')

          const createdCase = await prisma.case.create({
            data: {
              title:          parsed.case.title,
              client:         parsed.case.client,
              clientEmail:    parsed.case.clientEmail,
              skills:         parsed.skills,
              unitPrice:      parsed.case.unitPrice,
              startDate:      new Date(parsed.case.startDate),
              workStyle:      parsed.case.workStyle,
              status:         'OPEN',
              assignedUserId: adminUser.id,
              sourceEmailId:  emailRecord.id,
            },
          })
          await prisma.activityLog.create({
            data: { type: 'CASE_CREATED', description: `案件登録: ${parsed.case.title}`, emailId: emailRecord.id, caseId: createdCase.id },
          })
          result.parsed++
        } else if (parsed.type === 'TALENT' && parsed.talent) {
          const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } })
          if (!adminUser) throw new Error('No ADMIN user found')

          const createdTalent = await prisma.talent.create({
            data: {
              name:           parsed.talent.name,
              skills:         parsed.skills,
              experience:     parsed.talent.experience,
              desiredRate:    parsed.talent.desiredRate,
              location:       parsed.talent.location,
              workStyle:      parsed.talent.workStyle,
              status:         'AVAILABLE',
              assignedUserId: adminUser.id,
              sourceEmailId:  emailRecord.id,
              agencyEmail:    fetched.fromEmail,
            },
          })
          await prisma.activityLog.create({
            data: { type: 'TALENT_CREATED', description: `人材登録: ${parsed.talent.name}`, emailId: emailRecord.id, talentId: createdTalent.id },
          })
          result.parsed++
        } else {
          // UNKNOWN は EMAIL_PARSED のみ記録済み（CASE/TALENT作成なし）
          result.unknown++
        }
      } catch (err) {
        console.error(`[ingestion] Parse/create failed for email ${emailRecord.id}:`, err)
        await prisma.email.update({ where: { id: emailRecord.id }, data: { status: 'ERROR' } })
        await prisma.activityLog.create({
          data: { type: 'EMAIL_PARSED', description: `解析エラー: ${fetched.subject}`, emailId: emailRecord.id },
        })
        result.errors++
      }
    }
  }

  return result
}
```

- [ ] **Step 4: テストを実行して全件PASSを確認する**

```bash
npx jest src/lib/__tests__/email-ingestion.test.ts --no-coverage
```

期待：5件すべてPASS

- [ ] **Step 5: コミットする**

```bash
git add src/lib/email-ingestion.ts src/lib/__tests__/email-ingestion.test.ts
git commit -m "feat: add email ingestion orchestrator"
```

---

## Task 9: /api/emails/fetch ルート

**Files:**
- Create: `src/app/api/emails/fetch/route.ts`
- Create: `src/app/api/emails/fetch/__tests__/route.test.ts`

- [ ] **Step 1: テストファイルを作成する**

`src/app/api/emails/fetch/__tests__/route.test.ts`:

```typescript
/** @jest-environment node */
import { POST } from '../route'

const mockRunIngestion = jest.fn()
jest.mock('@/lib/email-ingestion', () => ({
  runIngestion: (...a: unknown[]) => mockRunIngestion(...a),
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...a: unknown[]) => mockAuth(...a) }))

const INTERNAL_KEY = 'test-internal-key'

beforeEach(() => {
  jest.clearAllMocks()
  process.env.INTERNAL_API_KEY = INTERNAL_KEY
})

describe('POST /api/emails/fetch', () => {
  it('returns 401 when not authenticated and no internal key', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const req = new Request('http://localhost/api/emails/fetch', { method: 'POST' })
    expect((await POST(req)).status).toBe(401)
  })

  it('allows access with valid INTERNAL_API_KEY header', async () => {
    mockAuth.mockResolvedValueOnce(null)
    mockRunIngestion.mockResolvedValueOnce({ fetched: 1, parsed: 1, errors: 0, unknown: 0 })
    const req = new Request('http://localhost/api/emails/fetch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${INTERNAL_KEY}` },
    })
    expect((await POST(req)).status).toBe(200)
  })

  it('returns 403 when STAFF user calls', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'u1', role: 'STAFF' } })
    const req = new Request('http://localhost/api/emails/fetch', { method: 'POST' })
    expect((await POST(req)).status).toBe(403)
  })

  it('ADMIN gets 200 with ingestion result', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'a1', role: 'ADMIN' } })
    mockRunIngestion.mockResolvedValueOnce({ fetched: 3, parsed: 2, errors: 1, unknown: 0 })
    const req = new Request('http://localhost/api/emails/fetch', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.fetched).toBe(3)
    expect(body.data.errors).toBe(1)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest src/app/api/emails/fetch/__tests__/route.test.ts --no-coverage
```

期待：FAIL

- [ ] **Step 3: ルートを実装する**

`src/app/api/emails/fetch/route.ts`:

```typescript
// src/app/api/emails/fetch/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ok, unauthorized, forbidden, serverError } from '@/lib/api'
import { runIngestion } from '@/lib/email-ingestion'

export async function POST(request: Request): Promise<NextResponse> {
  // 内部APIキー認証（cronからの呼び出し用）
  const authHeader = request.headers.get('Authorization')
  const internalKey = process.env.INTERNAL_API_KEY
  if (internalKey && authHeader === `Bearer ${internalKey}`) {
    try {
      return ok(await runIngestion())
    } catch {
      return serverError()
    }
  }

  // 通常のセッション認証
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (session.user.role !== 'ADMIN') return forbidden()

  try {
    return ok(await runIngestion())
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 4: テストを実行して全件PASSを確認する**

```bash
npx jest src/app/api/emails/fetch/__tests__/route.test.ts --no-coverage
```

期待：4件すべてPASS

- [ ] **Step 5: コミットする**

```bash
git add src/app/api/emails/fetch/route.ts src/app/api/emails/fetch/__tests__/route.test.ts
git commit -m "feat: add POST /api/emails/fetch trigger endpoint"
```

---

## Task 10: /api/email-sources CRUD ルート

**Files:**
- Create: `src/app/api/email-sources/route.ts`
- Create: `src/app/api/email-sources/[id]/route.ts`
- Create: `src/app/api/email-sources/__tests__/route.test.ts`

- [ ] **Step 1: テストファイルを作成する**

`src/app/api/email-sources/__tests__/route.test.ts`:

```typescript
/** @jest-environment node */
import { GET, POST } from '../route'

const mockFindMany = jest.fn()
const mockCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    emailSource: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      create:   (...a: unknown[]) => mockCreate(...a),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...a: unknown[]) => mockAuth(...a) }))

jest.mock('@/lib/crypto', () => ({ encrypt: (v: string) => `encrypted:${v}` }))

const adminSession = { user: { id: 'a1', role: 'ADMIN' } }
const staffSession = { user: { id: 's1', role: 'STAFF' } }

beforeEach(() => jest.clearAllMocks())

describe('GET /api/email-sources', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await GET()).status).toBe(401)
  })

  it('STAFF can list sources (imapPass excluded)', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindMany.mockResolvedValueOnce([
      { id: 's1', label: 'Test', imapHost: 'imap.example.com', imapPort: 993, imapUser: 'u@e.com', imapPass: 'secret', isActive: true },
    ])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data[0].imapPass).toBeUndefined()
  })
})

describe('POST /api/email-sources', () => {
  it('returns 403 for STAFF', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    const req = new Request('http://localhost/api/email-sources', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect((await POST(req)).status).toBe(403)
  })

  it('ADMIN creates email source with encrypted password', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockCreate.mockResolvedValueOnce({ id: 'src1', label: 'Test', imapHost: 'imap.example.com', imapPort: 993, imapUser: 'u@e.com', isActive: true })
    const req = new Request('http://localhost/api/email-sources', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Test', imapHost: 'imap.example.com', imapPort: 993, imapUser: 'u@example.com', imapPass: 'mypassword' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    // imapPass は暗号化して保存されている
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ imapPass: 'encrypted:mypassword' }),
    }))
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest src/app/api/email-sources/__tests__/route.test.ts --no-coverage
```

期待：FAIL

- [ ] **Step 3: GET・POST ルートを実装する**

`src/app/api/email-sources/route.ts`:

```typescript
// src/app/api/email-sources/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, created, forbidden, unprocessable, serverError, requireAuth } from '@/lib/api'
import { CreateEmailSourceSchema } from '@/lib/schemas/email-source'
import { encrypt } from '@/lib/crypto'

const ENCRYPTION_KEY = process.env.EMAIL_SOURCE_ENCRYPTION_KEY ?? ''

export async function GET(): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  try {
    const sources = await prisma.emailSource.findMany({ orderBy: { createdAt: 'asc' } })
    // imapPass を除外して返す
    const safeData = sources.map(({ imapPass: _, ...rest }) => rest)
    return ok(safeData)
  } catch {
    return serverError()
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  if (!authResult.isAdmin) return forbidden()

  const body = await request.json().catch(() => ({}))
  const parsed = CreateEmailSourceSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.issues)

  try {
    const { imapPass, ...rest } = parsed.data
    const record = await prisma.emailSource.create({
      data: { ...rest, imapPass: encrypt(imapPass, ENCRYPTION_KEY) },
    })
    const { imapPass: _, ...safeRecord } = record
    return created(safeRecord)
  } catch {
    return serverError()
  }
}
```

- [ ] **Step 4: PATCH・DELETE ルートを実装する**

`src/app/api/email-sources/[id]/route.ts`:

```typescript
// src/app/api/email-sources/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, forbidden, notFound, unprocessable, serverError, requireAuth } from '@/lib/api'
import { UpdateEmailSourceSchema } from '@/lib/schemas/email-source'
import { encrypt } from '@/lib/crypto'

const ENCRYPTION_KEY = process.env.EMAIL_SOURCE_ENCRYPTION_KEY ?? ''

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  if (!authResult.isAdmin) return forbidden()

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = UpdateEmailSourceSchema.safeParse(body)
  if (!parsed.success) return unprocessable(parsed.error.issues)

  try {
    const { imapPass, ...rest } = parsed.data
    const data = {
      ...rest,
      ...(imapPass ? { imapPass: encrypt(imapPass, ENCRYPTION_KEY) } : {}),
    }
    const record = await prisma.emailSource.update({ where: { id }, data })
    const { imapPass: _, ...safeRecord } = record
    return ok(safeRecord)
  } catch {
    return serverError()
  }
}

export async function DELETE(_request: Request, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  if (!authResult.isAdmin) return forbidden()

  const { id } = await params
  try {
    await prisma.emailSource.delete({ where: { id } })
    return ok({ deleted: true })
  } catch {
    return notFound()
  }
}
```

- [ ] **Step 5: テストを実行して全件PASSを確認する**

```bash
npx jest src/app/api/email-sources/__tests__/route.test.ts --no-coverage
```

期待：4件すべてPASS

- [ ] **Step 6: 全テストを実行して既存テストが壊れていないことを確認する**

```bash
npx jest --no-coverage
```

期待：全件PASS

- [ ] **Step 7: コミットする**

```bash
git add src/app/api/email-sources/ src/lib/schemas/email-source.ts
git commit -m "feat: add /api/email-sources CRUD endpoints"
```

---

## Task 11: /emails/page.tsx の DB連携切り替え

**Files:**
- Modify: `src/app/(main)/emails/page.tsx`

- [ ] **Step 1: ダミーデータ参照を削除してAPI連携に切り替える**

`src/app/(main)/emails/page.tsx` の冒頭部分を変更する。

削除する行：
```typescript
import { emails } from '@/data/emails';
import type { EmailItem, EmailStatus } from '@/data/emails';
```

追加する型定義（ファイル上部）：
```typescript
type EmailStatus = 'PENDING' | 'PARSING' | 'PARSED' | 'ERROR';

type EmailItem = {
  id: string;
  receivedAt: string;
  from: string;
  subject: string;
  type: 'CASE' | 'TALENT' | 'UNKNOWN';
  status: EmailStatus;
  skills: string[];
  extractedName: string | null;
  confidence: number | null;
};
```

`EmailsPage` コンポーネントを以下のように書き換える：

```typescript
export default function EmailsPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  async function loadEmails() {
    setLoading(true);
    try {
      const res = await fetch('/api/emails?limit=100');
      const json = await res.json();
      if (json.success) setEmails(json.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadEmails(); }, []);

  async function handleFetchNow() {
    setFetching(true);
    try {
      await fetch('/api/emails/fetch', { method: 'POST' });
      await loadEmails();
    } finally {
      setFetching(false);
    }
  }

  // ... 既存のfiltered, counts ロジックはそのまま（emails ステートを参照）
```

- [ ] **Step 2: UNKNOWN 型バッジを追加する**

`TypeBadge` コンポーネントに UNKNOWN ケースを追加：

```typescript
function TypeBadge({ type }: { type: EmailItem['type'] }) {
  if (type === 'case' || type === 'CASE') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-vatch-cyan/10 text-vatch-cyan border border-vatch-cyan/30">
        案件
      </span>
    );
  }
  if (type === 'talent' || type === 'TALENT') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-vatch-purple/10 text-vatch-purple border border-vatch-purple/30">
        人材
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-vatch-muted/10 text-vatch-muted border border-vatch-muted/30">
      不明
    </span>
  );
}
```

- [ ] **Step 3: TypeScriptコンパイルエラーがないことを確認する**

```bash
npx tsc --noEmit
```

期待：エラーなし

- [ ] **Step 4: コミットする**

```bash
git add src/app/(main)/emails/page.tsx
git commit -m "feat: connect /emails page to real API (remove dummy data)"
```

---

## Task 12: /settings/email-sources 管理画面

**Files:**
- Create: `src/app/(main)/settings/email-sources/page.tsx`

- [ ] **Step 1: 管理画面を作成する**

`src/app/(main)/settings/email-sources/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Topbar } from '@/components/layout/Topbar';

type EmailSource = {
  id: string;
  label: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  isActive: boolean;
};

const emptyForm = { label: '', imapHost: '', imapPort: 993, imapUser: '', imapPass: '' };

export default function EmailSourcesPage() {
  const [sources, setSources] = useState<EmailSource[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const res = await fetch('/api/email-sources');
    const json = await res.json();
    if (json.success) setSources(json.data);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/email-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, imapPort: Number(form.imapPort) }),
      });
      if (!res.ok) { setError('追加に失敗しました'); return; }
      setForm(emptyForm);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/email-sources/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    });
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm('削除しますか？')) return;
    await fetch(`/api/email-sources/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-vatch-bg">
      <Topbar title="メール取込設定" />
      <main className="flex-1 p-6 flex flex-col gap-6">
        {/* 登録済み一覧 */}
        <div className="bg-vatch-surface border border-vatch-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-vatch-border">
            <h2 className="text-sm font-semibold text-vatch-text">取込対象メールアドレス</h2>
          </div>
          {sources.length === 0 ? (
            <p className="px-4 py-8 text-center text-vatch-muted text-sm">登録済みの取込設定がありません</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-vatch-border bg-vatch-bg/40">
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-vatch-muted">ラベル</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-vatch-muted">IMAPホスト</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-vatch-muted">ユーザー</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-vatch-muted">状態</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sources.map((src) => (
                  <tr key={src.id} className="border-b border-vatch-border hover:bg-vatch-surface/60">
                    <td className="px-4 py-3 text-[13px] text-vatch-text">{src.label}</td>
                    <td className="px-4 py-3 text-[13px] text-vatch-text-dim">{src.imapHost}:{src.imapPort}</td>
                    <td className="px-4 py-3 text-[13px] text-vatch-text-dim">{src.imapUser}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggle(src.id, src.isActive)}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                          src.isActive
                            ? 'bg-vatch-green/10 text-vatch-green border-vatch-green/30 hover:bg-vatch-green/20'
                            : 'bg-vatch-muted/10 text-vatch-muted border-vatch-muted/30 hover:bg-vatch-muted/20'
                        }`}
                      >
                        {src.isActive ? '有効' : '無効'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(src.id)}
                        className="px-2 py-1 rounded text-[12px] text-vatch-red border border-vatch-red/30 hover:bg-vatch-red/10 transition-colors"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 追加フォーム */}
        <div className="bg-vatch-surface border border-vatch-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-vatch-text mb-4">取込設定を追加</h2>
          <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
            {error && <p className="col-span-2 text-[13px] text-vatch-red">{error}</p>}
            {[
              { label: 'ラベル', key: 'label', type: 'text', placeholder: 'BP取込用' },
              { label: 'IMAPホスト', key: 'imapHost', type: 'text', placeholder: 'imap.gmail.com' },
              { label: 'IMAPポート', key: 'imapPort', type: 'number', placeholder: '993' },
              { label: 'ユーザー名（メールアドレス）', key: 'imapUser', type: 'email', placeholder: 'you@example.com' },
              { label: 'パスワード', key: 'imapPass', type: 'password', placeholder: '••••••••' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} className={key === 'imapPass' ? 'col-span-2' : ''}>
                <label className="block text-[12px] text-vatch-muted mb-1">{label}</label>
                <input
                  type={type}
                  value={String(form[key as keyof typeof form])}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-vatch-bg border border-vatch-border text-[13px] text-vatch-text placeholder:text-vatch-muted focus:outline-none focus:border-vatch-cyan"
                />
              </div>
            ))}
            <div className="col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-vatch-cyan text-vatch-bg font-semibold text-sm hover:bg-vatch-cyan/90 disabled:opacity-50 transition-colors"
              >
                {saving ? '追加中...' : '追加'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: 設定メニューへのリンクを確認する**

`src/app/(main)/settings/` 配下のナビゲーションに `/settings/email-sources` へのリンクが必要な場合は追加する。既存の設定画面の構造を確認して適切な場所にリンクを追加すること。

- [ ] **Step 3: TypeScriptコンパイル確認**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: コミットする**

```bash
git add src/app/(main)/settings/email-sources/
git commit -m "feat: add email-sources management UI"
```

---

## Task 13: 全テスト実行と最終確認

- [ ] **Step 1: 全テストを実行する**

```bash
npx jest --no-coverage
```

期待：全件PASS（既存テスト含む）

- [ ] **Step 2: TypeScriptコンパイルエラーがないことを確認する**

```bash
npx tsc --noEmit
```

期待：エラー0件

- [ ] **Step 3: 開発サーバーを起動して動作確認する**

```bash
npm run dev
```

確認項目：
- `/emails` ページが表示される（エラーなし）
- `/settings/email-sources` ページが表示される
- 「今すぐ取込」ボタンがある（ADMINでログインした状態でのみ機能）

- [ ] **Step 4: 最終コミット（変更が残っていれば）**

```bash
git add -A
git commit -m "chore: final cleanup and type checks"
```

---

## Task 14: fly.io Scheduled Machines の設定（デプロイ後）

> **注意:** この手順はdevelop→staging→masterのデプロイフロー後に実施する。

- [ ] **Step 1: fly.io の最新ドキュメントを確認する**

`https://fly.io/docs/machines/` で Scheduled Machines の設定方法を確認する。

- [ ] **Step 2: INTERNAL_API_KEY を fly.io のシークレットに登録する**

```bash
fly secrets set INTERNAL_API_KEY=<生成した値> --app vatch
fly secrets set EMAIL_SOURCE_ENCRYPTION_KEY=<生成した値> --app vatch
fly secrets set ANTHROPIC_API_KEY=<APIキー> --app vatch
```

- [ ] **Step 3: Scheduled Machine を作成する**

```bash
# fly.io ドキュメントに従い、30分おきに /api/emails/fetch を叩く Machine を作成
# 例（実際のコマンドはドキュメント参照）:
fly machine run --app vatch \
  --schedule "*/30 * * * *" \
  --image registry.fly.io/vatch:latest \
  -- curl -s -X POST \
     -H "Authorization: Bearer ${INTERNAL_API_KEY}" \
     https://vatch.fly.dev/api/emails/fetch
```

- [ ] **Step 4: 動作確認**

fly.io のダッシュボードまたは `fly logs` でScheduled Machineが正常に実行されていることを確認する。
