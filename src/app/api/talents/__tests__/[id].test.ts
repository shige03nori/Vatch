/** @jest-environment node */
import { GET, PATCH, DELETE } from '../[id]/route'

const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
const mockDelete = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    talent: {
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
const params = Promise.resolve({ id: 'talent-1' })

beforeEach(() => jest.clearAllMocks())

describe('GET /api/talents/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/talents/talent-1'), { params })).status).toBe(401)
  })

  it('returns 404 when not found', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/talents/talent-1'), { params })).status).toBe(404)
  })

  it('returns 403 when STAFF accesses other talent', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'talent-1', assignedUserId: 'other-id' })
    expect((await GET(new Request('http://localhost/api/talents/talent-1'), { params })).status).toBe(403)
  })

  it('ADMIN gets any talent', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'talent-1', assignedUserId: 'staff-id' })
    expect((await GET(new Request('http://localhost/api/talents/talent-1'), { params })).status).toBe(200)
  })
})

describe('PATCH /api/talents/[id]', () => {
  it('returns 403 when STAFF patches another talent', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'talent-1', assignedUserId: 'other-id' })
    const req = new Request('http://localhost/api/talents/talent-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    })
    expect((await PATCH(req, { params })).status).toBe(403)
  })

  it('returns 422 when PATCH body is invalid', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'talent-1', assignedUserId: 'staff-id' })
    const req = new Request('http://localhost/api/talents/talent-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'INVALID_STATUS' }),
    })
    expect((await PATCH(req, { params })).status).toBe(422)
  })

  it('STAFF can patch own talent', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'talent-1', assignedUserId: 'staff-id' })
    mockUpdate.mockResolvedValueOnce({ id: 'talent-1', name: 'Updated' })
    const req = new Request('http://localhost/api/talents/talent-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    })
    expect((await PATCH(req, { params })).status).toBe(200)
  })

  it('ADMIN updates a talent', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'talent-1', assignedUserId: 'staff-id' })
    mockUpdate.mockResolvedValueOnce({ id: 'talent-1', name: 'Updated' })
    const req = new Request('http://localhost/api/talents/talent-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    })
    expect((await PATCH(req, { params })).status).toBe(200)
  })
})

describe('DELETE /api/talents/[id]', () => {
  it('returns 403 when STAFF deletes', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    expect((await DELETE(new Request('http://localhost/api/talents/talent-1'), { params })).status).toBe(403)
  })

  it('ADMIN deletes a talent', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'talent-1' })
    mockDelete.mockResolvedValueOnce({ id: 'talent-1' })
    expect((await DELETE(new Request('http://localhost/api/talents/talent-1'), { params })).status).toBe(200)
  })
})
