/** @jest-environment node */
import { evaluateMatching, type MatchingEvaluation } from '../matching-generator'
import type { Case, Talent } from '@prisma/client'

const mockCreate = jest.fn()
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: (...args: unknown[]) => mockCreate(...args) },
  })),
}))

function makeToolUseResponse(input: MatchingEvaluation) {
  return {
    content: [{ type: 'tool_use', name: 'evaluate_matching', input }],
  }
}

const mockCase: Case = {
  id: 'case-1',
  title: 'Javaエンジニア募集',
  client: '株式会社テスト',
  clientEmail: null,
  skills: ['Java', 'Spring Boot'],
  unitPrice: 80,
  startDate: new Date('2026-04-01'),
  workStyle: 'REMOTE',
  status: 'OPEN',
  assignedUserId: 'user-1',
  sourceEmailId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockTalent: Talent = {
  id: 'talent-1',
  name: '田中 浩二',
  skills: ['Java', 'Spring Boot', 'AWS'],
  experience: 8,
  desiredRate: 75,
  location: '東京都',
  workStyle: 'REMOTE',
  status: 'AVAILABLE',
  availableFrom: new Date('2026-04-01'),
  agencyEmail: 'agency@example.com',
  assignedUserId: 'user-1',
  sourceEmailId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockEvaluation: MatchingEvaluation = {
  score: 88,
  skillMatchRate: 90,
  unitPriceOk: true,
  timingOk: true,
  locationOk: true,
  costPrice: 75,
  sellPrice: 80,
  grossProfitRate: 0.0625,
  grossProfitOk: false,
  reason: 'Javaスキルが一致しており、勤務形態・時期も適合しています。',
  isAutoSend: false,
}

beforeEach(() => jest.clearAllMocks())

describe('evaluateMatching', () => {
  it('returns evaluation with all required fields', async () => {
    mockCreate.mockResolvedValueOnce(makeToolUseResponse(mockEvaluation))
    const result = await evaluateMatching(mockCase, mockTalent)
    expect(result.score).toBe(88)
    expect(result.skillMatchRate).toBe(90)
    expect(result.unitPriceOk).toBe(true)
    expect(result.reason).toBe('Javaスキルが一致しており、勤務形態・時期も適合しています。')
  })

  it('passes case and talent info to Claude prompt', async () => {
    mockCreate.mockResolvedValueOnce(makeToolUseResponse(mockEvaluation))
    await evaluateMatching(mockCase, mockTalent)
    const calledContent = mockCreate.mock.calls[0][0].messages[0].content as string
    expect(calledContent).toContain('Javaエンジニア募集')
    expect(calledContent).toContain('田中 浩二')
    expect(calledContent).toContain('80万円')
    expect(calledContent).toContain('75万円')
  })

  it('retries once on API failure and throws after second failure', async () => {
    mockCreate
      .mockRejectedValueOnce(new Error('API Error'))
      .mockRejectedValueOnce(new Error('API Error'))
    await expect(evaluateMatching(mockCase, mockTalent)).rejects.toThrow('API Error')
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it('retries and succeeds on second attempt', async () => {
    mockCreate
      .mockRejectedValueOnce(new Error('API Error'))
      .mockResolvedValueOnce(makeToolUseResponse(mockEvaluation))
    const result = await evaluateMatching(mockCase, mockTalent)
    expect(result.score).toBe(88)
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })
})
