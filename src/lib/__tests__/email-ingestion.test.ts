/** @jest-environment node */
import { runIngestion, type IngestionResult } from '../email-ingestion'

// Prismaモック
const mockEmailCreate = jest.fn()
const mockEmailUpdate = jest.fn()
const mockEmailFindUnique = jest.fn()
const mockEmailFindFirst = jest.fn()
const mockCaseCreate = jest.fn()
const mockTalentCreate = jest.fn()
const mockTalentUpdate = jest.fn()
const mockUserFindFirst = jest.fn()
const mockActivityCreate = jest.fn()
const mockEmailSourceFindMany = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    email:       { create: (...a: unknown[]) => mockEmailCreate(...a), update: (...a: unknown[]) => mockEmailUpdate(...a), findUnique: (...a: unknown[]) => mockEmailFindUnique(...a), findFirst: (...a: unknown[]) => mockEmailFindFirst(...a) },
    case:        { create: (...a: unknown[]) => mockCaseCreate(...a) },
    talent:      { create: (...a: unknown[]) => mockTalentCreate(...a), update: (...a: unknown[]) => mockTalentUpdate(...a) },
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
  attachments: [],  // ← 追加
}

const mockAdminUser = { id: 'admin1', role: 'ADMIN' }

beforeEach(() => jest.clearAllMocks())

describe('runIngestion', () => {
  it('fetches emails from active sources and creates CASE record', async () => {
    mockEmailSourceFindMany.mockResolvedValueOnce([mockSource])
    mockFetchUnreadEmails.mockResolvedValueOnce([mockFetchedEmail])
    mockEmailFindUnique.mockResolvedValueOnce(null) // 重複なし
    mockEmailCreate.mockResolvedValueOnce({ id: 'email1' })
    mockEmailUpdate.mockResolvedValue({})
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
    // 1回目: status=PARSING, 2回目: status=ERROR
    expect(mockEmailUpdate).toHaveBeenCalledTimes(2)
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
      mockFetchUnreadEmails.mockResolvedValueOnce([mockFetchedEmail])
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
        content: Buffer.alloc(11 * 1024 * 1024),
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

      expect(result.parsed).toBe(1)
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
})
