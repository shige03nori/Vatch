/** @jest-environment node */
import { GET, PATCH, DELETE } from '../[id]/route'

const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
const mockDelete = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    case: {
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
const params = Promise.resolve({ id: 'case-1' })

beforeEach(() => jest.clearAllMocks())

describe('GET /api/cases/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost/api/cases/case-1'), { params })
    expect(res.status).toBe(401)
  })

  it('returns 404 when case not found', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost/api/cases/case-1'), { params })
    expect(res.status).toBe(404)
  })

  it('returns 403 when STAFF accesses another staff case', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'case-1', assignedUserId: 'other-staff-id' })
    const res = await GET(new Request('http://localhost/api/cases/case-1'), { params })
    expect(res.status).toBe(403)
  })

  it('ADMIN gets any case', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'case-1', assignedUserId: 'staff-id' })
    const res = await GET(new Request('http://localhost/api/cases/case-1'), { params })
    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/cases/[id]', () => {
  it('returns 403 when STAFF patches another staff case', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'case-1', assignedUserId: 'other-id' })
    const req = new Request('http://localhost/api/cases/case-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(403)
  })

  it('ADMIN updates a case', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'case-1', assignedUserId: 'staff-id' })
    mockUpdate.mockResolvedValueOnce({ id: 'case-1', title: 'Updated' })
    const req = new Request('http://localhost/api/cases/case-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/cases/[id]', () => {
  it('returns 403 when STAFF deletes', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    const res = await DELETE(new Request('http://localhost/api/cases/case-1'), { params })
    expect(res.status).toBe(403)
  })

  it('ADMIN deletes a case', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'case-1' })
    mockDelete.mockResolvedValueOnce({ id: 'case-1' })
    const res = await DELETE(new Request('http://localhost/api/cases/case-1'), { params })
    expect(res.status).toBe(200)
  })
})
