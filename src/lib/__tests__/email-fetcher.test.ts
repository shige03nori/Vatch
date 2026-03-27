/** @jest-environment node */

// imap-simple と mailparser をモック
const mockConnect = jest.fn()
const mockOpenBox = jest.fn()
const mockSearch = jest.fn()
const mockEnd = jest.fn()

jest.mock('imap-simple', () => ({
  connect: (...a: unknown[]) => mockConnect(...a),
}))

const mockSimpleParser = jest.fn()
jest.mock('mailparser', () => ({
  simpleParser: (...a: unknown[]) => mockSimpleParser(...a),
}))

import { fetchUnreadEmails } from '../email-fetcher'

const config = {
  imapHost: 'imap.example.com',
  imapPort: 993,
  imapUser: 'user@example.com',
  imapPass: 'pass',
}

function makeConnection() {
  return { openBox: mockOpenBox, search: mockSearch, end: mockEnd }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockConnect.mockResolvedValue(makeConnection())
  mockOpenBox.mockResolvedValue(undefined)
  mockEnd.mockReturnValue(undefined)
})

describe('fetchUnreadEmails - attachments', () => {
  it('returns empty attachments array when no attachments', async () => {
    mockSearch.mockResolvedValueOnce([{ parts: [{ which: '', body: 'raw' }] }])
    mockSimpleParser.mockResolvedValueOnce({
      messageId: '<id1>',
      from: { value: [{ name: 'Sender', address: 'sender@example.com' }] },
      subject: 'テスト',
      text: '本文',
      date: new Date(),
      attachments: [],
    })

    const results = await fetchUnreadEmails(config)
    expect(results[0].attachments).toEqual([])
  })

  it('extracts PDF attachment', async () => {
    mockSearch.mockResolvedValueOnce([{ parts: [{ which: '', body: 'raw' }] }])
    mockSimpleParser.mockResolvedValueOnce({
      messageId: '<id2>',
      from: { value: [{ address: 'sender@example.com' }] },
      subject: 'テスト',
      text: '本文',
      date: new Date(),
      attachments: [
        {
          filename: '経歴書.pdf',
          content: Buffer.from('pdf content'),
          contentType: 'application/pdf',
        },
      ],
    })

    const results = await fetchUnreadEmails(config)
    expect(results[0].attachments).toHaveLength(1)
    expect(results[0].attachments[0].filename).toBe('経歴書.pdf')
    expect(results[0].attachments[0].contentType).toBe('application/pdf')
  })

  it('extracts DOCX attachment with correct contentType', async () => {
    mockSearch.mockResolvedValueOnce([{ parts: [{ which: '', body: 'raw' }] }])
    mockSimpleParser.mockResolvedValueOnce({
      messageId: '<id3>',
      from: { value: [{ address: 'sender@example.com' }] },
      subject: 'テスト',
      text: '本文',
      date: new Date(),
      attachments: [
        {
          filename: '職務経歴書.docx',
          content: Buffer.from('docx content'),
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      ],
    })

    const results = await fetchUnreadEmails(config)
    expect(results[0].attachments).toHaveLength(1)
    expect(results[0].attachments[0].filename).toBe('職務経歴書.docx')
  })

  it('extracts DOCX with octet-stream contentType via filename fallback', async () => {
    mockSearch.mockResolvedValueOnce([{ parts: [{ which: '', body: 'raw' }] }])
    mockSimpleParser.mockResolvedValueOnce({
      messageId: '<id4>',
      from: { value: [{ address: 'sender@example.com' }] },
      subject: 'テスト',
      text: '本文',
      date: new Date(),
      attachments: [
        {
          filename: '経歴書.docx',
          content: Buffer.from('docx content'),
          contentType: 'application/octet-stream',
        },
      ],
    })

    const results = await fetchUnreadEmails(config)
    expect(results[0].attachments).toHaveLength(1)
    expect(results[0].attachments[0].filename).toBe('経歴書.docx')
  })

  it('extracts DOCX with application/zip contentType via filename fallback', async () => {
    mockSearch.mockResolvedValueOnce([{ parts: [{ which: '', body: 'raw' }] }])
    mockSimpleParser.mockResolvedValueOnce({
      messageId: '<id5>',
      from: { value: [{ address: 'sender@example.com' }] },
      subject: 'テスト',
      text: '本文',
      date: new Date(),
      attachments: [
        {
          filename: '経歴書.docx',
          content: Buffer.from('docx content'),
          contentType: 'application/zip',
        },
      ],
    })

    const results = await fetchUnreadEmails(config)
    expect(results[0].attachments).toHaveLength(1)
    expect(results[0].attachments[0].filename).toBe('経歴書.docx')
  })

  it('ignores unsupported attachment formats (e.g. xlsx)', async () => {
    mockSearch.mockResolvedValueOnce([{ parts: [{ which: '', body: 'raw' }] }])
    mockSimpleParser.mockResolvedValueOnce({
      messageId: '<id5>',
      from: { value: [{ address: 'sender@example.com' }] },
      subject: 'テスト',
      text: '本文',
      date: new Date(),
      attachments: [
        {
          filename: 'data.xlsx',
          content: Buffer.from('xlsx'),
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    })

    const results = await fetchUnreadEmails(config)
    expect(results[0].attachments).toEqual([])
  })
})
