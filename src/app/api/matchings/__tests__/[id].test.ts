/** @jest-environment node */
import { GET, PATCH, DELETE } from '../[id]/route'

const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
const mockDelete = jest.fn()
const mockActivityCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    matching: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update:     (...args: unknown[]) => mockUpdate(...args),
      delete:     (...args: unknown[]) => mockDelete(...args),
    },
    activityLog: {
      create: (...args: unknown[]) => mockActivityCreate(...args),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

const adminSession = { user: { id: 'admin-id', role: 'ADMIN' } }
const staffSession = { user: { id: 'staff-id', role: 'STAFF' } }
const params = Promise.resolve({ id: 'matching-1' })

beforeEach(() => jest.clearAllMocks())

describe('GET /api/matchings/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/matchings/m1'), { params })).status).toBe(401)
  })

  it('returns 404 when not found', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost/api/matchings/m1'), { params })).status).toBe(404)
  })

  it('returns 403 when STAFF accesses other case matching', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'm1', case: { assignedUserId: 'other-id' } })
    expect((await GET(new Request('http://localhost/api/matchings/m1'), { params })).status).toBe(403)
  })

  it('ADMIN gets any matching', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'm1', case: { assignedUserId: 'staff-id' }, talent: {}, proposal: null })
    expect((await GET(new Request('http://localhost/api/matchings/m1'), { params })).status).toBe(200)
  })
})

describe('PATCH /api/matchings/[id]', () => {
  it('returns 403 when STAFF patches other case matching', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'm1', case: { assignedUserId: 'other-id' } })
    const req = new Request('http://localhost/api/matchings/m1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'SENT' }),
    })
    expect((await PATCH(req, { params })).status).toBe(403)
  })

  it('returns 422 when PATCH body is invalid', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'm1', case: { assignedUserId: 'admin-id' } })
    const req = new Request('http://localhost/api/matchings/m1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'INVALID' }),
    })
    expect((await PATCH(req, { params })).status).toBe(422)
  })

  it('ADMIN updates matching status', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'm1', case: { assignedUserId: 'staff-id' } })
    mockUpdate.mockResolvedValueOnce({ id: 'm1', status: 'SENT' })
    const req = new Request('http://localhost/api/matchings/m1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'SENT' }),
    })
    expect((await PATCH(req, { params })).status).toBe(200)
  })
})

describe('DELETE /api/matchings/[id]', () => {
  it('returns 403 when STAFF deletes', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    expect((await DELETE(new Request('http://localhost/api/matchings/m1'), { params })).status).toBe(403)
  })

  it('ADMIN deletes a matching', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'm1' })
    mockDelete.mockResolvedValueOnce({ id: 'm1' })
    expect((await DELETE(new Request('http://localhost/api/matchings/m1'), { params })).status).toBe(200)
  })
})

describe('PATCH /api/matchings/[id] — memo & ActivityLog', () => {
  it('memo を更新できる', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    const existing = { id: 'm1', caseId: 'case-1', talentId: 'talent-1', status: 'SENT', case: { assignedUserId: 'admin-id', id: 'case-1' } }
    mockFindUnique.mockResolvedValueOnce(existing)
    mockUpdate.mockResolvedValueOnce({ id: 'm1', memo: 'テストメモ' })
    mockActivityCreate.mockResolvedValueOnce({})

    const res = await PATCH(
      new Request('http://localhost/api/matchings/m1', {
        method: 'PATCH',
        body: JSON.stringify({ memo: 'テストメモ' }),
      }),
      { params: Promise.resolve({ id: 'm1' }) }
    )
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ memo: 'テストメモ' }) })
    )
  })

  it('status 変更時に STAGE_CHANGED を ActivityLog に記録する', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    const existing = { id: 'm1', caseId: 'case-1', talentId: 'talent-1', status: 'SENT', case: { assignedUserId: 'admin-id', id: 'case-1' } }
    mockFindUnique.mockResolvedValueOnce(existing)
    mockUpdate.mockResolvedValueOnce({ id: 'm1', status: 'REPLIED' })
    mockActivityCreate.mockResolvedValueOnce({})

    await PATCH(
      new Request('http://localhost/api/matchings/m1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'REPLIED' }),
      }),
      { params: Promise.resolve({ id: 'm1' }) }
    )
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'STAGE_CHANGED', matchingId: 'm1' }),
      })
    )
  })

  it('status も memo も未指定の場合 422 を返す', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindUnique.mockResolvedValueOnce({ id: 'm1', caseId: 'case-1', talentId: 'talent-1', case: { assignedUserId: 'admin-id' } })
    const res = await PATCH(
      new Request('http://localhost/api/matchings/m1', {
        method: 'PATCH',
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: 'm1' }) }
    )
    expect(res.status).toBe(422)
  })
})
