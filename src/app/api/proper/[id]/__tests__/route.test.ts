/** @jest-environment node */
import { GET, PATCH } from '../route'

const mockFindUnique = jest.fn()
const mockUpdate     = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: { talent: { findUnique: (...a: unknown[]) => mockFindUnique(...a), update: (...a: unknown[]) => mockUpdate(...a) } },
}))

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
const mockAuth = auth as jest.Mock

const adminSession = { user: { id: 'admin', role: 'ADMIN' } }
beforeEach(() => jest.clearAllMocks())

describe('GET /api/proper/[id]', () => {
  it('returns 404 when talent not found', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost/api/proper/t1'), { params: Promise.resolve({ id: 't1' }) })
    expect(res.status).toBe(404)
  })

  it('returns talent data', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 't1', talentType: 'PROPER', name: 'A', properUser: { email: 'a@a.com' } })
    const res = await GET(new Request('http://localhost/api/proper/t1'), { params: Promise.resolve({ id: 't1' }) })
    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/proper/[id]', () => {
  it('updates talent and returns updated record', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockUpdate.mockResolvedValueOnce({ id: 't1', name: '山田花子更新', talentType: 'PROPER' })
    const res = await PATCH(
      new Request('http://localhost/api/proper/t1', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '山田花子更新' }) }),
      { params: Promise.resolve({ id: 't1' }) }
    )
    expect(res.status).toBe(200)
  })
})
