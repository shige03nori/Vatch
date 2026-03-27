// src/lib/file-storage.ts
import * as fs from 'fs/promises'
import * as path from 'path'

type StorageBackend = {
  save(key: string, buffer: Buffer): Promise<void>
  getUrl(key: string): string
  delete(key: string): Promise<void>
}

class LocalStorage implements StorageBackend {
  private get baseDir(): string {
    return path.join(process.cwd(), 'uploads')
  }

  async save(key: string, buffer: Buffer): Promise<void> {
    const filePath = path.join(this.baseDir, key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, buffer)
  }

  getUrl(key: string): string {
    return path.join(this.baseDir, key).split(path.sep).join('/')
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.baseDir, key)
    try {
      await fs.unlink(filePath)
    } catch {
      // ファイルが存在しない場合は無視
    }
  }
}

let _storage: StorageBackend | null = null

export function getFileStorage(): StorageBackend {
  if (_storage) return _storage
  const backend = process.env.STORAGE_BACKEND ?? 'local'
  if (backend === 'local') {
    _storage = new LocalStorage()
  } else {
    throw new Error(`Unsupported STORAGE_BACKEND: ${backend}. Currently only 'local' is supported.`)
  }
  return _storage
}

// テスト用にリセット可能にする
export function _resetFileStorageForTest(): void {
  _storage = null
}
