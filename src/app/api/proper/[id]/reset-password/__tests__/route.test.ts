/** @jest-environment node */
import { POST } from '../route'

const mockFindUnique = jest.fn()
const mockUpdate     = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    talent: { findUnique: (...a: unknown[]) => mockFindUnique(...a) },
    user:   { update:     (...a: unknown[]) => mockUpdate(...a)     },
  },
}))

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
const mockAuth = auth as jest.Mock

const adminSession = { user: { id: 'admin', role: 'ADMIN' } }
beforeEach(() => jest.clearAllMocks())

describe('POST /api/proper/[id]/reset-password', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const res = await POST(new Request('http://localhost/api/proper/t1/reset-password', { method: 'POST' }), { params: Promise.resolve({ id: 't1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 403 for PROPER role', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'u1', role: 'PROPER' } })
    const res = await POST(new Request('http://localhost/api/proper/t1/reset-password', { method: 'POST' }), { params: Promise.resolve({ id: 't1' }) })
    expect(res.status).toBe(403)
  })

  it('returns 404 when talent not found', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce(null)
    const res = await POST(new Request('http://localhost/api/proper/t1/reset-password', { method: 'POST' }), { params: Promise.resolve({ id: 't1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 404 when talent has no userId', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 't1', userId: null })
    const res = await POST(new Request('http://localhost/api/proper/t1/reset-password', { method: 'POST' }), { params: Promise.resolve({ id: 't1' }) })
    expect(res.status).toBe(404)
  })

  it('resets password and returns tempPassword', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 't1', userId: 'u1' })
    mockUpdate.mockResolvedValueOnce({ id: 'u1' })
    const res = await POST(new Request('http://localhost/api/proper/t1/reset-password', { method: 'POST' }), { params: Promise.resolve({ id: 't1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.tempPassword).toBeDefined()
    expect(typeof body.data.tempPassword).toBe('string')
    expect(body.data.tempPassword.length).toBeGreaterThanOrEqual(8)
  })
})
