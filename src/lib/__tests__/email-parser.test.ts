/** @jest-environment node */
import { parseEmailBody, type ParsedEmailResult } from '../email-parser'

const mockCreate = jest.fn()
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
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
