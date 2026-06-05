import { encryptContent, decryptContent } from '../email-encryptor'

describe('email-encryptor', () => {
  // Set a test encryption key for testing
  beforeAll(() => {
    const nacl = require('tweetnacl')
    const util = require('tweetnacl-util')
    process.env.EMAIL_ENCRYPTION_KEY = util.encodeBase64(nacl.randomBytes(32))
  })

  it('encryptContent returns string', () => {
    const encrypted = encryptContent('test content')
    expect(typeof encrypted).toBe('string')
    expect(encrypted.length).toBeGreaterThan(0)
  })

  it('decryptContent recovers original content', () => {
    const original = 'test content for encryption'
    const encrypted = encryptContent(original)
    const decrypted = decryptContent(encrypted)
    expect(decrypted).toBe(original)
  })

  it('throws error when key is not set', () => {
    const originalKey = process.env.EMAIL_ENCRYPTION_KEY
    delete process.env.EMAIL_ENCRYPTION_KEY

    expect(() => encryptContent('test')).toThrow('EMAIL_ENCRYPTION_KEY is not set')

    process.env.EMAIL_ENCRYPTION_KEY = originalKey
  })

  it('throws error on invalid decryption', () => {
    expect(() => decryptContent('invalid_base64_data')).toThrow()
  })
})
