/** @jest-environment node */
import { POST } from '../route'

const mockFindManyCases = jest.fn()
const mockFindManyTalents = jest.fn()
const mockFindManyMatchings = jest.fn()
const mockCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    case:     { findMany: (...args: unknown[]) => mockFindManyCases(...args) },
    talent:   { findMany: (...args: unknown[]) => mockFindManyTalents(...args) },
    matching: {
      findMany: (...args: unknown[]) => mockFindManyMatchings(...args),
      create:   (...args: unknown[]) => mockCreate(...args),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

const mockEvaluate = jest.fn()
jest.mock('@/lib/matching-generator', () => ({
  evaluateMatching: (...args: unknown[]) => mockEvaluate(...args),
}))

const adminSession = { user: { id: 'admin-id', role: 'ADMIN' } }

const caseA = { id: 'case-1', title: 'Case A', client: 'Client A', skills: ['Java'], unitPrice: 80, startDate: new Date(), workStyle: 'REMOTE', status: 'OPEN', assignedUserId: 'user-1', sourceEmailId: null, clientEmail: null, createdAt: new Date(), updatedAt: new Date() }
const talentA = { id: 'talent-1', name: '田中', skills: ['Java'], experience: 5, desiredRate: 75, location: '東京', workStyle: 'REMOTE', status: 'AVAILABLE', availableFrom: null, agencyEmail: null, assignedUserId: 'user-1', sourceEmailId: null, createdAt: new Date(), updatedAt: new Date() }

const defaultEval = { score: 80, skillMatchRate: 90, unitPriceOk: true, timingOk: true, locationOk: true, costPrice: 75, sellPrice: 80, grossProfitRate: 0.0625, grossProfitOk: false, reason: '適合', isAutoSend: false }

beforeEach(() => jest.clearAllMocks())

describe('POST /api/matchings/generate', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const res = await POST(new Request('http://localhost/api/matchings/generate', { method: 'POST' }))
    expect(res.status).toBe(401)
  })

  it('creates a matching for unmatched case×talent combination', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindManyCases.mockResolvedValueOnce([caseA])
    mockFindManyTalents.mockResolvedValueOnce([talentA])
    mockFindManyMatchings.mockResolvedValueOnce([])  // 既存マッチングなし
    mockEvaluate.mockResolvedValueOnce(defaultEval)
    mockCreate.mockResolvedValueOnce({ id: 'm1' })

    const res = await POST(new Request('http://localhost/api/matchings/generate', { method: 'POST' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.generated).toBe(1)
    expect(body.data.skipped).toBe(0)
  })

  it('skips existing case×talent combinations', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindManyCases.mockResolvedValueOnce([caseA])
    mockFindManyTalents.mockResolvedValueOnce([talentA])
    mockFindManyMatchings.mockResolvedValueOnce([{ caseId: 'case-1', talentId: 'talent-1' }])

    const res = await POST(new Request('http://localhost/api/matchings/generate', { method: 'POST' }))
    const body = await res.json()
    expect(body.data.generated).toBe(0)
    expect(body.data.skipped).toBe(1)
    expect(mockEvaluate).not.toHaveBeenCalled()
  })

  it('sets status PENDING_AUTO when isAutoSend is true', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindManyCases.mockResolvedValueOnce([caseA])
    mockFindManyTalents.mockResolvedValueOnce([talentA])
    mockFindManyMatchings.mockResolvedValueOnce([])
    mockEvaluate.mockResolvedValueOnce({ ...defaultEval, isAutoSend: true })
    mockCreate.mockResolvedValueOnce({ id: 'm1' })

    await POST(new Request('http://localhost/api/matchings/generate', { method: 'POST' }))
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING_AUTO' }) })
    )
  })

  it('sets status UNPROPOSED when isAutoSend is false', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindManyCases.mockResolvedValueOnce([caseA])
    mockFindManyTalents.mockResolvedValueOnce([talentA])
    mockFindManyMatchings.mockResolvedValueOnce([])
    mockEvaluate.mockResolvedValueOnce({ ...defaultEval, isAutoSend: false })
    mockCreate.mockResolvedValueOnce({ id: 'm1' })

    await POST(new Request('http://localhost/api/matchings/generate', { method: 'POST' }))
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'UNPROPOSED' }) })
    )
  })

  it('returns 200 with generated=0 when no cases or talents', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindManyCases.mockResolvedValueOnce([])
    mockFindManyTalents.mockResolvedValueOnce([])
    mockFindManyMatchings.mockResolvedValueOnce([])

    const res = await POST(new Request('http://localhost/api/matchings/generate', { method: 'POST' }))
    const body = await res.json()
    expect(body.data.generated).toBe(0)
    expect(body.data.skipped).toBe(0)
  })
})
