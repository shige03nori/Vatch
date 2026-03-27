# Resume Attachment 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** メール取込時に添付されている PDF/DOCX（経歴書）をローカルストレージに保存し、Talent レコードに紐付ける。

**Architecture:** `email-fetcher` で添付ファイルを取得し、`file-storage`（ローカル/S3 抽象レイヤー）に保存後、`Talent.resumeKey/resumeFilename` に記録する。ファイル保存の失敗は非クリティカルで Talent 登録に影響しない。

**Tech Stack:** Next.js 14, Prisma, PostgreSQL, imap-simple, mailparser, Node.js `fs/promises`

---

## ファイル構成

| ファイル | 操作 | 概要 |
|---------|------|------|
| `prisma/schema.prisma` | 変更 | Talent に resumeKey / resumeFilename を追加 |
| `prisma/migrations/...` | 新規 | `prisma migrate dev` で自動生成 |
| `src/lib/file-storage.ts` | 新規 | ストレージ抽象レイヤー（Local実装のみ） |
| `src/lib/__tests__/file-storage.test.ts` | 新規 | LocalStorage の単体テスト |
| `src/lib/email-fetcher.ts` | 変更 | FetchedEmail に attachments[] を追加 |
| `src/lib/__tests__/email-fetcher.test.ts` | 新規 | 添付抽出ロジックの単体テスト |
| `src/lib/email-ingestion.ts` | 変更 | Talent 作成後に添付ファイルを保存 |
| `src/lib/__tests__/email-ingestion.test.ts` | 変更 | 添付保存ケースを追加 |

---

## Task 1: Prisma スキーマに resumeKey / resumeFilename を追加

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: schema.prisma の Talent モデルに2フィールドを追加**

`prisma/schema.prisma` の `Talent` モデル末尾の `createdAt` の直前に追加：

```prisma
  resumeKey      String?
  resumeFilename String?
```

追加後の該当箇所：
```prisma
model Talent {
  id             String       @id @default(cuid())
  name           String
  skills         String[]
  experience     Int
  desiredRate    Int
  location       String
  workStyle      WorkStyle
  status         TalentStatus @default(AVAILABLE)
  availableFrom  DateTime?
  agencyEmail    String?
  assignedUserId String
  sourceEmailId  String?      @unique
  resumeKey      String?
  resumeFilename String?

  assignedUser User        @relation(fields: [assignedUserId], references: [id])
  sourceEmail  Email?      @relation("EmailToTalent", fields: [sourceEmailId], references: [id])
  matchings    Matching[]
  contracts    Contract[]
  activities   ActivityLog[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
}
```

- [ ] **Step 2: マイグレーションを生成・適用**

```bash
npx prisma migrate dev --name add_talent_resume_fields
```

Expected: `migrations/YYYYMMDD_add_talent_resume_fields/migration.sql` が生成され適用される

- [ ] **Step 3: Prisma Client を再生成して型を確認**

```bash
npx prisma generate
```

Expected: エラーなし。`Talent` 型に `resumeKey: string | null`, `resumeFilename: string | null` が含まれる

- [ ] **Step 4: コミット**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: Talent に resumeKey/resumeFilename フィールドを追加"
```

---

## Task 2: file-storage.ts を作成（LocalStorage 実装）

**Files:**
- Create: `src/lib/file-storage.ts`
- Create: `src/lib/__tests__/file-storage.test.ts`

- [ ] **Step 1: テストを先に書く**

`src/lib/__tests__/file-storage.test.ts` を新規作成：

```typescript
/** @jest-environment node */
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { getFileStorage } from '../file-storage'

