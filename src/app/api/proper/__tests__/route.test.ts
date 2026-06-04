/** @jest-environment node */
import { GET, POST } from '../route'

const mockFindMany = jest.fn()
const mockCount    = jest.fn()
const mockFindUnique = jest.fn()
const mockUserCreate   = jest.fn()
const mockTalentCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    talent: { findMany: (...a: unknown[]) => mockFindMany(...a), count: (...a: unknown[]) => mockCount(...a), create: (...a: unknown[]) => mockTalentCreate(...a) },
    user:   { findUnique: (...a: unknown[]) => mockFindUnique(...a), create: (...a: unknown[]) => mockUserCreate(...a) },
    $transaction: (fn: (tx: unknown) => unknown) => fn({
      user:   { create: (...a: unknown[]) => mockUserCreate(...a) },
      talent: { create: (...a: unknown[]) => mockTalentCreate(...a) },
    }),
  },
}))

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
const mockAuth = auth as jest.Mock

beforeEach(() => jest.clearAllMocks())

describe('GET /api/proper', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/proper'))).status).toBe(401)
  })

  it('returns 403 for PROPER role', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'u1', role: 'PROPER' } })
    expect((await GET(new Request('http://localhost/api/proper'))).status).toBe(403)
  })

  it('filters by talentType PROPER and optional office', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'admin', role: 'ADMIN' } })
    mockFindMany.mockResolvedValueOnce([{ id: 't1', talentType: 'PROPER', office: 'TOKYO' }])
    mockCount.mockResolvedValueOnce(1)
    const res = await GET(new Request('http://localhost/api/proper?office=TOKYO'))
    expect(res.status).toBe(200)
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ talentType: 'PROPER', office: 'TOKYO' }) })
    )
  })
})

describe('POST /api/proper', () => {
  const validBody = {
    name: '山田花子', email: 'hanako@example.com', skills: ['Java'],
    experience: 5, desiredRate: 60, location: '東京', workStyle: 'HYBRID', office: 'TOKYO',
  }

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await POST(new Request('http://localhost/api/proper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validBody) }))).status).toBe(401)
  })

  it('returns 422 on invalid body', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'admin', role: 'ADMIN' } })
    expect((await POST(new Request('http://localhost/api/proper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '' }) }))).status).toBe(422)
  })

  it('returns 409 when email already exists', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'admin', role: 'ADMIN' } })
    mockFindUnique.mockResolvedValueOnce({ id: 'existing' })
    const res = await POST(new Request('http://localhost/api/proper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validBody) }))
    expect(res.status).toBe(409)
  })

  it('creates user and talent, returns tempPassword', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'admin', role: 'ADMIN' } })
    mockFindUnique.mockResolvedValueOnce(null)
    mockUserCreate.mockResolvedValueOnce({ id: 'u2', email: 'hanako@example.com', role: 'PROPER' })
    mockTalentCreate.mockResolvedValueOnce({ id: 't1', name: '山田花子', talentType: 'PROPER' })
    const res = await POST(new Request('http://localhost/api/proper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validBody) }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.tempPassword).toBeDefined()
    expect(typeof body.data.tempPassword).toBe('string')
    expect(body.data.tempPassword.length).toBeGreaterThanOrEqual(8)
  })
})
