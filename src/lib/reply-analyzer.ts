// src/lib/reply-analyzer.ts
import Anthropic from '@anthropic-ai/sdk'

export type ReplyClassification =
  | 'ACCEPTED'      // 提案を承諾・成約
  | 'REJECTED'      // 提案を断り
  | 'INTERVIEW'     // 面談を希望
  | 'NEGOTIATING'   // 条件交渉中
  | 'OTHER'         // 判断不能

export type ReplyAnalysisResult = {
  classification: ReplyClassification
  confidence: number   // 0-100
  summary: string      // 1〜2文の要約
}

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY })
  return _client
}

const CLASSIFY_TOOL: Anthropic.Tool = {
  name: 'classify_reply',
  description: '提案メールへの返信内容を分類する',
  input_schema: {
    type: 'object' as const,
    properties: {
      classification: {
        type: 'string',
        enum: ['ACCEPTED', 'REJECTED', 'INTERVIEW', 'NEGOTIATING', 'OTHER'],
        description: 'ACCEPTED=承諾/成約意思あり, REJECTED=断り, INTERVIEW=面談希望, NEGOTIATING=条件交渉, OTHER=判断不能',
      },
      confidence: { type: 'integer', description: '分類の確信度 0-100' },
      summary: { type: 'string', description: '返信内容の要約（1〜2文）' },
    },
    required: ['classification', 'confidence', 'summary'],
  },
}

export async function analyzeReplyEmail(
  replyBodyText: string,
  originalSubject: string,
): Promise<ReplyAnalysisResult> {
  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    tools: [CLASSIFY_TOOL],
    tool_choice: { type: 'tool', name: 'classify_reply' },
    messages: [
      {
        role: 'user',
        content: `以下はSES提案メールへの返信です。内容を分類してください。

【元のメール件名】
${originalSubject}

【返信本文】
${replyBodyText.slice(0, 3000)}`,
      },
    ],
  })

  const toolUse = response.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === 'tool_use',
  )
  if (!toolUse) {
    return { classification: 'OTHER', confidence: 0, summary: '解析に失敗しました' }
  }

  const input = toolUse.input as ReplyAnalysisResult
  return {
    classification: input.classification,
    confidence: Math.min(100, Math.max(0, input.confidence)),
    summary: input.summary,
  }
}