describe('LocalStorage', () => {
  let tmpDir: string
  let origEnv: string | undefined
  let origCwd: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vatch-test-'))
    origEnv = process.env.STORAGE_BACKEND
    origCwd = process.cwd()
    // シングルトンをリセットして次のテストに持ち越さない
    const { _resetFileStorageForTest } = await import('../file-storage')
    _resetFileStorageForTest()
    // process.cwd() をモックして tmpDir を返すように差し替える
    jest.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    delete process.env.STORAGE_BACKEND
  })

  afterEach(async () => {
    process.env.STORAGE_BACKEND = origEnv
    jest.spyOn(process, 'cwd').mockReturnValue(origCwd)
    jest.restoreAllMocks()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('saves a file and the file exists on disk', async () => {
    const storage = getFileStorage()
    const key = 'resumes/test-file.pdf'
    const buffer = Buffer.from('dummy pdf content')

    await storage.save(key, buffer)

    const filePath = path.join(tmpDir, 'uploads', key)
    const content = await fs.readFile(filePath)
    expect(content).toEqual(buffer)
  })

  it('creates the directory if it does not exist', async () => {
    const storage = getFileStorage()
    // uploads/resumes/ は存在しない状態から save する
    await expect(storage.save('resumes/new.pdf', Buffer.from('x'))).resolves.not.toThrow()
    const stat = await fs.stat(path.join(tmpDir, 'uploads', 'resumes'))
    expect(stat.isDirectory()).toBe(true)
  })

  it('deletes a file', async () => {
    const storage = getFileStorage()
    const key = 'resumes/to-delete.pdf'
    await storage.save(key, Buffer.from('content'))

    await storage.delete(key)

    const filePath = path.join(tmpDir, 'uploads', key)
    await expect(fs.access(filePath)).rejects.toThrow()
  })

  it('delete does not throw if file does not exist', async () => {
    const storage = getFileStorage()
    await expect(storage.delete('resumes/nonexistent.pdf')).resolves.not.toThrow()
  })

  it('getUrl returns a path string containing the key', () => {
    const storage = getFileStorage()
    const url = storage.getUrl('resumes/abc.pdf')
    expect(url).toContain('resumes/abc.pdf')
  })
})
```

- [ ] **Step 2: テストを実行して FAIL することを確認**

```bash
npx jest src/lib/__tests__/file-storage.test.ts --no-coverage
```

Expected: FAIL（`../file-storage` が存在しない）

- [ ] **Step 3: file-storage.ts を実装**

`src/lib/file-storage.ts` を新規作成：

```typescript
// src/lib/file-storage.ts
import * as fs from 'fs/promises'
import * as path from 'path'

type StorageBackend = {
  save(key: string, buffer: Buffer): Promise<void>
  getUrl(key: string): string
  delete(key: string): Promise<void>
}

class LocalStorage implements StorageBackend {
  private get baseDir(): string {
    return path.join(process.cwd(), 'uploads')
  }

  async save(key: string, buffer: Buffer): Promise<void> {
    const filePath = path.join(this.baseDir, key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, buffer)
  }

  getUrl(key: string): string {
    return path.join(this.baseDir, key)
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.baseDir, key)
    try {
      await fs.unlink(filePath)
    } catch {
      // ファイルが存在しない場合は無視
    }
  }
}

let _storage: StorageBackend | null = null

export function getFileStorage(): StorageBackend {
  if (_storage) return _storage
  const backend = process.env.STORAGE_BACKEND ?? 'local'
  if (backend === 'local') {
    _storage = new LocalStorage()
  } else {
    throw new Error(`Unsupported STORAGE_BACKEND: ${backend}. Currently only 'local' is supported.`)
  }
  return _storage
}

// テスト用にリセット可能にする
export function _resetFileStorageForTest(): void {
  _storage = null
}
```

- [ ] **Step 4: テストを実行して PASS することを確認**

```bash
npx jest src/lib/__tests__/file-storage.test.ts --no-coverage
```

Expected: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/file-storage.ts src/lib/__tests__/file-storage.test.ts
git commit -m "feat: file-storage LocalStorage 実装を追加"
```

---

## Task 3: email-fetcher.ts に添付ファイル抽出を追加

**Files:**
- Modify: `src/lib/email-fetcher.ts`
- Create: `src/lib/__tests__/email-fetcher.test.ts`

- [ ] **Step 1: テストを先に書く**

`src/lib/__tests__/email-fetcher.test.ts` を新規作成：

