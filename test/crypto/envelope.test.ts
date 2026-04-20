import { describe, expect, it } from 'vitest'
import { deriveMasterKey } from '~/crypto/keys'
import { openString, sealString } from '~/crypto/envelope'

const enc = (s: string) => new TextEncoder().encode(s)
const key = () => deriveMasterKey('correct horse', crypto.getRandomValues(new Uint8Array(16)))

describe('envelope', () => {
  it('seal → JSON → open возвращает исходный текст', async () => {
    const mk = await key()
    const env = await sealString(mk, 'моя заметка', enc('note:1'))
    // envelope должен переживать сериализацию в хранилище
    const restored = JSON.parse(JSON.stringify(env))
    expect(await openString(mk, restored, enc('note:1'))).toBe('моя заметка')
  })

  it('это чистый json: версия и строки', async () => {
    const env = await sealString(await key(), 'x')
    expect(env.v).toBe(1)
    expect(typeof env.wrappedKey).toBe('string')
    expect(typeof env.iv).toBe('string')
    expect(typeof env.ct).toBe('string')
  })

  it('порча шифртекста в envelope ломает open', async () => {
    const mk = await key()
    const env = await sealString(mk, 'важное')
    env.ct = env.ct.slice(0, -4) + 'AAAA'
    await expect(openString(mk, env)).rejects.toThrow()
  })
})
