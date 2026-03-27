// src/lib/matching-generator.ts
import Anthropic from '@anthropic-ai/sdk'
import type { Case, Talent } from '@prisma/client'

let _anthropic: Anthropic | null = null
function getClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _anthropic
}

export type MatchingEvaluation = {
  score: number           // 0-100
  skillMatchRate: number  // 0-100
  unitPriceOk: boolean
  timingOk: boolean
  locationOk: boolean
  costPrice: number       // 万円整数
  sellPrice: number       // 万円整数
  grossProfitRate: number // 0.0-1.0
  grossProfitOk: boolean  // grossProfitRate >= 0.1
  reason: string
  isAutoSend: boolean     // score >= 85 かつ全適合OK
}

const TOOL_DEFINITION: Anthropic.Tool = {
  name: 'evaluate_matching',
  description: 'SES案件と人材のマッチングを評価する',
  input_schema: {
    type: 'object' as const,
    properties: {
      score:         { type: 'integer', description: '総合スコア 0-100' },
      skillMatchRate:{ type: 'integer', description: 'スキル一致率 0-100' },
      unitPriceOk:   { type: 'boolean', description: '単価差が±10万円以内か' },
      timingOk:      { type: 'boolean', description: '開始時期が2ヶ月以内に合うか' },
      locationOk:    { type: 'boolean', description: '勤務形態が一致するか' },
      reason:        { type: 'string',  description: '推薦理由（日本語・50文字程度）' },
    },
    required: ['score','skillMatchRate','unitPriceOk','timingOk','locationOk','reason'],
  },
}

type ClaudeEvaluation = Pick<MatchingEvaluation, 'score' | 'skillMatchRate' | 'unitPriceOk' | 'timingOk' | 'locationOk' | 'reason'>

async function callClaude(caseRecord: Case, talent: Talent): Promise<MatchingEvaluation> {
  const startDate = caseRecord.startDate.toLocaleDateString('ja-JP')
  const availableFrom = talent.availableFrom
    ? talent.availableFrom.toLocaleDateString('ja-JP')
    : '即日'

  const content = `SES案件と人材のマッチングを評価してください。
案件: ${caseRecord.title} / スキル: ${caseRecord.skills.join(',')} / 単価: ${caseRecord.unitPrice}万円 / 開始: ${startDate} / 勤務: ${caseRecord.workStyle}
人材: スキル: ${talent.skills.join(',')} / 経験: ${talent.experience}年 / 希望単価: ${talent.desiredRate}万円 / 勤務: ${talent.workStyle} / 稼働: ${availableFrom}`

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    tools: [TOOL_DEFINITION],
    tool_choice: { type: 'tool', name: 'evaluate_matching' },
    messages: [{ role: 'user', content }],
  })

  const toolUse = response.content.find((c) => c.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not return tool_use response')
  }

  const claude = toolUse.input as ClaudeEvaluation

  // コードで計算できる値はClaudeに問わない
  const costPrice = talent.desiredRate
  const sellPrice = caseRecord.unitPrice
  const grossProfitRate = sellPrice > 0 ? ((sellPrice - costPrice) / sellPrice) * 100 : 0
  const grossProfitOk = grossProfitRate >= 10
  const isAutoSend = claude.score >= 85 && claude.unitPriceOk && claude.timingOk && claude.locationOk

  return { ...claude, costPrice, sellPrice, grossProfitRate, grossProfitOk, isAutoSend }
}

export async function evaluateMatching(caseRecord: Case, talent: Talent): Promise<MatchingEvaluation> {
  try {
    return await callClaude(caseRecord, talent)
  } catch (err) {
    console.error('[matching-generator] First attempt failed, retrying:', err)
    return await callClaude(caseRecord, talent)
  }
}
