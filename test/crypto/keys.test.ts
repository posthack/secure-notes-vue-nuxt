import { describe, expect, it } from 'vitest'
import { deriveMasterKey, generateDek, unwrapDek, wrapDek } from '~/crypto/keys'

const salt = () => crypto.getRandomValues(new Uint8Array(16))
const enc = new TextEncoder()
const dec = new TextDecoder()

describe('generateDek', () => {
  it('отдаёт извлекаемый AES-GCM ключ для шифрования', async () => {
    const dek = await generateDek()
    expect(dek.type).toBe('secret')
    expect((dek.algorithm as AesKeyAlgorithm).name).toBe('AES-GCM')
    expect(dek.extractable).toBe(true)
    expect(dek.usages).toContain('encrypt')
    expect(dek.usages).toContain('decrypt')
  })
})

describe('deriveMasterKey', () => {
  it('из пароля выводит неизвлекаемый AES-KW ключ для обёртки', async () => {
    const mk = await deriveMasterKey('correct horse battery staple', salt())
    expect((mk.algorithm as AesKeyAlgorithm).name).toBe('AES-KW')
    expect(mk.extractable).toBe(false)
    expect(mk.usages).toContain('wrapKey')
    expect(mk.usages).toContain('unwrapKey')
  })
})

describe('обёртка DEK', () => {
  it('обёрнутый мастер-ключом dek разворачивается тем же паролем', async () => {
    const s = salt()
    const mk = await deriveMasterKey('pw', s)
    const dek = await generateDek()
    const wrapped = await wrapDek(dek, mk)

    const mk2 = await deriveMasterKey('pw', s)
    const dek2 = await unwrapDek(wrapped, mk2)

    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dek, enc.encode('секрет'))
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, dek2, ct)
    expect(dec.decode(pt)).toBe('секрет')
  })

  it('неверный пароль не разворачивает обёртку', async () => {
    const s = salt()
    const mk = await deriveMasterKey('pw', s)
    const wrapped = await wrapDek(await generateDek(), mk)

    const wrong = await deriveMasterKey('другой пароль', s)
    await expect(unwrapDek(wrapped, wrong)).rejects.toThrow()
  })
})
