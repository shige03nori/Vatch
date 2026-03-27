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
  const connection = await imaps.connect({
    imap: {
      host: config.imapHost,
      port: config.imapPort,
      user: config.imapUser,
      password: config.imapPass,
      tls: config.imapPort === 993,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
    },
  })

  await connection.openBox('INBOX')

  const since = new Date()
  since.setDate(since.getDate() - 2)
  since.setHours(0, 0, 0, 0)

  const searchCriteria = ['UNSEEN', ['SINCE', since]]
  const fetchOptions = { bodies: ['HEADER', 'TEXT', ''], markSeen: true }

  const messages = await connection.search(searchCriteria, fetchOptions)
  connection.end()

  const results: FetchedEmail[] = []

  for (const message of messages) {
    const all = message.parts.find((p) => p.which === '')
    if (!all) continue

    const parsed = await simpleParser(all.body as string)
    const from = parsed.from?.value[0]

    results.push({
      messageId:   parsed.messageId ?? null,
      from:        from?.name ?? from?.address ?? '',
      fromEmail:   from?.address ?? '',
      subject:     parsed.subject ?? '(件名なし)',
      bodyText:    parsed.text ?? '',
      receivedAt:  parsed.date ?? new Date(),
      attachments: extractAttachments(parsed),
    })
  }

  return results
}
