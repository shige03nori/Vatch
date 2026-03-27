/** @jest-environment node */
import { GET } from '../route'

const mockMatchingFindMany = jest.fn()
const mockProposalFindMany = jest.fn()
const mockContractFindMany = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    matching: { findMany: (...args: unknown[]) => mockMatchingFindMany(...args) },
    proposal:  { findMany: (...args: unknown[]) => mockProposalFindMany(...args) },
    contract:  { findMany: (...args: unknown[]) => mockContractFindMany(...args) },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

const adminSession = { user: { id: 'admin-id', role: 'ADMIN' } }
const staffSession = { user: { id: 'staff-id', role: 'STAFF' } }

const now = new Date()
const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

function makeSentAt(yearMonth: string) {
  return new Date(`${yearMonth}-15T12:00:00Z`)
}

beforeEach(() => jest.clearAllMocks())

describe('GET /api/sales/progress', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns pipeline stages, monthlyData, and salesReps for ADMIN', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)

    // matching.findMany (pipeline)
    mockMatchingFindMany.mockResolvedValueOnce([
      { status: 'SENT',         sellPrice: 80 },
      { status: 'SENT',         sellPrice: 70 },
      { status: 'REPLIED',      sellPrice: 90 },
      { status: 'INTERVIEWING', sellPrice: 60 },
      { status: 'CONTRACTED',   sellPrice: 100 },
    ])

    // proposal.findMany × 2 (monthly + by-user)
    mockProposalFindMany
      .mockResolvedValueOnce([
        { sentAt: makeSentAt(thisMonth) },
        { sentAt: makeSentAt(thisMonth) },
      ])
      .mockResolvedValueOnce([
        {
          matching: {
            case: {
              assignedUserId: 'u1',
              assignedUser: { name: '山田' },
            },
          },
        },
        {
          matching: {
            case: {
              assignedUserId: 'u1',
              assignedUser: { name: '山田' },
            },
          },
        },
      ])

    // contract.findMany (monthly + sales reps)
    mockContractFindMany.mockResolvedValueOnce([
      {
        createdAt: makeSentAt(thisMonth),
        unitPrice: 80,
        costPrice: 65,
        assignedUserId: 'u1',
        assignedUser: { id: 'u1', name: '山田' },
      },
    ])

    const res = await GET()
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)

    // Pipeline stages
    const stages = body.data.pipelineStages
    expect(stages).toHaveLength(4)
    const sentStage = stages.find((s: { label: string }) => s.label === '提案中')
    expect(sentStage.count).toBe(2)
    expect(sentStage.amount).toBe(150) // 80 + 70

    // Monthly data
    const monthly = body.data.monthlyData
    expect(monthly).toHaveLength(6)
    const latestMonth = monthly[monthly.length - 1]
    expect(latestMonth.proposals).toBe(2)
    expect(latestMonth.contracts).toBe(1)
    expect(latestMonth.grossProfit).toBe(15) // 80 - 65

    // Sales reps
    const reps = body.data.salesReps
    expect(reps).toHaveLength(1)
    expect(reps[0].name).toBe('山田')
    expect(reps[0].proposals).toBe(2)
    expect(reps[0].contracts).toBe(1)
    expect(reps[0].winRate).toBeCloseTo(50)
  })

  it('STAFF: matching query scoped to their cases', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)

    mockMatchingFindMany.mockResolvedValueOnce([])
    mockProposalFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    mockContractFindMany.mockResolvedValueOnce([])

    await GET()

    expect(mockMatchingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          case: { assignedUserId: 'staff-id' },
        }),
      })
    )

    expect(mockContractFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignedUserId: 'staff-id',
        }),
      })
    )
  })

  it('returns 500 on unexpected error', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockMatchingFindMany.mockRejectedValueOnce(new Error('DB error'))

    const res = await GET()
    expect(res.status).toBe(500)
  })
})
