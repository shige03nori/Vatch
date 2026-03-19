/** @jest-environment node */
import { GET, POST } from '../route'

const mockFindMany = jest.fn()
const mockCount = jest.fn()
const mockCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    case: {
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

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/cases', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost/api/cases'))
    expect(res.status).toBe(401)
  })

  it('ADMIN gets all cases with pagination', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindMany.mockResolvedValueOnce([{ id: 'c1', title: 'Test Case' }])
    mockCount.mockResolvedValueOnce(1)
    const res = await GET(new Request('http://localhost/api/cases'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.meta).toEqual({ total: 1, page: 1, limit: 20 })
  })

  it('STAFF sees only own cases', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindMany.mockResolvedValueOnce([])
    mockCount.mockResolvedValueOnce(0)
    await GET(new Request('http://localhost/api/cases'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ assignedUserId: 'staff-id' }) })
    )
  })
})

describe('POST /api/cases', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const req = new Request('http://localhost/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 422 on invalid body', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    const req = new Request('http://localhost/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(422)
  })

  it('ADMIN creates a case', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    const newCase = { id: 'c1', title: 'New Case', assignedUserId: 'admin-id' }
    mockCreate.mockResolvedValueOnce(newCase)
    const req = new Request('http://localhost/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Case',
        client: 'Client Co',
        skills: ['React'],
        unitPrice: 800000,
        startDate: '2026-04-01',
        workStyle: 'REMOTE',
        assignedUserId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBe('c1')
  })

  it('STAFF assignedUserId is forced to own id', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockCreate.mockResolvedValueOnce({ id: 'c1', assignedUserId: 'staff-id' })
    const req = new Request('http://localhost/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Case',
        client: 'Client Co',
        skills: ['React'],
        unitPrice: 800000,
        startDate: '2026-04-01',
        workStyle: 'REMOTE',
        assignedUserId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
      }),
    })
    await POST(req)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedUserId: 'staff-id' }) })
    )
  })
})
