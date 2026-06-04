/** @jest-environment node */
import { GET, POST } from '../route'
import { DELETE } from '../[caseId]/route'

const mockFavCreate     = jest.fn()
const mockFavDeleteMany = jest.fn()
const mockFavFindMany   = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    favorite: {
      create:     (...a: unknown[]) => mockFavCreate(...a),
      deleteMany: (...a: unknown[]) => mockFavDeleteMany(...a),
      findMany:   (...a: unknown[]) => mockFavFindMany(...a),
    },
  },
}))

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
const mockAuth = auth as jest.Mock
const properSession = { user: { id: 'u1', role: 'PROPER' } }
beforeEach(() => jest.clearAllMocks())

describe('GET /api/favorites', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost/api/favorites'))
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-PROPER user', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'u1', role: 'ADMIN' } })
    expect((await GET(new Request('http://localhost/api/favorites'))).status).toBe(403)
  })

  it('returns favorites list', async () => {
    mockAuth.mockResolvedValueOnce(properSession)
    mockFavFindMany.mockResolvedValueOnce([{ id: 'f1', caseId: 'c1', case: { id: 'c1', title: 'Test' } }])
    const res = await GET(new Request('http://localhost/api/favorites'))
    expect(res.status).toBe(200)
  })
})

describe('POST /api/favorites', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const res = await POST(new Request('http://localhost/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: 'clxxxxxx0000000000000000000' }) }))
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-PROPER user', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'u1', role: 'ADMIN' } })
    expect((await POST(new Request('http://localhost/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: 'clxxxxxx0000000000000000000' }) }))).status).toBe(403)
  })

  it('returns 422 on invalid caseId', async () => {
    mockAuth.mockResolvedValueOnce(properSession)
    const res = await POST(new Request('http://localhost/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: 'not-a-cuid' }) }))
    expect(res.status).toBe(422)
  })

  it('creates favorite', async () => {
    mockAuth.mockResolvedValueOnce(properSession)
    mockFavCreate.mockResolvedValueOnce({ id: 'f1', userId: 'u1', caseId: 'clxxxxxx0000000000000000000' })
    const res = await POST(new Request('http://localhost/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: 'clxxxxxx0000000000000000000' }) }))
    expect(res.status).toBe(201)
  })
})

describe('DELETE /api/favorites/[caseId]', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const res = await DELETE(new Request('http://localhost/api/favorites/c1'), { params: Promise.resolve({ caseId: 'c1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-PROPER user', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'u1', role: 'ADMIN' } })
    expect((await DELETE(new Request('http://localhost/api/favorites/c1'), { params: Promise.resolve({ caseId: 'c1' }) })).status).toBe(403)
  })

  it('deletes favorite', async () => {
    mockAuth.mockResolvedValueOnce(properSession)
    mockFavDeleteMany.mockResolvedValueOnce({ count: 1 })
    const res = await DELETE(new Request('http://localhost/api/favorites/c1'), { params: Promise.resolve({ caseId: 'c1' }) })
    expect(res.status).toBe(200)
  })
})
