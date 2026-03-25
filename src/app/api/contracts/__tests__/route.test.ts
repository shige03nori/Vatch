/** @jest-environment node */
import { GET, POST } from '../route'

const mockFindMany = jest.fn()
const mockCount = jest.fn()
const mockCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count:    (...args: unknown[]) => mockCount(...args),
      create:   (...args: unknown[]) => mockCreate(...args),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

const adminSession = { user: { id: 'admin-id', role: 'ADMIN' } }
const staffSession = { user: { id: 'staff-id', role: 'STAFF' } }

beforeEach(() => jest.clearAllMocks())

describe('GET /api/contracts', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/contracts'))).status).toBe(401)
  })

  it('ADMIN gets all contracts with pagination', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindMany.mockResolvedValueOnce([{ id: 'ct1' }])
    mockCount.mockResolvedValueOnce(1)
    const res = await GET(new Request('http://localhost/api/contracts'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.meta).toEqual({ total: 1, page: 1, limit: 20 })
  })

  it('STAFF filter uses Contract.assignedUserId', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindMany.mockResolvedValueOnce([])
    mockCount.mockResolvedValueOnce(0)
    await GET(new Request('http://localhost/api/contracts'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ assignedUserId: 'staff-id' }) })
    )
  })
})

describe('POST /api/contracts', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await POST(new Request('http://localhost/api/contracts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    }))).status).toBe(401)
  })

  it('returns 422 on invalid body', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    expect((await POST(new Request('http://localhost/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId: 'not-a-cuid' }),
    }))).status).toBe(422)
  })

  it('creates a contract', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockCreate.mockResolvedValueOnce({ id: 'ct1' })
    const req = new Request('http://localhost/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: 'clh5u5vw00000356ng7nc4l12',
        talentId: 'clh5u5vw00000356ng7nc4l13',
        proposalId: 'clh5u5vw00000356ng7nc4l14',
        startDate: '2026-04-01',
        unitPrice: 800000,
        costPrice: 600000,
        grossProfitRate: 25.0,
      }),
    })
    expect((await POST(req)).status).toBe(201)
  })

  it('assignedUserId はセッションユーザーIDで自動設定される', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockCreate.mockResolvedValueOnce({ id: 'c1' })

    const body = {
      caseId: 'claaaaaaaaaaaaaaaaaaaaaa1',
      talentId: 'claaaaaaaaaaaaaaaaaaaaaa2',
      proposalId: 'claaaaaaaaaaaaaaaaaaaaaa3',
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
