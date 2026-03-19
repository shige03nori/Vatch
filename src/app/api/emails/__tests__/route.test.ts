/** @jest-environment node */
import { GET, POST } from '../route'

const mockFindMany = jest.fn()
const mockCount = jest.fn()
const mockCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    email: {
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

describe('GET /api/emails', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/emails'))).status).toBe(401)
  })

  it('STAFF can list emails', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindMany.mockResolvedValueOnce([{ id: 'e1' }])
    mockCount.mockResolvedValueOnce(1)
    const res = await GET(new Request('http://localhost/api/emails'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.meta).toEqual({ total: 1, page: 1, limit: 20 })
  })

  it('STAFF does NOT filter by user (sees all emails)', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindMany.mockResolvedValueOnce([])
    mockCount.mockResolvedValueOnce(0)
    await GET(new Request('http://localhost/api/emails'))
    // where clause should NOT contain assignedUserId
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ assignedUserId: expect.anything() }) })
    )
  })
})

describe('POST /api/emails', () => {
  it('returns 403 when STAFF creates email', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    expect((await POST(new Request('http://localhost/api/emails', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    }))).status).toBe(403)
  })

  it('returns 422 on invalid body for ADMIN', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    expect((await POST(new Request('http://localhost/api/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Sender' }),
    }))).status).toBe(422)
  })

  it('ADMIN creates an email', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockCreate.mockResolvedValueOnce({ id: 'e1' })
    const req = new Request('http://localhost/api/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receivedAt: '2026-03-19T00:00:00Z',
        from: 'Sender Name',
        fromEmail: 'sender@example.com',
        subject: 'Case Offer',
        bodyText: 'We have a case...',
        type: 'CASE',
      }),
    })
    expect((await POST(req)).status).toBe(201)
  })
})