```typescript
/** @jest-environment node */

// imap-simple と mailparser をモック
const mockConnect = jest.fn()
const mockOpenBox = jest.fn()
const mockSearch = jest.fn()
const mockEnd = jest.fn()

jest.mock('imap-simple', () => ({
  connect: (...a: unknown[]) => mockConnect(...a),
}))

const mockSimpleParser = jest.fn()
jest.mock('mailparser', () => ({
  simpleParser: (...a: unknown[]) => mockSimpleParser(...a),
}))

import { fetchUnreadEmails } from '../email-fetcher'

const config = {
  imapHost: 'imap.example.com',
  imapPort: 993,
  imapUser: 'user@example.com',
  imapPass: 'pass',
}

function makeConnection() {
  return { openBox: mockOpenBox, search: mockSearch, end: mockEnd }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockConnect.mockResolvedValue(makeConnection())
  mockOpenBox.mockResolvedValue(undefined)
  mockEnd.mockReturnValue(undefined)
})

describe('fetchUnreadEmails - attachments', () => {
  it('returns empty attachments array when no attachments', async () => {
    mockSearch.mockResolvedValueOnce([{ parts: [{ which: '', body: 'raw' }] }])
    mockSimpleParser.mockResolvedValueOnce({
      messageId: '<id1>',
      from: { value: [{ name: 'Sender', address: 'sender@example.com' }] },
      subject: 'テスト',
      text: '本文',
      date: new Date(),
      attachments: [],
    })

    const results = await fetchUnreadEmails(config)
    expect(results[0].attachments).toEqual([])
  })

  it('extracts PDF attachment', async () => {
    mockSearch.mockResolvedValueOnce([{ parts: [{ which: '', body: 'raw' }] }])
    mockSimpleParser.mockResolvedValueOnce({
      messageId: '<id2>',
      from: { value: [{ address: 'sender@example.com' }] },
      subject: 'テスト',
      text: '本文',
      date: new Date(),
      attachments: [
        {
          filename: '経歴書.pdf',
          content: Buffer.from('pdf content'),
          contentType: 'application/pdf',
        },
      ],
    })

    const results = await fetchUnreadEmails(config)
    expect(results[0].attachments).toHaveLength(1)
    expect(results[0].attachments[0].filename).toBe('経歴書.pdf')
    expect(results[0].attachments[0].contentType).toBe('application/pdf')
  })

  it('extracts DOCX attachment with correct contentType', async () => {
    mockSearch.mockResolvedValueOnce([{ parts: [{ which: '', body: 'raw' }] }])
    mockSimpleParser.mockResolvedValueOnce({
      messageId: '<id3>',
      from: { value: [{ address: 'sender@example.com' }] },
      subject: 'テスト',
      text: '本文',
      date: new Date(),
      attachments: [
        {
          filename: '職務経歴書.docx',
          content: Buffer.from('docx content'),
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      ],
    })

    const results = await fetchUnreadEmails(config)
    expect(results[0].attachments).toHaveLength(1)
    expect(results[0].attachments[0].filename).toBe('職務経歴書.docx')
  })

  it('extracts DOCX with octet-stream contentType via filename fallback', async () => {
    mockSearch.mockResolvedValueOnce([{ parts: [{ which: '', body: 'raw' }] }])
    mockSimpleParser.mockResolvedValueOnce({
      messageId: '<id4>',
      from: { value: [{ address: 'sender@example.com' }] },
      subject: 'テスト',
      text: '本文',
      date: new Date(),
      attachments: [
        {
          filename: '経歴書.docx',
          content: Buffer.from('docx content'),
          contentType: 'application/octet-stream',
        },
      ],
    })

    const results = await fetchUnreadEmails(config)
    expect(results[0].attachments).toHaveLength(1)
    expect(results[0].attachments[0].filename).toBe('経歴書.docx')
  })

  it('extracts DOCX with application/zip contentType via filename fallback', async () => {
    mockSearch.mockResolvedValueOnce([{ parts: [{ which: '', body: 'raw' }] }])
    mockSimpleParser.mockResolvedValueOnce({
      messageId: '<id5>',
      from: { value: [{ address: 'sender@example.com' }] },
      subject: 'テスト',
      text: '本文',
      date: new Date(),
      attachments: [
        {
          filename: '経歴書.docx',
          content: Buffer.from('docx content'),
          contentType: 'application/zip',
        },
      ],
    })

    const results = await fetchUnreadEmails(config)
    expect(results[0].attachments).toHaveLength(1)
    expect(results[0].attachments[0].filename).toBe('経歴書.docx')
  })

  it('ignores unsupported attachment formats (e.g. xlsx)', async () => {
    mockSearch.mockResolvedValueOnce([{ parts: [{ which: '', body: 'raw' }] }])
    mockSimpleParser.mockResolvedValueOnce({
      messageId: '<id5>',
      from: { value: [{ address: 'sender@example.com' }] },
      subject: 'テスト',
      text: '本文',
      date: new Date(),
      attachments: [
        {
          filename: 'data.xlsx',
          content: Buffer.from('xlsx'),
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    })

    const results = await fetchUnreadEmails(config)
    expect(results[0].attachments).toEqual([])
  })
})
```

