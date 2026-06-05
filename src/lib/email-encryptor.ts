import nacl from 'tweetnacl'
import { encodeBase64, decodeBase64 } from 'tweetnacl-util'

// 暗号化キーは環境変数から取得（32バイト）
const getEncryptionKey = (): Uint8Array => {
  const keyStr = process.env.EMAIL_ENCRYPTION_KEY
  if (!keyStr) {
    throw new Error('EMAIL_ENCRYPTION_KEY is not set')
  }
  return decodeBase64(keyStr)
}

export function encryptContent(content: string): string {
  const key = getEncryptionKey()
  const plaintext = new Uint8Array(Buffer.from(content, 'utf-8'))
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength)
  const ciphertext = nacl.secretbox(plaintext, nonce, key)

  if (!ciphertext) {
    throw new Error('Encryption failed')
  }

  // nonce + ciphertext を結合して Base64 エンコード
  const combined = new Uint8Array(nonce.length + ciphertext.length)
  combined.set(nonce)
  combined.set(ciphertext, nonce.length)

  return encodeBase64(combined)
}

export function decryptContent(encrypted: string): string {
  const key = getEncryptionKey()
  const combined = decodeBase64(encrypted)

  const nonce = combined.slice(0, nacl.secretbox.nonceLength)
  const ciphertext = combined.slice(nacl.secretbox.nonceLength)

  const plaintext = nacl.secretbox.open(ciphertext, nonce, key)
  if (!plaintext) {
    throw new Error('Decryption failed')
  }

  return Buffer.from(plaintext).toString('utf-8')
}
