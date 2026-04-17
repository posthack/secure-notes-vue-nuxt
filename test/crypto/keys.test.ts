import { describe, expect, it } from 'vitest'
import { deriveMasterKey, generateDek } from '~/crypto/keys'

const salt = () => crypto.getRandomValues(new Uint8Array(16))

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
