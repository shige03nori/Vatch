/** @jest-environment node */
import { GET, POST } from '../route'

const mockFindMany = jest.fn()
const mockCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    emailSource: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      create:   (...a: unknown[]) => mockCreate(...a),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...a: unknown[]) => mockAuth(...a) }))

jest.mock('@/lib/crypto', () => ({ encrypt: (v: string) => `encrypted:${v}` }))

const adminSession = { user: { id: 'a1', role: 'ADMIN' } }
const staffSession = { user: { id: 's1', role: 'STAFF' } }

beforeEach(() => jest.clearAllMocks())

describe('GET /api/email-sources', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await GET()).status).toBe(401)
  })

  it('STAFF can list sources (imapPass excluded)', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindMany.mockResolvedValueOnce([
      { id: 's1', label: 'Test', imapHost: 'imap.example.com', imapPort: 993, imapUser: 'u@e.com', imapPass: 'secret', isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data[0].imapPass).toBeUndefined()
  })
})

describe('POST /api/email-sources', () => {
  it('returns 403 for STAFF', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    const req = new Request('http://localhost/api/email-sources', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect((await POST(req)).status).toBe(403)
  })

  it('ADMIN creates email source with encrypted password', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockCreate.mockResolvedValueOnce({ id: 'src1', label: 'Test', imapHost: 'imap.example.com', imapPort: 993, imapUser: 'u@example.com', isActive: true, createdAt: new Date(), updatedAt: new Date() })
    const req = new Request('http://localhost/api/email-sources', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Test', imapHost: 'imap.example.com', imapPort: 993, imapUser: 'u@example.com', imapPass: 'mypassword' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    // imapPass は暗号化して保存されている
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ imapPass: 'encrypted:mypassword' }),
    }))
  })
})
