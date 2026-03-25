/** @jest-environment node */
import { POST } from '../route'

const mockRunIngestion = jest.fn()
jest.mock('@/lib/email-ingestion', () => ({
  runIngestion: (...a: unknown[]) => mockRunIngestion(...a),
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...a: unknown[]) => mockAuth(...a) }))

const INTERNAL_KEY = 'test-internal-key'

beforeEach(() => {
  jest.clearAllMocks()
  process.env.INTERNAL_API_KEY = INTERNAL_KEY
})

describe('POST /api/emails/fetch', () => {
  it('returns 401 when not authenticated and no internal key', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const req = new Request('http://localhost/api/emails/fetch', { method: 'POST' })
    expect((await POST(req)).status).toBe(401)
  })

  it('allows access with valid INTERNAL_API_KEY header', async () => {
    mockAuth.mockResolvedValueOnce(null)
    mockRunIngestion.mockResolvedValueOnce({ fetched: 1, parsed: 1, errors: 0, unknown: 0 })
    const req = new Request('http://localhost/api/emails/fetch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${INTERNAL_KEY}` },
    })
    expect((await POST(req)).status).toBe(200)
  })

  it('returns 403 when STAFF user calls', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'u1', role: 'STAFF' } })
    const req = new Request('http://localhost/api/emails/fetch', { method: 'POST' })
    expect((await POST(req)).status).toBe(403)
  })

  it('ADMIN gets 200 with ingestion result', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'a1', role: 'ADMIN' } })
    mockRunIngestion.mockResolvedValueOnce({ fetched: 3, parsed: 2, errors: 1, unknown: 0 })
    const req = new Request('http://localhost/api/emails/fetch', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.fetched).toBe(3)
    expect(body.data.errors).toBe(1)
  })
})
