import { beforeAll, describe, expect, it } from 'vitest'
import { deriveMasterKey } from '~/crypto/keys'
import { CHUNK_BYTES, openFile, openFileMeta, sealFile } from '~/crypto/file'

const bytes = (n: number, seed = 7): Uint8Array => {
  const a = new Uint8Array(n)
  for (let i = 0; i < n; i++) a[i] = (i * 31 + seed) & 0xff
  return a
}

let master: CryptoKey
beforeAll(async () => {
  master = await deriveMasterKey('мастер', new Uint8Array(16))
})

const meta = { name: 'секрет.pdf', type: 'application/pdf', size: 0 }

describe('шифрование файла', () => {
  it('round-trip маленького файла (в один чанк)', async () => {
    const data = bytes(500)
    const env = await sealFile(master, 'f1', { ...meta, size: data.length }, data)
    const out = await openFile(master, 'f1', env)
    expect(out.data).toEqual(data)
    expect(out.meta.name).toBe('секрет.pdf')
    expect(out.meta.type).toBe('application/pdf')
  })

  it('round-trip файла в несколько чанков', async () => {
    const data = bytes(CHUNK_BYTES * 2 + 123)
    const env = await sealFile(master, 'big', { ...meta, size: data.length }, data)
    expect(env.chunks.length).toBe(3)
    const out = await openFile(master, 'big', env)
    expect(out.data).toEqual(data)
  })

  it('пустой файл', async () => {
    const data = new Uint8Array(0)
    const env = await sealFile(master, 'z', { ...meta, size: 0 }, data)
    const out = await openFile(master, 'z', env)
    expect(out.data.length).toBe(0)
  })

  it('метаданные читаются без расшифровки содержимого', async () => {
    const data = bytes(CHUNK_BYTES + 1)
    const env = await sealFile(master, 'm', { ...meta, size: data.length }, data)
    const only = await openFileMeta(master, 'm', { ...env, chunks: [] })
    expect(only.name).toBe('секрет.pdf')
    expect(only.size).toBe(data.length)
  })

  it('имя файла не лежит в открытом виде в конверте', async () => {
    const env = await sealFile(master, 'f', { ...meta, size: 3 }, bytes(3))
    expect(JSON.stringify(env)).not.toContain('секрет')
  })

  it('чужой fileId ломает расшифровку (aad)', async () => {
    const env = await sealFile(master, 'right', { ...meta, size: 10 }, bytes(10))
    await expect(openFile(master, 'wrong', env)).rejects.toThrow()
  })

  it('порча чанка ломает расшифровку', async () => {
    const env = await sealFile(master, 'f', { ...meta, size: 50 }, bytes(50))
    const ct = env.chunks[0]!.ct
    env.chunks[0]!.ct = ct.slice(0, -2) + (ct.endsWith('A') ? 'B' : 'A') + '='
    await expect(openFile(master, 'f', env)).rejects.toThrow()
  })

  it('перестановка чанков местами ломает расшифровку', async () => {
    const data = bytes(CHUNK_BYTES * 2)
    const env = await sealFile(master, 'f', { ...meta, size: data.length }, data)
    ;[env.chunks[0], env.chunks[1]] = [env.chunks[1]!, env.chunks[0]!]
    await expect(openFile(master, 'f', env)).rejects.toThrow()
  })

  it('обрезка последнего чанка детектится по размеру', async () => {
    const data = bytes(CHUNK_BYTES + 100)
    const env = await sealFile(master, 'f', { ...meta, size: data.length }, data)
    env.chunks.pop()
    await expect(openFile(master, 'f', env)).rejects.toThrow()
  })

  it('у каждого чанка свой iv', async () => {
    const env = await sealFile(
      master,
      'f',
      { ...meta, size: CHUNK_BYTES * 2 },
      bytes(CHUNK_BYTES * 2),
    )
    expect(env.chunks[0]!.iv).not.toBe(env.chunks[1]!.iv)
  })
})
