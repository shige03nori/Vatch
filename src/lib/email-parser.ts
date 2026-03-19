// src/lib/email-parser.ts
import Anthropic from '@anthropic-ai/sdk'

let _anthropic: Anthropic | null = null
function getClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _anthropic
}

export type ParsedEmailResult = {
  type: 'CASE' | 'TALENT' | 'UNKNOWN'
  confidence: number
  extractedName?: string
  skills: string[]
  case?: {
    title: string
    client: string
    clientEmail?: string
    unitPrice: number
    startDate: string
    workStyle: 'REMOTE' | 'ONSITE' | 'HYBRID'
  }
  talent?: {
    name: string
    experience: number
    desiredRate: number
    location: string
    workStyle: 'REMOTE' | 'ONSITE' | 'HYBRID'
  }
}

const TOOL_DEFINITION: Anthropic.Tool = {
  name: 'extract_email_info',
  description: 'SES営業メールから案件または人材情報を抽出する',
  input_schema: {
    type: 'object' as const,
    properties: {
      type: { type: 'string', enum: ['CASE', 'TALENT', 'UNKNOWN'] },
      confidence: { type: 'number', minimum: 0, maximum: 100 },
      extractedName: { type: 'string' },
      skills: { type: 'array', items: { type: 'string' } },
      case: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          client: { type: 'string' },
          clientEmail: { type: 'string' },
          unitPrice: { type: 'number' },
          startDate: { type: 'string' },
          workStyle: { type: 'string', enum: ['REMOTE', 'ONSITE', 'HYBRID'] },
        },
        required: ['title', 'client', 'unitPrice', 'startDate', 'workStyle'],
      },
      talent: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          experience: { type: 'number' },
          desiredRate: { type: 'number' },
          location: { type: 'string' },
          workStyle: { type: 'string', enum: ['REMOTE', 'ONSITE', 'HYBRID'] },
        },
        required: ['name', 'experience', 'desiredRate', 'location', 'workStyle'],
      },
    },
    required: ['type', 'confidence', 'skills'],
  },
}

async function callClaude(bodyText: string): Promise<ParsedEmailResult> {
  const content = `以下のSES営業メールを解析して案件または人材情報を抽出してください。\n\n${bodyText}`.slice(0, 3000)
  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    tools: [TOOL_DEFINITION],
    tool_choice: { type: 'tool', name: 'extract_email_info' },
    messages: [
      {
        role: 'user',
        content,
      },
    ],
  })

  const toolUse = response.content.find((c) => c.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not return tool_use response')
  }
  return toolUse.input as ParsedEmailResult
}

export async function parseEmailBody(bodyText: string): Promise<ParsedEmailResult> {
  try {
    return await callClaude(bodyText)
  } catch {
    // 1回リトライ
    return await callClaude(bodyText)
  }
}
