/** @jest-environment node */
import { GET, PATCH, DELETE } from '../[id]/route'

const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
const mockDelete = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    email: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update:     (...args: unknown[]) => mockUpdate(...args),
      delete:     (...args: unknown[]) => mockDelete(...args),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

const adminSession = { user: { id: 'admin-id', role: 'ADMIN' } }
const staffSession = { user: { id: 'staff-id', role: 'STAFF' } }
const params = Promise.resolve({ id: 'email-1' })

beforeEach(() => jest.clearAllMocks())

describe('GET /api/emails/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/emails/e1'), { params })).status).toBe(401)
  })

  it('returns 404 when not found', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/emails/e1'), { params })).status).toBe(404)
  })

  it('STAFF can read email detail', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'email-1' })
    expect((await GET(new Request('http://localhost/api/emails/email-1'), { params })).status).toBe(200)
  })

  it('ADMIN can read email detail', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'email-1' })
    expect((await GET(new Request('http://localhost/api/emails/email-1'), { params })).status).toBe(200)
  })
})

describe('PATCH /api/emails/[id]', () => {
  it('returns 403 when STAFF patches email', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    const req = new Request('http://localhost/api/emails/email-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PARSED' }),
    })
    expect((await PATCH(req, { params })).status).toBe(403)
  })

  it('returns 422 when PATCH body is invalid', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'email-1' })
    const req = new Request('http://localhost/api/emails/email-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'INVALID' }),
    })
    expect((await PATCH(req, { params })).status).toBe(422)
  })

  it('ADMIN patches email status', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'email-1' })
    mockUpdate.mockResolvedValueOnce({ id: 'email-1', status: 'PARSED' })
    const req = new Request('http://localhost/api/emails/email-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PARSED' }),
    })
    expect((await PATCH(req, { params })).status).toBe(200)
  })
})

describe('DELETE /api/emails/[id]', () => {
  it('returns 403 when STAFF deletes', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    expect((await DELETE(new Request('http://localhost/api/emails/e1'), { params })).status).toBe(403)
  })

  it('returns 404 when not found', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce(null)
    expect((await DELETE(new Request('http://localhost/api/emails/e1'), { params })).status).toBe(404)
  })

  it('ADMIN deletes an email', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'email-1' })
    mockDelete.mockResolvedValueOnce({ id: 'email-1' })
    expect((await DELETE(new Request('http://localhost/api/emails/email-1'), { params })).status).toBe(200)
  })
})