- [ ] **Step 2: テストを実行して FAIL することを確認**

```bash
npx jest src/lib/__tests__/email-fetcher.test.ts --no-coverage
```

Expected: FAIL（`attachments` フィールドが存在しない）

- [ ] **Step 3: email-fetcher.ts を更新**

`src/lib/email-fetcher.ts` を以下に置き換える：

```typescript
// src/lib/email-fetcher.ts
import imaps from 'imap-simple'
import { simpleParser } from 'mailparser'

const ACCEPTED_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const OCTET_STREAM_TYPES = new Set([
  'application/octet-stream',
  'application/zip',
])

type FetchedAttachment = {
  filename: string
  content: Buffer
  contentType: string
}

export type FetchedEmail = {
  messageId: string | null
  from: string
  fromEmail: string
  subject: string
  bodyText: string
  receivedAt: Date
  attachments: FetchedAttachment[]
}

export type ImapConfig = {
  imapHost: string
  imapPort: number
  imapUser: string
  imapPass: string
}

function extractAttachments(parsed: Awaited<ReturnType<typeof simpleParser>>): FetchedAttachment[] {
  if (!parsed.attachments) return []

  return parsed.attachments
    .filter((att) => {
      const ct = att.contentType ?? ''
      const fn = att.filename ?? ''
      if (ACCEPTED_CONTENT_TYPES.has(ct)) return true
      if (OCTET_STREAM_TYPES.has(ct) && fn.toLowerCase().endsWith('.docx')) return true
      return false
    })
    .map((att) => ({
      filename: att.filename ?? 'attachment',
      content: att.content as Buffer,
      contentType: att.contentType ?? '',
    }))
}

export async function fetchUnreadEmails(config: ImapConfig): Promise<FetchedEmail[]> {
  const connection = await imaps.connect({
    imap: {
      host: config.imapHost,
      port: config.imapPort,
      user: config.imapUser,
      password: config.imapPass,
      tls: config.imapPort === 993,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
    },
  })

  await connection.openBox('INBOX')

  const since = new Date()
  since.setDate(since.getDate() - 2)
  since.setHours(0, 0, 0, 0)

  const searchCriteria = ['UNSEEN', ['SINCE', since]]
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
      messageId:   parsed.messageId ?? null,
      from:        from?.name ?? from?.address ?? '',
      fromEmail:   from?.address ?? '',
      subject:     parsed.subject ?? '(件名なし)',
      bodyText:    parsed.text ?? '',
      receivedAt:  parsed.date ?? new Date(),
      attachments: extractAttachments(parsed),
    })
  }

  return results
}
```

- [ ] **Step 4: テストを実行して PASS することを確認**

```bash
npx jest src/lib/__tests__/email-fetcher.test.ts --no-coverage
```

Expected: 全テスト PASS

- [ ] **Step 5: email-ingestion.test.ts の mockFetchedEmail を修正してから全テストを確認**

`src/lib/__tests__/email-ingestion.test.ts` の `mockFetchedEmail` に `attachments: []` を追加する（TypeScript 型エラー解消のため）：

```typescript
const mockFetchedEmail = {
  messageId: '<test@example.com>',
  from: 'Sender Name',
  fromEmail: 'sender@example.com',
  subject: 'Java案件のご紹介',
  bodyText: 'Java Springの案件です',
  receivedAt: new Date('2026-03-20T10:00:00Z'),
  attachments: [],  // ← 追加
}
```

その後、全テストを実行：

```bash
npx jest --no-coverage
```

Expected: 全テスト PASS

> **注意**: Task 4 で `email-ingestion.ts` に `file-storage` への依存が追加されるため、Task 4 Step 1 の `jest.mock('../file-storage', ...)` も必要。ここでは型エラーが出なければ問題ない（`file-storage.ts` はまだ存在しない時点でインポートを持たない）。

- [ ] **Step 6: コミット**

```bash
git add src/lib/email-fetcher.ts src/lib/__tests__/email-fetcher.test.ts src/lib/__tests__/email-ingestion.test.ts
git commit -m "feat: email-fetcher に PDF/DOCX 添付ファイル抽出を追加"
```

