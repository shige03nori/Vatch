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
  description: 'SES案件と人材のマッチングを評価して数値化する',
  input_schema: {
    type: 'object' as const,
    properties: {
      score:           { type: 'integer', description: '総合スコア 0-100' },
      skillMatchRate:  { type: 'integer', description: 'スキル一致率 0-100' },
      unitPriceOk:     { type: 'boolean', description: '単価が折り合うか（±10万円以内）' },
      timingOk:        { type: 'boolean', description: '開始時期が2ヶ月以内に合うか' },
      locationOk:      { type: 'boolean', description: '勤務形態が一致するか' },
      costPrice:       { type: 'integer', description: '人材コスト（talent.desiredRate の値をそのまま）' },
      sellPrice:       { type: 'integer', description: '販売価格（case.unitPrice の値をそのまま）' },
      grossProfitRate: { type: 'number',  description: '粗利率 (sellPrice - costPrice) / sellPrice（小数）' },
      grossProfitOk:   { type: 'boolean', description: '粗利率が10%以上か' },
      reason:          { type: 'string',  description: '推薦理由（日本語・100文字程度）' },
      isAutoSend:      { type: 'boolean', description: 'score>=85 かつ unitPriceOk && timingOk && locationOk が全てtrue' },
    },
    required: ['score','skillMatchRate','unitPriceOk','timingOk','locationOk','costPrice','sellPrice','grossProfitRate','grossProfitOk','reason','isAutoSend'],
  },
}

async function callClaude(caseRecord: Case, talent: Talent): Promise<MatchingEvaluation> {
  const startDate = caseRecord.startDate.toLocaleDateString('ja-JP')
  const availableFrom = talent.availableFrom
    ? talent.availableFrom.toLocaleDateString('ja-JP')
    : '即日'

  const content = `以下のSES案件と人材のマッチングを評価してください。

【案件】
タイトル: ${caseRecord.title}
必須スキル: ${caseRecord.skills.join(', ')}
単価: ${caseRecord.unitPrice}万円
開始時期: ${startDate}
勤務形態: ${caseRecord.workStyle}

【人材】
名前: ${talent.name}
スキル: ${talent.skills.join(', ')}
経験年数: ${talent.experience}年
希望単価: ${talent.desiredRate}万円
勤務形態: ${talent.workStyle}
稼働可能日: ${availableFrom}`

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    tools: [TOOL_DEFINITION],
    tool_choice: { type: 'tool', name: 'evaluate_matching' },
    messages: [{ role: 'user', content }],
  })

  const toolUse = response.content.find((c) => c.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not return tool_use response')
  }
  return toolUse.input as MatchingEvaluation
}

export async function evaluateMatching(caseRecord: Case, talent: Talent): Promise<MatchingEvaluation> {
  try {
    return await callClaude(caseRecord, talent)
  } catch (err) {
    console.error('[matching-generator] First attempt failed, retrying:', err)
    return await callClaude(caseRecord, talent)
  }
}
