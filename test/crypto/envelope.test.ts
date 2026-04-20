import { describe, expect, it } from 'vitest'
import { deriveMasterKey } from '~/crypto/keys'
import { openString, rewrapEnvelope, sealString } from '~/crypto/envelope'

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

  it('смена пароля переворачивает обёртку, данные не перешифровываются', async () => {
    const oldMk = await deriveMasterKey('старый', crypto.getRandomValues(new Uint8Array(16)))
    const env = await sealString(oldMk, 'секрет')

    // при смене пароля обычно и соль новая
    const newMk = await deriveMasterKey('новый', crypto.getRandomValues(new Uint8Array(16)))
    const next = await rewrapEnvelope(env, oldMk, newMk)

    expect(next.iv).toBe(env.iv)
    expect(next.ct).toBe(env.ct)
    expect(next.wrappedKey).not.toBe(env.wrappedKey)

    expect(await openString(newMk, next)).toBe('секрет')
    await expect(openString(oldMk, next)).rejects.toThrow()
  })
})
