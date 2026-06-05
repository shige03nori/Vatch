/** @jest-environment node */
import { GET } from '../route'

const mockFindMany = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}))

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
const mockAuth = auth as jest.Mock

const adminSession = { user: { id: 'admin', role: 'ADMIN' } }

beforeEach(() => jest.clearAllMocks())

describe('GET /api/contracts/summary', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await GET()).status).toBe(401)
  })

  it('returns 6 months of summary data', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindMany.mockResolvedValue([
      { unitPrice: 80, costPrice: 65 },
      { unitPrice: 70, costPrice: 58 },
    ])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(6)
    expect(body.data[0]).toHaveProperty('month')
    expect(body.data[0]).toHaveProperty('revenue')
    expect(body.data[0]).toHaveProperty('cost')
    expect(body.data[0]).toHaveProperty('grossProfit')
    expect(body.data[0].revenue).toBe(150)
    expect(body.data[0].cost).toBe(123)
    expect(body.data[0].grossProfit).toBe(27)
  })

  it('returns 0s when no contracts in month', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindMany.mockResolvedValue([])
    const res = await GET()
    const body = await res.json()
    expect(body.data[0].revenue).toBe(0)
    expect(body.data[0].grossProfit).toBe(0)
  })

  it('STAFF filter uses assignedUserId', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'staff-id', role: 'STAFF' } })
    mockFindMany.mockResolvedValue([])
    await GET()
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assignedUserId: 'staff-id' }),
      })
    )
  })
})
