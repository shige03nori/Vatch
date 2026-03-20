/** @jest-environment node */
import { runIngestion, type IngestionResult } from '../email-ingestion'

// Prismaモック
const mockEmailCreate = jest.fn()
const mockEmailUpdate = jest.fn()
const mockEmailFindUnique = jest.fn()
const mockEmailFindFirst = jest.fn()
const mockCaseCreate = jest.fn()
const mockTalentCreate = jest.fn()
const mockUserFindFirst = jest.fn()
const mockActivityCreate = jest.fn()
const mockEmailSourceFindMany = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    email:       { create: (...a: unknown[]) => mockEmailCreate(...a), update: (...a: unknown[]) => mockEmailUpdate(...a), findUnique: (...a: unknown[]) => mockEmailFindUnique(...a), findFirst: (...a: unknown[]) => mockEmailFindFirst(...a) },
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
})
