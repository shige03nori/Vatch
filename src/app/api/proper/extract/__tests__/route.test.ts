/** @jest-environment node */
import { POST } from '../route'

const mockExtract = jest.fn()
jest.mock('@/lib/resume-extractor', () => ({ extractTalentInfo: (...a: unknown[]) => mockExtract(...a) }))
jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
const mockAuth = auth as jest.Mock
beforeEach(() => jest.clearAllMocks())

describe('POST /api/proper/extract', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const formData = new FormData()
    formData.append('file', new Blob(['dummy'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'test.docx')
    const req = new Request('http://localhost/api/proper/extract', { method: 'POST', body: formData })
    expect((await POST(req)).status).toBe(401)
  })

  it('returns 422 when no file provided', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'admin', role: 'ADMIN' } })
    const formData = new FormData()
    const req = new Request('http://localhost/api/proper/extract', { method: 'POST', body: formData })
    expect((await POST(req)).status).toBe(422)
  })

  it('returns extracted talent info on success', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'admin', role: 'ADMIN' } })
    mockExtract.mockResolvedValueOnce({
      name: '山田花子', skills: ['Java', 'Spring'], experience: 5,
      desiredRate: 60, location: '東京', workStyle: 'HYBRID', email: 'hanako@example.com',
    })
    const formData = new FormData()
    formData.append('file', new Blob(['dummy docx content'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'test.docx')
    const req = new Request('http://localhost/api/proper/extract', { method: 'POST', body: formData })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name).toBe('山田花子')
    expect(body.data.skills).toContain('Java')
  })
})
