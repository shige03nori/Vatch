// src/lib/email-fetcher.ts
import imaps from 'imap-simple'
import { simpleParser } from 'mailparser'

export type FetchedEmail = {
  messageId: string | null
  from: string
  fromEmail: string
  subject: string
  bodyText: string
  receivedAt: Date
}

export type ImapConfig = {
  imapHost: string
  imapPort: number
  imapUser: string
  imapPass: string
}

export async function fetchUnreadEmails(config: ImapConfig): Promise<FetchedEmail[]> {
  const connection = await imaps.connect({
    imap: {
      host: config.imapHost,
      port: config.imapPort,
      user: config.imapUser,
      password: config.imapPass,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
    },
  })

  await connection.openBox('INBOX')

  const searchCriteria = ['UNSEEN']
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
      messageId: parsed.messageId ?? null,
      from:      from?.name ?? from?.address ?? '',
      fromEmail: from?.address ?? '',
      subject:   parsed.subject ?? '(件名なし)',
      bodyText:  parsed.text ?? '',
      receivedAt: parsed.date ?? new Date(),
    })
  }

  return results
}