---

## Task 4: email-ingestion.ts に添付ファイル保存ロジックを追加

**Files:**
- Modify: `src/lib/email-ingestion.ts`
- Modify: `src/lib/__tests__/email-ingestion.test.ts`

- [ ] **Step 1: テストケースを追加**

`src/lib/__tests__/email-ingestion.test.ts` に以下を追加する。

まず既存のモック宣言に `mockTalentUpdate` と `file-storage` モックを追加：

```typescript
// 既存の mockTalentCreate の次の行に追加
const mockTalentUpdate = jest.fn()

// 既存の prisma モックの talent プロパティを変更
talent: {
  create: (...a: unknown[]) => mockTalentCreate(...a),
  update: (...a: unknown[]) => mockTalentUpdate(...a),  // ← 追加
},
```

ファイルストレージのモックを追加（既存の crypto モックの後に追加）：

```typescript
const mockStorageSave = jest.fn()
const mockStorageDelete = jest.fn()
const mockStorageGetUrl = jest.fn()

jest.mock('../file-storage', () => ({
  getFileStorage: () => ({
    save: (...a: unknown[]) => mockStorageSave(...a),
    delete: (...a: unknown[]) => mockStorageDelete(...a),
    getUrl: (...a: unknown[]) => mockStorageGetUrl(...a),
  }),
  _resetFileStorageForTest: jest.fn(),
}))
```

`mockFetchedEmail` に `attachments: []` を追加（Step 5で対応済みの場合はスキップ）。

次に `describe('runIngestion')` ブロックの末尾に以下のテストを追加：

