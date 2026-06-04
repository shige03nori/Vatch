import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

const EXTRACT_TOOL: Anthropic.Tool = {
  name: 'extract_talent_info',
  description: '経歴書テキストからSES人材情報を抽出する',
  input_schema: {
    type: 'object' as const,
    properties: {
      name:        { type: 'string',  description: '氏名（フルネーム）' },
      skills:      { type: 'array',   items: { type: 'string' }, description: '技術スキル・言語・フレームワーク一覧（空の場合は[]）' },
      experience:  { type: 'integer', description: 'IT経験年数（不明な場合は0）' },
      desiredRate: { type: 'integer', description: '希望単価（万円）。記載がなければ0' },
      location:    { type: 'string',  description: '居住地または最寄り地域。不明な場合は空文字' },
      workStyle:   { type: 'string',  enum: ['REMOTE', 'ONSITE', 'HYBRID'], description: '希望勤務形式。不明な場合はHYBRID' },
      email:       { type: 'string',  description: 'メールアドレス。見つからない場合は空文字' },
    },
    required: ['name', 'skills', 'experience', 'desiredRate', 'location', 'workStyle', 'email'],
  },
}

export type ExtractedTalent = {
  name: string
  skills: string[]
  experience: number
  desiredRate: number
  location: string
  workStyle: 'REMOTE' | 'ONSITE' | 'HYBRID'
  email: string
}

export async function extractTalentInfo(input: string | Buffer): Promise<ExtractedTalent> {
  let resumeText: string
  if (Buffer.isBuffer(input)) {
    const { value } = await mammoth.extractRawText({ buffer: input })
    resumeText = value
  } else {
    resumeText = input
  }

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'extract_talent_info' },
    messages: [
      {
        role: 'user',
        content: `以下の経歴書テキストからSES人材情報を抽出してください。\n\n${resumeText.slice(0, 8000)}`,
      },
    ],
  })

  const toolUse = response.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === 'tool_use'
  )
  if (!toolUse) throw new Error('AI extraction failed: no tool_use block')
  return toolUse.input as ExtractedTalent
}
