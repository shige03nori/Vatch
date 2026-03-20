/** @jest-environment node */
import { GET, POST } from '../route'

const mockFindMany = jest.fn()
const mockCount = jest.fn()
const mockCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    proposal: {
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

describe('GET /api/proposals', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/proposals'))).status).toBe(401)
  })

  it('ADMIN gets all proposals with pagination', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindMany.mockResolvedValueOnce([{ id: 'p1' }])
    mockCount.mockResolvedValueOnce(1)
    const res = await GET(new Request('http://localhost/api/proposals'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.meta).toEqual({ total: 1, page: 1, limit: 20 })
  })

  it('STAFF filter uses matching.case.assignedUserId', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindMany.mockResolvedValueOnce([])
    mockCount.mockResolvedValueOnce(0)
    await GET(new Request('http://localhost/api/proposals'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ matching: { case: { assignedUserId: 'staff-id' } } })
      })
    )
  })
})

describe('POST /api/proposals', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await POST(new Request('http://localhost/api/proposals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    }))).status).toBe(401)
  })

  it('returns 422 on invalid body', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    expect((await POST(new Request('http://localhost/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchingId: 'not-a-cuid' }),
    }))).status).toBe(422)
  })

  it('creates a proposal', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockCreate.mockResolvedValueOnce({ id: 'p1' })
    const req = new Request('http://localhost/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchingId: 'clh5u5vw00000356ng7nc4l12',
        to: 'client@example.com',
        subject: 'Test Proposal',
        bodyText: 'Dear client...',
        costPrice: 600000,
        sellPrice: 800000,
        grossProfitRate: 25.0,
      }),
    })
    expect((await POST(req)).status).toBe(201)
  })

  it('creates a proposal with status SENT', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockCreate.mockResolvedValueOnce({ id: 'p2', status: 'SENT' })
    const req = new Request('http://localhost/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchingId:      'clh5u5vw00000356ng7nc4l12',
        to:              'client@example.com',
        subject:         'Test Proposal',
        bodyText:        'Dear client...',
        status:          'SENT',
        costPrice:       60,
        sellPrice:       80,
        grossProfitRate: 0.25,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) })
    )
  })
})
