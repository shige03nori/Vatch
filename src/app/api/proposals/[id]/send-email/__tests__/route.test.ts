/** @jest-environment node */
import { POST } from '../route'

// --- prisma モック ---
const mockProposalFindUnique = jest.fn()
const mockEmailJobCreate = jest.fn()
const mockEmailJobUpdate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    proposal: {
      findUnique: (...args: unknown[]) => mockProposalFindUnique(...args),
    },
    emailJob: {
      create: (...args: unknown[]) => mockEmailJobCreate(...args),
      update: (...args: unknown[]) => mockEmailJobUpdate(...args),
    },
  },
}))

// --- auth モック ---
const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

// --- email-generator モック ---
jest.mock('@/lib/email-generator', () => ({
  generateEmailContent: jest.fn().mockResolvedValue('Generated email content'),
}))

// --- email-encryptor モック ---
jest.mock('@/lib/email-encryptor', () => ({
  encryptContent: jest.fn((content: string) => `encrypted:${content}`),
}))

const adminSession = { user: { id: 'admin-id', role: 'ADMIN' } }
const staffSession = { user: { id: 'staff-id', role: 'STAFF' } }
const otherSession = { user: { id: 'other-id', role: 'STAFF' } }

const baseProposal = {
  id: 'prop-1',
  matchingId: 'matching-1',
  to: 'client@example.com',
  cc: null,
  subject: '【提案】エンジニア紹介',
  bodyText: '提案本文',
  costPrice: 500000,
  sellPrice: 700000,
  grossProfitRate: 28.6,
  status: 'DRAFT',
  sentAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  matching: {
    id: 'matching-1',
    case: {
      id: 'case-1',
      title: 'React Developer',
      client: 'ACME Inc',
      assignedUserId: 'staff-id',
    },
    talent: {
      id: 'talent-1',
      name: 'Taro Tanaka',
      email: 'taro@example.com',
      skills: ['React', 'Node.js'],
      experience: 5,
    },
  },
  case: {
    id: 'case-1',
    title: 'React Developer',
    client: 'ACME Inc',
  },
  talent: {
    id: 'talent-1',
    name: 'Taro Tanaka',
    email: 'taro@example.com',
    skills: ['React', 'Node.js'],
    experience: 5,
    cv: 'Experienced React developer...',
  },
  contract: {
    id: 'contract-1',
    unitPrice: 700000,
    costPrice: 500000,
    grossProfitRate: 28.6,
    status: 'ACTIVE',
  },
}

function makeReq(proposalId: string, body: unknown) {
  return new Request(`http://localhost/api/proposals/${proposalId}/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockEmailJobCreate.mockResolvedValue({
    id: 'job-1',
    status: 'PENDING',
    proposalId: 'prop-1',
  })
  mockEmailJobUpdate.mockResolvedValue({})
})

// ─────────────────────────────────────────────
describe('POST /api/proposals/[id]/send-email', () => {
  it('401: 未認証', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const res = await POST(
      makeReq('prop-1', { sendType: 'NOW' }),
      { params: Promise.resolve({ id: 'prop-1' }) }
    )
    expect(res.status).toBe(401)
  })

  it('404: Proposal が存在しない', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockProposalFindUnique.mockResolvedValueOnce(null)
    const res = await POST(
      makeReq('prop-1', { sendType: 'NOW' }),
      { params: Promise.resolve({ id: 'prop-1' }) }
    )
    expect(res.status).toBe(404)
  })

  it('403: 他人の Proposal（STAFF のみ）', async () => {
    mockAuth.mockResolvedValueOnce(otherSession)
    mockProposalFindUnique.mockResolvedValueOnce(baseProposal)
    const res = await POST(
      makeReq('prop-1', { sendType: 'NOW' }),
      { params: Promise.resolve({ id: 'prop-1' }) }
    )
    expect(res.status).toBe(403)
  })

  it('200: NOW sendType でジョブ作成（成功）', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockProposalFindUnique.mockResolvedValueOnce(baseProposal)
    const res = await POST(
      makeReq('prop-1', { sendType: 'NOW' }),
      { params: Promise.resolve({ id: 'prop-1' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.jobId).toBe('job-1')
    expect(json.data.status).toBe('PENDING')
  })

  it('200: SCHEDULED sendType でジョブ作成', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockProposalFindUnique.mockResolvedValueOnce(baseProposal)
    const futureTime = new Date(Date.now() + 3600000).toISOString()
    const res = await POST(
      makeReq('prop-1', { sendType: 'SCHEDULED', scheduledAt: futureTime }),
      { params: Promise.resolve({ id: 'prop-1' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('422: スケジュール時刻が過去', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockProposalFindUnique.mockResolvedValueOnce(baseProposal)
    const pastTime = new Date(Date.now() - 3600000).toISOString()
    const res = await POST(
      makeReq('prop-1', { sendType: 'SCHEDULED', scheduledAt: pastTime }),
      { params: Promise.resolve({ id: 'prop-1' }) }
    )
    expect(res.status).toBe(422)
  })

  it('200: ADMIN は他人の Proposal でもジョブ作成できる', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockProposalFindUnique.mockResolvedValueOnce(baseProposal)
    const res = await POST(
      makeReq('prop-1', { sendType: 'NOW' }),
      { params: Promise.resolve({ id: 'prop-1' }) }
    )
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })

  it('ジョブ作成時に emailJob.create が呼ばれる', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockProposalFindUnique.mockResolvedValueOnce(baseProposal)
    await POST(
      makeReq('prop-1', { sendType: 'NOW' }),
      { params: Promise.resolve({ id: 'prop-1' }) }
    )
    expect(mockEmailJobCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          proposalId: 'prop-1',
          status: 'PENDING',
          sendType: 'NOW',
        }),
      })
    )
  })

  it('22: sendType が不正な値', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    const res = await POST(
      makeReq('prop-1', { sendType: 'INVALID' }),
      { params: Promise.resolve({ id: 'prop-1' }) }
    )
    expect(res.status).toBe(422)
  })
})
