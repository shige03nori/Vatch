/** @jest-environment node */
import { GET, POST } from '../route'

const mockFindMany = jest.fn()
const mockCount = jest.fn()
const mockCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    talent: {
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

describe('GET /api/talents', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost/api/talents'))
    expect(res.status).toBe(401)
  })

  it('ADMIN gets all talents with pagination', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindMany.mockResolvedValueOnce([{ id: 't1', name: 'Taro' }])
    mockCount.mockResolvedValueOnce(1)
    const res = await GET(new Request('http://localhost/api/talents'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.meta).toEqual({ total: 1, page: 1, limit: 20 })
  })

  it('STAFF sees only own talents', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindMany.mockResolvedValueOnce([])
    mockCount.mockResolvedValueOnce(0)
    await GET(new Request('http://localhost/api/talents'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ assignedUserId: 'staff-id' }) })
    )
  })
})

describe('POST /api/talents', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const req = new Request('http://localhost/api/talents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect((await POST(req)).status).toBe(401)
  })

  it('returns 422 on invalid body', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    const req = new Request('http://localhost/api/talents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })
    expect((await POST(req)).status).toBe(422)
  })

  it('ADMIN creates a talent', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockCreate.mockResolvedValueOnce({ id: 't1' })
    const req = new Request('http://localhost/api/talents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Taro Yamada',
        skills: ['Go'],
        experience: 5,
        desiredRate: 700000,
        location: 'Tokyo',
        workStyle: 'REMOTE',
        assignedUserId: 'clh5u5vw00000356ng7nc4l12',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('STAFF assignedUserId is forced to own id', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockCreate.mockResolvedValueOnce({ id: 't1', assignedUserId: 'staff-id' })
    const req = new Request('http://localhost/api/talents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Taro Yamada',
        skills: ['Go'],
        experience: 5,
        desiredRate: 700000,
        location: 'Tokyo',
        workStyle: 'REMOTE',
        assignedUserId: 'clh5u5vw00000356ng7nc4l12',
      }),
    })
    await POST(req)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedUserId: 'staff-id' }) })
    )
  })
})
