import Anthropic from '@anthropic-ai/sdk'

interface GenerateEmailInput {
  proposal: {
    title: string
    client: string
    amount: number
    startDate: Date
  }
  contract: {
    unitPrice: number
    costPrice: number
    grossProfitRate: number
    status: string
  }
  talent: {
    name: string
    email: string
    skills: string[]
    experience: string
    cv: string
  }
}

export async function generateEmailContent(input: GenerateEmailInput): Promise<string> {
  const client = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY
  })

  const prompt = `以下の情報をもとに、提案メール本文を生成してください。
メールは営業担当者がクライアントに送るものです。

【提案情報】
- 案件名：${input.proposal.title}
- クライアント：${input.proposal.client}
- 提案人材：${input.talent.name}
- スキル：${input.talent.skills.join(', ')}
- 経験：${input.talent.experience}

【契約条件】
- 契約売値：${input.contract.unitPrice}万円
- 原価：${input.contract.costPrice}万円
- 粗利率：${input.contract.grossProfitRate.toFixed(1)}%
- 契約開始日：${input.proposal.startDate.toISOString().split('T')[0]}

【提案人材の経歴書】
${input.talent.cv}

メール本文は以下の構成で作成してください：
1. 挨拶
2. 提案人材の紹介（スキル・経験を活かした説明）
3. 契約条件の確認
4. 経歴書添付の案内
5. 締めくくり

【指定】
- トーン：ビジネスライク、誠実、簡潔
- 言語：日本語
- 文字数：300字以上500字以内（500字を超えないこと）`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude API')
  }

  return content.text
}
