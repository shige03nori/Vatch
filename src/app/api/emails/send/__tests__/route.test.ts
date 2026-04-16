/** @jest-environment node */
import { POST } from '../route'

// --- prisma モック ---
const mockProposalFindUnique = jest.fn()
const mockProposalUpdate = jest.fn()
const mockMatchingUpdate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    proposal: {
      findUnique: (...args: unknown[]) => mockProposalFindUnique(...args),
      update:     (...args: unknown[]) => mockProposalUpdate(...args),
    },
    matching: {
      update: (...args: unknown[]) => mockMatchingUpdate(...args),
    },
  },
}))

// --- auth モック ---
const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

// --- file-storage モック ---
const mockGetUrl = jest.fn()
jest.mock('@/lib/file-storage', () => ({
  getFileStorage: () => ({ getUrl: mockGetUrl }),
}))

// --- fs/promises モック ---
const mockReadFile = jest.fn()
jest.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}))

const adminSession  = { user: { id: 'admin-id',  role: 'ADMIN' } }
const staffSession  = { user: { id: 'staff-id',  role: 'STAFF' } }
const otherSession  = { user: { id: 'other-id',  role: 'STAFF' } }

const baseProposal = {
  id:         'proposal-1',
  matchingId: 'matching-1',
  to:         'client@example.com',
  cc:         null,
  subject:    '【提案】エンジニア紹介',
  bodyText:   '提案本文',
  matching: {
    case:   { assignedUserId: 'staff-id' },
    talent: { resumeKey: null, resumeFilename: null },
  },
}

function makeReq(body: unknown) {
  return new Request('http://localhost/api/emails/send', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockProposalUpdate.mockResolvedValue({})
  mockMatchingUpdate.mockResolvedValue({})
})

// ─────────────────────────────────────────────
describe('POST /api/emails/send', () => {

  it('401: 未認証', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const res = await POST(makeReq({ proposalId: 'claaaaaaaaaaaaaaaaaaaaaaaaa' }))
    expect(res.status).toBe(401)
  })

  it('422: proposalId が不正形式', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    const res = await POST(makeReq({ proposalId: 'not-a-cuid' }))
    expect(res.status).toBe(422)
  })

  it('404: Proposal が存在しない', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockProposalFindUnique.mockResolvedValueOnce(null)
    const res = await POST(makeReq({ proposalId: 'claaaaaaaaaaaaaaaaaaaaaaaaa' }))
    expect(res.status).toBe(404)
  })

  it('403: 他人の Proposal', async () => {
    mockAuth.mockResolvedValueOnce(otherSession)
    mockProposalFindUnique.mockResolvedValueOnce(baseProposal)
    const res = await POST(makeReq({ proposalId: 'claaaaaaaaaaaaaaaaaaaaaaaaa' }))
    expect(res.status).toBe(403)
  })

  it('200: 正常系・経歴書なし', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockProposalFindUnique.mockResolvedValueOnce(baseProposal)
    const res = await POST(makeReq({ proposalId: 'claaaaaaaaaaaaaaaaaaaaaaaaa' }))
    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual({ sent: true })
    expect(mockProposalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) })
    )
    expect(mockMatchingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'SENT' } })
    )
    expect(mockReadFile).not.toHaveBeenCalled()
  })

  it('200: 正常系・経歴書あり', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockProposalFindUnique.mockResolvedValueOnce({
      ...baseProposal,
      matching: {
        ...baseProposal.matching,
        talent: { resumeKey: 'resumes/talent-1-111.pdf', resumeFilename: '田中太郎_経歴書.pdf' },
      },
    })
    mockGetUrl.mockReturnValueOnce('/uploads/resumes/talent-1-111.pdf')
    mockReadFile.mockResolvedValueOnce(Buffer.from('dummy'))
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const res = await POST(makeReq({ proposalId: 'claaaaaaaaaaaaaaaaaaaaaaaaa' }))
    expect(res.status).toBe(200)
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('田中太郎_経歴書.pdf'))
    consoleSpy.mockRestore()
  })

  it('200: 経歴書ファイル読み取り失敗でも送信継続', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockProposalFindUnique.mockResolvedValueOnce({
      ...baseProposal,
      matching: {
        ...baseProposal.matching,
        talent: { resumeKey: 'resumes/missing.pdf', resumeFilename: '経歴書.pdf' },
      },
    })
    mockGetUrl.mockReturnValueOnce('/uploads/resumes/missing.pdf')
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'))
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await POST(makeReq({ proposalId: 'claaaaaaaaaaaaaaaaaaaaaaaaa' }))
    expect(res.status).toBe(200)
    expect(warnSpy).toHaveBeenCalled()
    expect(mockProposalUpdate).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('200: ADMIN は他人の Proposal も送信できる', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockProposalFindUnique.mockResolvedValueOnce(baseProposal)
    const res = await POST(makeReq({ proposalId: 'claaaaaaaaaaaaaaaaaaaaaaaaa' }))
    expect(res.status).toBe(200)
  })
})