```typescript
  describe('resume attachment', () => {
    const pdfAttachment = {
      filename: '経歴書.pdf',
      content: Buffer.from('pdf content'),
      contentType: 'application/pdf',
    }

    const mockFetchedEmailWithPdf = {
      ...mockFetchedEmail,
      attachments: [pdfAttachment],
    }

    it('saves PDF attachment and sets resumeKey on Talent', async () => {
      mockEmailSourceFindMany.mockResolvedValueOnce([mockSource])
      mockFetchUnreadEmails.mockResolvedValueOnce([mockFetchedEmailWithPdf])
      mockEmailFindUnique.mockResolvedValueOnce(null)
      mockEmailCreate.mockResolvedValueOnce({ id: 'email1' })
      mockEmailUpdate.mockResolvedValue({})
      mockParseEmailBody.mockResolvedValueOnce({
        type: 'TALENT', confidence: 85, extractedName: '山田太郎', skills: ['React'],
        talent: { name: '山田太郎', experience: 5, desiredRate: 60, location: '東京都', workStyle: 'HYBRID' },
      })
      mockUserFindFirst.mockResolvedValueOnce(mockAdminUser)
      mockTalentCreate.mockResolvedValueOnce({ id: 'talent1' })
      mockStorageSave.mockResolvedValueOnce(undefined)
      mockTalentUpdate.mockResolvedValueOnce({})
      mockActivityCreate.mockResolvedValue({})

      const result = await runIngestion()

      expect(result.parsed).toBe(1)
      expect(mockStorageSave).toHaveBeenCalledTimes(1)
      const savedKey = mockStorageSave.mock.calls[0][0] as string
      expect(savedKey).toMatch(/^resumes\/talent1-\d+\.pdf$/)
      expect(mockTalentUpdate).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'talent1' },
        data: expect.objectContaining({ resumeKey: savedKey, resumeFilename: '経歴書.pdf' }),
      }))
    })

    it('saves DOCX attachment (application/zip) and sets resumeKey on Talent', async () => {
      const docxAttachment = {
        filename: '職務経歴書.docx',
        content: Buffer.from('docx content'),
        contentType: 'application/zip',
      }
      mockEmailSourceFindMany.mockResolvedValueOnce([mockSource])
      mockFetchUnreadEmails.mockResolvedValueOnce([{ ...mockFetchedEmail, attachments: [docxAttachment] }])
      mockEmailFindUnique.mockResolvedValueOnce(null)
      mockEmailCreate.mockResolvedValueOnce({ id: 'email1' })
      mockEmailUpdate.mockResolvedValue({})
      mockParseEmailBody.mockResolvedValueOnce({
        type: 'TALENT', confidence: 85, extractedName: '田中花子', skills: ['Java'],
        talent: { name: '田中花子', experience: 3, desiredRate: 55, location: '大阪府', workStyle: 'REMOTE' },
      })
      mockUserFindFirst.mockResolvedValueOnce(mockAdminUser)
      mockTalentCreate.mockResolvedValueOnce({ id: 'talent2a' })
      mockStorageSave.mockResolvedValueOnce(undefined)
      mockTalentUpdate.mockResolvedValueOnce({})
      mockActivityCreate.mockResolvedValue({})

      await runIngestion()

      expect(mockStorageSave).toHaveBeenCalledTimes(1)
      const savedKey = mockStorageSave.mock.calls[0][0] as string
      expect(savedKey).toMatch(/^resumes\/talent2a-\d+\.docx$/)
    })

    it('saves DOCX attachment (octet-stream) and sets resumeKey on Talent', async () => {
      const docxAttachment = {
        filename: '職務経歴書.docx',
        content: Buffer.from('docx content'),
        contentType: 'application/octet-stream',
      }
      mockEmailSourceFindMany.mockResolvedValueOnce([mockSource])
      mockFetchUnreadEmails.mockResolvedValueOnce([{ ...mockFetchedEmail, attachments: [docxAttachment] }])
      mockEmailFindUnique.mockResolvedValueOnce(null)
      mockEmailCreate.mockResolvedValueOnce({ id: 'email1' })
      mockEmailUpdate.mockResolvedValue({})
      mockParseEmailBody.mockResolvedValueOnce({
        type: 'TALENT', confidence: 85, extractedName: '田中花子', skills: ['Java'],
        talent: { name: '田中花子', experience: 3, desiredRate: 55, location: '大阪府', workStyle: 'REMOTE' },
      })
      mockUserFindFirst.mockResolvedValueOnce(mockAdminUser)
      mockTalentCreate.mockResolvedValueOnce({ id: 'talent2' })
      mockStorageSave.mockResolvedValueOnce(undefined)
      mockTalentUpdate.mockResolvedValueOnce({})
      mockActivityCreate.mockResolvedValue({})

      await runIngestion()

      expect(mockStorageSave).toHaveBeenCalledTimes(1)
      const savedKey = mockStorageSave.mock.calls[0][0] as string
      expect(savedKey).toMatch(/^resumes\/talent2-\d+\.docx$/)
    })

    it('does not save when no attachment', async () => {
      mockEmailSourceFindMany.mockResolvedValueOnce([mockSource])
      mockFetchUnreadEmails.mockResolvedValueOnce([mockFetchedEmail]) // attachments: []
      mockEmailFindUnique.mockResolvedValueOnce(null)
      mockEmailCreate.mockResolvedValueOnce({ id: 'email1' })
      mockEmailUpdate.mockResolvedValue({})
      mockParseEmailBody.mockResolvedValueOnce({
        type: 'TALENT', confidence: 85, extractedName: '鈴木一郎', skills: ['Python'],
        talent: { name: '鈴木一郎', experience: 7, desiredRate: 70, location: '東京都', workStyle: 'ONSITE' },
      })
      mockUserFindFirst.mockResolvedValueOnce(mockAdminUser)
      mockTalentCreate.mockResolvedValueOnce({ id: 'talent3' })
      mockActivityCreate.mockResolvedValue({})

      const result = await runIngestion()

      expect(result.parsed).toBe(1)
      expect(mockStorageSave).not.toHaveBeenCalled()
      expect(mockTalentUpdate).not.toHaveBeenCalled()
    })

    it('skips file > 10MB and keeps Talent registered', async () => {
      const largeAttachment = {
        filename: '大きいファイル.pdf',
        content: Buffer.alloc(11 * 1024 * 1024), // 11MB
        contentType: 'application/pdf',
      }
      mockEmailSourceFindMany.mockResolvedValueOnce([mockSource])
      mockFetchUnreadEmails.mockResolvedValueOnce([{ ...mockFetchedEmail, attachments: [largeAttachment] }])
      mockEmailFindUnique.mockResolvedValueOnce(null)
      mockEmailCreate.mockResolvedValueOnce({ id: 'email1' })
      mockEmailUpdate.mockResolvedValue({})
      mockParseEmailBody.mockResolvedValueOnce({
        type: 'TALENT', confidence: 80, extractedName: '佐藤二郎', skills: ['Go'],
        talent: { name: '佐藤二郎', experience: 4, desiredRate: 65, location: '福岡県', workStyle: 'HYBRID' },
      })
      mockUserFindFirst.mockResolvedValueOnce(mockAdminUser)
      mockTalentCreate.mockResolvedValueOnce({ id: 'talent4' })
      mockActivityCreate.mockResolvedValue({})

      const result = await runIngestion()

      expect(result.parsed).toBe(1)
      expect(mockStorageSave).not.toHaveBeenCalled()
    })

    it('keeps Talent registered even if file storage throws', async () => {
      mockEmailSourceFindMany.mockResolvedValueOnce([mockSource])
      mockFetchUnreadEmails.mockResolvedValueOnce([mockFetchedEmailWithPdf])
      mockEmailFindUnique.mockResolvedValueOnce(null)
      mockEmailCreate.mockResolvedValueOnce({ id: 'email1' })
      mockEmailUpdate.mockResolvedValue({})
      mockParseEmailBody.mockResolvedValueOnce({
        type: 'TALENT', confidence: 85, extractedName: '高橋三郎', skills: ['Ruby'],
        talent: { name: '高橋三郎', experience: 6, desiredRate: 68, location: '名古屋市', workStyle: 'REMOTE' },
      })
      mockUserFindFirst.mockResolvedValueOnce(mockAdminUser)
      mockTalentCreate.mockResolvedValueOnce({ id: 'talent5' })
      mockStorageSave.mockRejectedValueOnce(new Error('Disk full'))
      mockActivityCreate.mockResolvedValue({})

      const result = await runIngestion()

      expect(result.parsed).toBe(1)  // Talent 登録は成功
      expect(result.errors).toBe(0)
    })

    it('deletes file if Talent DB update fails (orphan prevention)', async () => {
      mockEmailSourceFindMany.mockResolvedValueOnce([mockSource])
      mockFetchUnreadEmails.mockResolvedValueOnce([mockFetchedEmailWithPdf])
      mockEmailFindUnique.mockResolvedValueOnce(null)
      mockEmailCreate.mockResolvedValueOnce({ id: 'email1' })
      mockEmailUpdate.mockResolvedValue({})
      mockParseEmailBody.mockResolvedValueOnce({
        type: 'TALENT', confidence: 85, extractedName: '中村四郎', skills: ['C++'],
        talent: { name: '中村四郎', experience: 8, desiredRate: 75, location: '横浜市', workStyle: 'ONSITE' },
      })
      mockUserFindFirst.mockResolvedValueOnce(mockAdminUser)
      mockTalentCreate.mockResolvedValueOnce({ id: 'talent6' })
      mockStorageSave.mockResolvedValueOnce(undefined)
      mockTalentUpdate.mockRejectedValueOnce(new Error('DB error'))
      mockStorageDelete.mockResolvedValueOnce(undefined)
      mockActivityCreate.mockResolvedValue({})

      const result = await runIngestion()

      expect(result.parsed).toBe(1)
      expect(mockStorageDelete).toHaveBeenCalledTimes(1)
    })

    it('does not save attachment for CASE emails', async () => {
      mockEmailSourceFindMany.mockResolvedValueOnce([mockSource])
      mockFetchUnreadEmails.mockResolvedValueOnce([mockFetchedEmailWithPdf])
      mockEmailFindUnique.mockResolvedValueOnce(null)
      mockEmailCreate.mockResolvedValueOnce({ id: 'email1' })
      mockEmailUpdate.mockResolvedValue({})
      mockParseEmailBody.mockResolvedValueOnce({
        type: 'CASE', confidence: 90, extractedName: 'Java案件', skills: ['Java'],
        case: { title: 'Java案件', client: '顧客A', unitPrice: 70, startDate: '2026-04-01T00:00:00Z', workStyle: 'REMOTE' },
      })
      mockUserFindFirst.mockResolvedValueOnce(mockAdminUser)
      mockCaseCreate.mockResolvedValueOnce({ id: 'case1' })
      mockActivityCreate.mockResolvedValue({})

      await runIngestion()

      expect(mockStorageSave).not.toHaveBeenCalled()
    })
  })
```

