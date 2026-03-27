/** @jest-environment node */
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { getFileStorage } from '../file-storage'

describe('LocalStorage', () => {
  let tmpDir: string
  let origEnv: string | undefined
  let origCwd: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vatch-test-'))
    origEnv = process.env.STORAGE_BACKEND
    origCwd = process.cwd()
    // シングルトンをリセットして次のテストに持ち越さない
    const { _resetFileStorageForTest } = await import('../file-storage')
    _resetFileStorageForTest()
    // process.cwd() をモックして tmpDir を返すように差し替える
    jest.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    delete process.env.STORAGE_BACKEND
  })

  afterEach(async () => {
    process.env.STORAGE_BACKEND = origEnv
    jest.spyOn(process, 'cwd').mockReturnValue(origCwd)
    jest.restoreAllMocks()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('saves a file and the file exists on disk', async () => {
    const storage = getFileStorage()
    const key = 'resumes/test-file.pdf'
    const buffer = Buffer.from('dummy pdf content')

    await storage.save(key, buffer)

    const filePath = path.join(tmpDir, 'uploads', key)
    const content = await fs.readFile(filePath)
    expect(content).toEqual(buffer)
  })

  it('creates the directory if it does not exist', async () => {
    const storage = getFileStorage()
    // uploads/resumes/ は存在しない状態から save する
    await expect(storage.save('resumes/new.pdf', Buffer.from('x'))).resolves.not.toThrow()
    const stat = await fs.stat(path.join(tmpDir, 'uploads', 'resumes'))
    expect(stat.isDirectory()).toBe(true)
  })

  it('deletes a file', async () => {
    const storage = getFileStorage()
    const key = 'resumes/to-delete.pdf'
    await storage.save(key, Buffer.from('content'))

    await storage.delete(key)

    const filePath = path.join(tmpDir, 'uploads', key)
    await expect(fs.access(filePath)).rejects.toThrow()
  })

  it('delete does not throw if file does not exist', async () => {
    const storage = getFileStorage()
    await expect(storage.delete('resumes/nonexistent.pdf')).resolves.not.toThrow()
  })

  it('getUrl returns a path string containing the key', () => {
    const storage = getFileStorage()
    const url = storage.getUrl('resumes/abc.pdf')
    expect(url).toContain('resumes/abc.pdf')
  })
})
