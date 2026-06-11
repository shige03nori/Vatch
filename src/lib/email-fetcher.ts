// src/lib/email-fetcher.ts
import imaps from 'imap-simple'
import { simpleParser } from 'mailparser'

const ACCEPTED_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const OCTET_STREAM_TYPES = new Set([
  'application/octet-stream',
  'application/zip',
])

type FetchedAttachment = {
  filename: string
  content: Buffer
  contentType: string
}

export type FetchedEmail = {
  messageId: string | null
  inReplyTo: string | null
  from: string
  fromEmail: string
  subject: string
  bodyText: string
  receivedAt: Date
  attachments: FetchedAttachment[]
}

export type ImapConfig = {
  imapHost: string
  imapPort: number
  imapUser: string
  imapPass: string
  imapFolders?: string[]
}

function extractAttachments(parsed: Awaited<ReturnType<typeof simpleParser>>): FetchedAttachment[] {
  if (!parsed.attachments) return []

  return parsed.attachments
    .filter((att) => {
      const ct = att.contentType ?? ''
      const fn = att.filename ?? ''
      if (ACCEPTED_CONTENT_TYPES.has(ct)) return true
      if (OCTET_STREAM_TYPES.has(ct) && fn.toLowerCase().endsWith('.docx')) return true
      return false
    })
    .map((att) => ({
      filename: att.filename ?? 'attachment',
      content: att.content as Buffer,
      contentType: att.contentType ?? '',
    }))
}

export async function fetchUnreadEmails(config: ImapConfig): Promise<FetchedEmail[]> {
  const folders = config.imapFolders && config.imapFolders.length > 0 ? config.imapFolders : ['INBOX']

  const connection = await imaps.connect({
    imap: {
      host: config.imapHost,
      port: config.imapPort,
      user: config.imapUser,
      password: config.imapPass,
      tls: config.imapPort === 993,
      // port 143 (STARTTLS) は autotls で自動アップグレード
      ...(config.imapPort !== 993 ? { autotls: 'always' as const } : {}),
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
    },
  })

  const since = new Date()
  since.setDate(since.getDate() - 3)
  since.setHours(0, 0, 0, 0)

  const searchCriteria = [['SINCE', since]]
  const fetchOptions = { bodies: ['HEADER', 'TEXT', ''], markSeen: false }

  const allResults: FetchedEmail[] = []
  const seenMessageIds = new Set<string>()

  for (const folder of folders) {
    try {
      await connection.openBox(folder)
    } catch {
      console.warn(`[fetcher] Failed to open folder "${folder}", skipping`)
      continue
    }

    const messages = await connection.search(searchCriteria, fetchOptions)

    for (const message of messages) {
      const all = message.parts.find((p) => p.which === '')
      if (!all) continue

      const parsed = await simpleParser(all.body as string)
      const msgId = parsed.messageId ?? null

      // 複数フォルダで同じメールが重複しないようにする
      if (msgId && seenMessageIds.has(msgId)) continue
      if (msgId) seenMessageIds.add(msgId)

      const from = parsed.from?.value[0]
      allResults.push({
        messageId:   msgId,
        inReplyTo:   (parsed.inReplyTo && typeof parsed.inReplyTo === 'string' ? parsed.inReplyTo : null),
        from:        from?.name ?? from?.address ?? '',
        fromEmail:   from?.address ?? '',
        subject:     parsed.subject ?? '(件名なし)',
        bodyText:    parsed.text ?? '',
        receivedAt:  parsed.date ?? new Date(),
        attachments: extractAttachments(parsed),
      })
    }
  }

  connection.end()
  return allResults
}
