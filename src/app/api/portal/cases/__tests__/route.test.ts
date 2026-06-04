/** @jest-environment node */
import { GET } from '../route'

const mockFindFirst = jest.fn()
const mockMatchFindMany = jest.fn()
const mockFavFindMany = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    talent:   { findFirst: (...a: unknown[]) => mockFindFirst(...a) },
    matching: { findMany:  (...a: unknown[]) => mockMatchFindMany(...a) },
    favorite: { findMany:  (...a: unknown[]) => mockFavFindMany(...a) },
  },
}))

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
const mockAuth = auth as jest.Mock
beforeEach(() => jest.clearAllMocks())

describe('GET /api/portal/cases', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/portal/cases'))).status).toBe(401)
  })

  it('returns 403 for non-PROPER users', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'u1', role: 'ADMIN' } })
    expect((await GET(new Request('http://localhost/api/portal/cases'))).status).toBe(403)
  })

  it('returns 404 when PROPER talent not found', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'u1', role: 'PROPER' } })
    mockFindFirst.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/portal/cases'))).status).toBe(404)
  })

  it('returns matching cases with isFavorited flag', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'u1', role: 'PROPER' } })
    mockFindFirst.mockResolvedValueOnce({ id: 't1', userId: 'u1' })
    mockMatchFindMany.mockResolvedValueOnce([{ id: 'm1', score: 85, caseId: 'c1', case: { id: 'c1', title: 'React案件' } }])
    mockFavFindMany.mockResolvedValueOnce([{ caseId: 'c1' }])
    const res = await GET(new Request('http://localhost/api/portal/cases'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data[0].isFavorited).toBe(true)
  })

  it('marks cases as not favorited when not in favorites', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'u1', role: 'PROPER' } })
    mockFindFirst.mockResolvedValueOnce({ id: 't1', userId: 'u1' })
    mockMatchFindMany.mockResolvedValueOnce([{ id: 'm1', score: 85, caseId: 'c1', case: { id: 'c1', title: 'React案件' } }])
    mockFavFindMany.mockResolvedValueOnce([])
    const res = await GET(new Request('http://localhost/api/portal/cases'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data[0].isFavorited).toBe(false)
  })
})
