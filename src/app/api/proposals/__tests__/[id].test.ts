/** @jest-environment node */
import { GET, PATCH, DELETE } from '../[id]/route'

const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
const mockDelete = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    proposal: {
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
const params = Promise.resolve({ id: 'proposal-1' })

beforeEach(() => jest.clearAllMocks())

describe('GET /api/proposals/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/proposals/p1'), { params })).status).toBe(401)
  })

  it('returns 404 when not found', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/proposals/p1'), { params })).status).toBe(404)
  })

  it('returns 403 when STAFF accesses other proposal', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'p1', matching: { case: { assignedUserId: 'other-id' } } })
    expect((await GET(new Request('http://localhost/api/proposals/p1'), { params })).status).toBe(403)
  })

  it('ADMIN gets any proposal', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'p1', matching: { case: { assignedUserId: 'staff-id' }, talent: {} } })
    expect((await GET(new Request('http://localhost/api/proposals/p1'), { params })).status).toBe(200)
  })
})

describe('PATCH /api/proposals/[id]', () => {
  it('returns 403 when STAFF patches other proposal', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'p1', matching: { case: { assignedUserId: 'other-id' } } })
    const req = new Request('http://localhost/api/proposals/p1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'SENT' }),
    })
    expect((await PATCH(req, { params })).status).toBe(403)
  })

  it('ADMIN updates a proposal', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'p1', matching: { case: { assignedUserId: 'staff-id' } } })
    mockUpdate.mockResolvedValueOnce({ id: 'p1', status: 'SENT' })
    const req = new Request('http://localhost/api/proposals/p1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'SENT' }),
    })
    expect((await PATCH(req, { params })).status).toBe(200)
  })
})

describe('DELETE /api/proposals/[id]', () => {
  it('returns 403 when STAFF deletes', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    expect((await DELETE(new Request('http://localhost/api/proposals/p1'), { params })).status).toBe(403)
  })

  it('ADMIN can delete DRAFT proposal', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'proposal-1', status: 'DRAFT' })
    mockDelete.mockResolvedValueOnce({ id: 'proposal-1' })
    expect((await DELETE(new Request('http://localhost/api/proposals/proposal-1'), { params })).status).toBe(200)
  })

  it('returns 422 when ADMIN deletes non-DRAFT proposal', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'proposal-1', status: 'SENT' })
    expect((await DELETE(new Request('http://localhost/api/proposals/proposal-1'), { params })).status).toBe(422)
  })
})
