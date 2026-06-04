// scripts/import-proper-talents.ts
import * as fs from 'fs'
import * as path from 'path'
import mammoth from 'mammoth'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import Anthropic from '@anthropic-ai/sdk'
import { execSync } from 'child_process'

const RESUME_BASE = 'C:\\Users\\shige\\Downloads\\経歴書'
const FOLDERS: { dir: string; office: 'TOKYO' | 'NAGOYA' }[] = [
  { dir: path.join(RESUME_BASE, '東京'),  office: 'TOKYO'  },
  { dir: path.join(RESUME_BASE, '名古屋'), office: 'NAGOYA' },
]

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

let counter = 1

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

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// .doc → .docx 変換 (Microsoft Word COM - .ps1 ファイル経由)
function convertDocToDocx(docPath: string): string {
  const docxPath = docPath.replace(/\.doc$/i, '_converted.docx')
  if (fs.existsSync(docxPath)) return docxPath

  const ps1 = path.resolve('scripts', 'convert-doc.ps1')
  try {
    const result = execSync(
      `powershell -ExecutionPolicy Bypass -File "${ps1}" -InputPath "${docPath}" -OutputPath "${docxPath}"`,
      { timeout: 30000 }
    ).toString()
    if (result.includes('ERROR')) throw new Error(result)
    return fs.existsSync(docxPath) ? docxPath : ''
  } catch {
    return ''
  }
}

type ExtractedTalent = {
  name: string; skills: string[]; experience: number; desiredRate: number
  location: string; workStyle: 'REMOTE' | 'ONSITE' | 'HYBRID'; email: string
}

async function extractFromText(text: string): Promise<ExtractedTalent> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'extract_talent_info' },
    messages: [{ role: 'user', content: `以下の経歴書テキストからSES人材情報を抽出してください。\n\n${text.slice(0, 8000)}` }],
  })
  const toolUse = response.content.find((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use')
  if (!toolUse) throw new Error('AI extraction failed')
  return toolUse.input as ExtractedTalent
}

async function readDocxText(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath)
  const { value } = await mammoth.extractRawText({ buffer })
  return value
}

async function importFile(filePath: string, office: 'TOKYO' | 'NAGOYA', assignedUserId: string) {
  const filename = path.basename(filePath)
  const ext = path.extname(filePath).toLowerCase()
  process.stdout.write(`  処理中: ${filename} ... `)

  let targetPath = filePath

  // .doc ファイルは Word COM で変換
  if (ext === '.doc') {
    const converted = convertDocToDocx(filePath)
    if (!converted) {
      console.log('⚠ Word変換失敗（スキップ）')
      return null
    }
    targetPath = converted
  }

  const text = await readDocxText(targetPath)
  if (!text.trim()) {
    console.log('⚠ テキスト抽出できませんでした（スキップ）')
    return null
  }

  const extracted = await extractFromText(text)

  // メールアドレス: 経歴書に記載があればそれを使用、なければ連番で生成
  const email = extracted.email.trim() && extracted.email.includes('@')
    ? extracted.email.trim()
    : `proper${String(counter++).padStart(3, '0')}@vicent.co.jp`

  // 既存チェック
  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    // 別のメールで再試行
    const altEmail = `proper${String(counter++).padStart(3, '0')}@vicent.co.jp`
    const existingAlt = await prisma.user.findUnique({ where: { email: altEmail } })
    if (existingAlt) {
      console.log(`⚠ メール重複 → スキップ`)
      return null
    }
  }

  const finalEmail = (() => {
    if (extracted.email.trim() && extracted.email.includes('@')) return extracted.email.trim()
    return `proper${String(counter++).padStart(3, '0')}@vicent.co.jp`
  })()

  // 重複再チェック
  const finalExisting = await prisma.user.findUnique({ where: { email: finalEmail } })
  if (finalExisting) {
    console.log(`⚠ ${finalEmail} 重複 → スキップ`)
    return null
  }

  const tempPassword = generateTempPassword()
  const hashedPassword = await bcrypt.hash(tempPassword, 10)

  const { user, talent } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: extracted.name || filename, email: finalEmail, role: 'PROPER', password: hashedPassword },
    })
    const talent = await tx.talent.create({
      data: {
        name:           extracted.name || filename,
        skills:         extracted.skills.length > 0 ? extracted.skills : ['未設定'],
        experience:     extracted.experience,
        desiredRate:    extracted.desiredRate > 0 ? extracted.desiredRate : 60,
        location:       extracted.location || (office === 'TOKYO' ? '東京' : '名古屋'),
        workStyle:      extracted.workStyle,
        talentType:     'PROPER',
        office,
        userId:         user.id,
        assignedUserId,
      },
    })
    return { user, talent }
  })

  console.log(`✓ ${extracted.name} (${finalEmail}) 仮PW: ${tempPassword}`)

  // 変換した一時ファイルを削除
  if (targetPath !== filePath && fs.existsSync(targetPath)) fs.unlinkSync(targetPath)

  return { user, talent, tempPassword }
}

async function main() {
  console.log('=== プロパ人材 初期データ投入 ===\n')

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
  if (!adminUser) {
    console.error('エラー: ADMINユーザーが見つかりません。')
    process.exit(1)
  }
  console.log(`担当者: ${adminUser.name} (${adminUser.email})\n`)

  const results: { name: string; email: string; tempPassword: string; office: string }[] = []
  let successCount = 0
  let skipCount = 0

  for (const { dir, office } of FOLDERS) {
    const label = office === 'TOKYO' ? '東京' : '名古屋'
    console.log(`\n【${label}】`)

    if (!fs.existsSync(dir)) {
      console.log(`  フォルダが見つかりません: ${dir}`)
      continue
    }

    const files = fs.readdirSync(dir)
      .filter(f => /\.(doc|docx)$/i.test(f))
      .sort()
      .map(f => path.join(dir, f))

    console.log(`  ${files.length} ファイル検出`)

    for (const file of files) {
      try {
        const result = await importFile(file, office, adminUser.id)
        if (result) {
          results.push({ name: result.user.name!, email: result.user.email, tempPassword: result.tempPassword, office: label })
          successCount++
        } else {
          skipCount++
        }
        await new Promise(r => setTimeout(r, 600))
      } catch (err) {
        console.log(`  ✗ エラー: ${err instanceof Error ? err.message : String(err)}`)
        skipCount++
      }
    }
  }

  console.log(`\n\n=== 完了: ${successCount}名登録, ${skipCount}名スキップ ===\n`)

  if (results.length > 0) {
    console.log('【ログイン情報一覧】')
    console.log('═'.repeat(80))
    console.log(`${'拠点'.padEnd(6)} ${'氏名'.padEnd(20)} ${'メールアドレス'.padEnd(36)} 仮PW`)
    console.log('─'.repeat(80))
    for (const r of results) {
      console.log(`${r.office.padEnd(6)} ${r.name.padEnd(20)} ${r.email.padEnd(36)} ${r.tempPassword}`)
    }
    console.log('═'.repeat(80))
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
