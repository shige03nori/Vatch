// src/lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // GCMの推奨IVサイズ
const TAG_LENGTH = 16

function getKey(hexKey: string): Buffer {
  return Buffer.from(hexKey, 'hex')
}

export function encrypt(plaintext: string, hexKey: string): string {
  const key = getKey(hexKey)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // iv + tag + encrypted を base64 にまとめて返す
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decrypt(ciphertext: string, hexKey: string): string {
  const key = getKey(hexKey)
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  // Buffer.concat でマルチバイト文字の文字化けを防ぐ
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