- [ ] **Step 2: テストを実行して FAIL することを確認**

```bash
npx jest src/lib/__tests__/email-ingestion.test.ts --no-coverage
```

Expected: 新しく追加したテストケースが FAIL

- [ ] **Step 3: email-ingestion.ts に添付保存ロジックを追加**

`src/lib/email-ingestion.ts` を**ファイル全体**以下の内容で置き換える（既存内容を残さず全置換）：

```typescript
// src/lib/email-ingestion.ts
import * as path from 'path'
import { prisma } from '@/lib/prisma'
import { fetchUnreadEmails } from './email-fetcher'
import { parseEmailBody } from './email-parser'
import { decrypt } from './crypto'
import { getFileStorage } from './file-storage'
import type { FetchedEmail } from './email-fetcher'

const ENCRYPTION_KEY = process.env.EMAIL_SOURCE_ENCRYPTION_KEY ?? ''
const MAX_RESUME_SIZE = 10 * 1024 * 1024 // 10MB

export type IngestionResult = {
  fetched: number
  parsed: number
  errors: number
  unknown: number
}

async function saveResume(
  talentId: string,
  attachment: FetchedEmail['attachments'][number],
): Promise<{ key: string; filename: string } | null> {
  if (attachment.content.length > MAX_RESUME_SIZE) {
    console.warn(`[ingestion] Attachment too large (${attachment.content.length} bytes), skipping: ${attachment.filename}`)
    return null
  }

  const ext = path.extname(attachment.filename).toLowerCase() || '.pdf'
  const key = `resumes/${talentId}-${Date.now()}${ext}`

  const storage = getFileStorage()
  await storage.save(key, attachment.content)
  return { key, filename: attachment.filename }
}

const RESUME_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
  'application/zip',
])

function findFirstResume(attachments: FetchedEmail['attachments']): FetchedEmail['attachments'][number] | null {
  // email-fetcher 側でフィルタ済みだが、防御的に PDF/DOCX のみ採用する
  return attachments.find((att) => {
    const ct = att.contentType
    const fn = att.filename.toLowerCase()
    if (ct === 'application/pdf') return true
    if (ct === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return true
    if ((ct === 'application/octet-stream' || ct === 'application/zip') && fn.endsWith('.docx')) return true
    return false
  }) ?? null
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
      } else {
        const dayStart = new Date(fetched.receivedAt)
        dayStart.setUTCHours(0, 0, 0, 0)
        const dayEnd = new Date(dayStart)
        dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

        const existing = await prisma.email.findFirst({
          where: {
            fromEmail: fetched.fromEmail,
            subject:   fetched.subject,
            receivedAt: { gte: dayStart, lt: dayEnd },
          },
        })
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

          // 添付ファイル（経歴書）の保存
          const resumeAttachment = findFirstResume(fetched.attachments)
          if (resumeAttachment) {
            try {
              const saved = await saveResume(createdTalent.id, resumeAttachment)
              if (saved) {
                try {
                  await prisma.talent.update({
                    where: { id: createdTalent.id },
                    data: { resumeKey: saved.key, resumeFilename: saved.filename },
                  })
                } catch (updateErr) {
                  console.error(`[ingestion] Failed to update Talent resumeKey, cleaning up file:`, updateErr)
                  const storage = getFileStorage()
                  storage.delete(saved.key).catch((e) =>
                    console.error(`[ingestion] Failed to delete orphan file ${saved.key}:`, e)
                  )
                }
              }
            } catch (saveErr) {
              console.error(`[ingestion] Failed to save resume for talent ${createdTalent.id}:`, saveErr)
            }
          }

          await prisma.activityLog.create({
            data: { type: 'TALENT_CREATED', description: `人材登録: ${parsed.talent.name}`, emailId: emailRecord.id, talentId: createdTalent.id },
          })
          result.parsed++

        } else {
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

- [ ] **Step 4: テストを実行して PASS することを確認**

```bash
npx jest src/lib/__tests__/email-ingestion.test.ts --no-coverage
```

Expected: 全テスト PASS

- [ ] **Step 5: 全テストが通ることを確認**

```bash
npx jest --no-coverage
```

Expected: 全テスト PASS

- [ ] **Step 6: コミット**

```bash
git add src/lib/email-ingestion.ts src/lib/__tests__/email-ingestion.test.ts
git commit -m "feat: email-ingestion に経歴書添付ファイル保存ロジックを追加"
```
