/** @jest-environment node */
import { GET } from '../route'

const mockFindMany = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    matching: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}))

const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

const adminSession = { user: { id: 'admin-id', role: 'ADMIN' } }
const staffSession = { user: { id: 'staff-id', role: 'STAFF' } }

beforeEach(() => jest.clearAllMocks())

describe('GET /api/sales/pipeline', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost/api/sales/pipeline'))
    expect(res.status).toBe(401)
  })

  it('ADMIN gets all matchings with nested case/talent/proposal', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindMany.mockResolvedValueOnce([{
      id: 'm1',
      status: 'SENT',
      score: 92,
      memo: null,
      case: { id: 'c1', title: 'Java案件', client: '株式会社A', unitPrice: 80, assignedUser: { name: '佐藤' } },
      talent: { id: 't1', name: '田中', skills: ['Java'], experience: 8 },
      proposal: { id: 'p1', status: 'SENT', to: 'a@example.com', sentAt: new Date() },
    }])

    const res = await GET(new Request('http://localhost/api/sales/pipeline'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].case.assignedUser).toBeDefined()
    expect(body.data[0].proposal).toBeDefined()
  })

  it('STAFF gets only matchings for their assigned cases', async () => {
    mockAuth.mockResolvedValueOnce(staffSession)
    mockFindMany.mockResolvedValueOnce([])

    await GET(new Request('http://localhost/api/sales/pipeline'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ case: { assignedUserId: 'staff-id' } }),
      })
    )
  })

  it('status クエリパラメータでフィルタリングできる', async () => {
    mockAuth.mockResolvedValueOnce(adminSession)
    mockFindMany.mockResolvedValueOnce([])

    await GET(new Request('http://localhost/api/sales/pipeline?status=SENT'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'SENT' }) })
    )
  })
})
