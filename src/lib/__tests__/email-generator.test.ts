/**
 * @jest-environment node
 */
import { generateEmailContent } from '../email-generator'

const mockProposal = {
  title: 'テストシステム構築',
  client: 'テスト社',
  amount: 500,
  startDate: new Date('2026-07-01')
}

const mockContract = {
  unitPrice: 80,
  costPrice: 65,
  grossProfitRate: 18.75,
  status: 'ACTIVE'
}

const mockTalent = {
  name: '田中 太郎',
  email: 'tanaka@example.com',
  skills: ['TypeScript', 'React', 'Node.js'],
  experience: '5年間のフルスタック開発経験',
  cv: '詳細な経歴書内容...'
}

describe('generateEmailContent', () => {
  it('returns email content string', async () => {
    const content = await generateEmailContent({
      proposal: mockProposal,
      contract: mockContract,
      talent: mockTalent
    })

    expect(typeof content).toBe('string')
    expect(content.length).toBeGreaterThanOrEqual(300)
    expect(content.length).toBeLessThanOrEqual(500)
  })

  it('includes talent name in content', async () => {
    const content = await generateEmailContent({
      proposal: mockProposal,
      contract: mockContract,
      talent: mockTalent
    })

    expect(content).toContain('田中 太郎')
  })

  it('includes proposal title in content', async () => {
    const content = await generateEmailContent({
      proposal: mockProposal,
      contract: mockContract,
      talent: mockTalent
    })

    expect(content).toContain('テストシステム構築')
  })

  it('throws error when Claude API fails', async () => {
    const originalEnv = process.env.CLAUDE_API_KEY
    process.env.CLAUDE_API_KEY = 'invalid'

    await expect(
      generateEmailContent({
        proposal: mockProposal,
        contract: mockContract,
        talent: mockTalent
      })
    ).rejects.toThrow()

    process.env.CLAUDE_API_KEY = originalEnv
  })
})
