/** @jest-environment node */
import { encrypt, decrypt } from '../crypto'

describe('crypto', () => {
  const key = '0'.repeat(64) // 32バイト = 64文字の16進数

  it('encrypt returns a non-empty string different from input', () => {
    const encrypted = encrypt('secret-password', key)
    expect(encrypted).toBeTruthy()
    expect(encrypted).not.toBe('secret-password')
  })

  it('decrypt recovers the original string', () => {
    const original = 'my-imap-password'
    const encrypted = encrypt(original, key)
    expect(decrypt(encrypted, key)).toBe(original)
  })

  it('same input produces different ciphertext each time (random IV)', () => {
    const a = encrypt('same', key)
    const b = encrypt('same', key)
    expect(a).not.toBe(b)
  })

  it('decrypt throws on tampered ciphertext', () => {
    const encrypted = encrypt('data', key)
    const tampered = encrypted.slice(0, -2) + 'XX'
    expect(() => decrypt(tampered, key)).toThrow()
  })
})
