/** @jest-environment node */
import { GET, POST } from '../route'

const mockFindMany = jest.fn()
const mockCount = jest.fn()
const mockCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    matching: {
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

describe('GET /api/matchings', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/matchings'))).status).toBe(401)
  })

  it('ADMIN gets all matchings with pagination', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindMany.mockResolvedValueOnce([{ id: 'm1' }])
    mockCount.mockResolvedValueOnce(1)
    const res = await GET(new Request('http://localhost/api/matchings'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.meta).toEqual({ total: 1, page: 1, limit: 20 })
  })

  it('STAFF filter uses case.assignedUserId', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindMany.mockResolvedValueOnce([])
    mockCount.mockResolvedValueOnce(0)
    await GET(new Request('http://localhost/api/matchings'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ case: { assignedUserId: 'staff-id' } }) })
    )
  })

  it('includes case and talent in response', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindMany.mockResolvedValueOnce([{
      id: 'm1',
      case: { id: 'c1', title: 'Test Case', client: 'Client A', unitPrice: 80, workStyle: 'REMOTE', startDate: new Date('2026-04-01') },
      talent: { id: 't1', name: '田中', skills: ['Java'], desiredRate: 75, agencyEmail: null },
    }])
    mockCount.mockResolvedValueOnce(1)
    const res = await GET(new Request('http://localhost/api/matchings'))
    const body = await res.json()
    expect(body.data[0].case.title).toBe('Test Case')
    expect(body.data[0].talent.name).toBe('田中')
  })

  it('calls findMany with include for case and talent', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindMany.mockResolvedValueOnce([])
    mockCount.mockResolvedValueOnce(0)
    await GET(new Request('http://localhost/api/matchings'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          case: expect.any(Object),
          talent: expect.any(Object),
        }),
      })
    )
  })
})

describe('POST /api/matchings', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await POST(new Request('http://localhost/api/matchings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    }))).status).toBe(401)
  })

  it('returns 422 on missing required fields', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    const req = new Request('http://localhost/api/matchings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId: 'clh5u5vw00000356ng7nc4l12' }),
    })
    expect((await POST(req)).status).toBe(422)
  })

  it('ADMIN creates a matching', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockCreate.mockResolvedValueOnce({ id: 'm1' })
    const req = new Request('http://localhost/api/matchings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: 'clh5u5vw00000356ng7nc4l12',
        talentId: 'clh5u5vw00000356ng7nc4l13',
        score: 80,
        skillMatchRate: 90,
        unitPriceOk: true,
        timingOk: true,
        locationOk: true,
        costPrice: 600000,
        sellPrice: 800000,
        grossProfitRate: 25.0,
        grossProfitOk: true,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})
