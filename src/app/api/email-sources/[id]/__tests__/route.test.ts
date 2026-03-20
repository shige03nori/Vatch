/** @jest-environment node */
import { PATCH, DELETE } from '../route'

const mockUpdate = jest.fn()
const mockDelete = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    emailSource: {
      update: (...a: unknown[]) => mockUpdate(...a),
      delete: (...a: unknown[]) => mockDelete(...a),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...a: unknown[]) => mockAuth(...a) }))

jest.mock('@/lib/crypto', () => ({ encrypt: (v: string) => `encrypted:${v}` }))

const adminSession = { user: { id: 'a1', role: 'ADMIN' } }
const staffSession = { user: { id: 's1', role: 'STAFF' } }

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => jest.clearAllMocks())

describe('PATCH /api/email-sources/[id]', () => {
  it('returns 403 for STAFF', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    const req = new Request('http://localhost/api/email-sources/src1', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
    expect((await PATCH(req, makeParams('src1'))).status).toBe(403)
  })

  it('ADMIN updates isActive without touching password', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockUpdate.mockResolvedValueOnce({
      id: 'src1', label: 'Test', imapHost: 'imap.example.com',
      imapPort: 993, imapUser: 'u@e.com', imapPass: 'encrypted', isActive: false,
      createdAt: new Date(), updatedAt: new Date(),
    })
    const req = new Request('http://localhost/api/email-sources/src1', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
    const res = await PATCH(req, makeParams('src1'))
    expect(res.status).toBe(200)
    // imapPass を渡さないときは encrypt が呼ばれないこと
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ imapPass: expect.anything() }),
    }))
    // imapPass はレスポンスから除外
    const body = await res.json()
    expect(body.data.imapPass).toBeUndefined()
  })

  it('ADMIN updates password with encryption', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockUpdate.mockResolvedValueOnce({
      id: 'src1', label: 'Test', imapHost: 'imap.example.com',
      imapPort: 993, imapUser: 'u@e.com', imapPass: 'encrypted:newpass', isActive: true,
      createdAt: new Date(), updatedAt: new Date(),
    })
    const req = new Request('http://localhost/api/email-sources/src1', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imapPass: 'newpass' }),
    })
    await PATCH(req, makeParams('src1'))
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ imapPass: 'encrypted:newpass' }),
    }))
  })
})

describe('DELETE /api/email-sources/[id]', () => {
  it('returns 403 for STAFF', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    const req = new Request('http://localhost/api/email-sources/src1', { method: 'DELETE' })
    expect((await DELETE(req, makeParams('src1'))).status).toBe(403)
  })

  it('ADMIN deletes successfully', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockDelete.mockResolvedValueOnce({})
    const req = new Request('http://localhost/api/email-sources/src1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('src1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.deleted).toBe(true)
  })

  it('returns 404 when record not found (P2025)', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    const err = Object.assign(new Error('Not found'), { code: 'P2025' })
    mockDelete.mockRejectedValueOnce(err)
    const req = new Request('http://localhost/api/email-sources/nonexistent', { method: 'DELETE' })
    expect((await DELETE(req, makeParams('nonexistent'))).status).toBe(404)
  })

  it('returns 500 on DB error (non-P2025)', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockDelete.mockRejectedValueOnce(new Error('Connection refused'))
    const req = new Request('http://localhost/api/email-sources/src1', { method: 'DELETE' })
    expect((await DELETE(req, makeParams('src1'))).status).toBe(500)
  })
})
