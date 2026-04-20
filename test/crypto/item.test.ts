import { beforeAll, describe, expect, it } from 'vitest'
import { generateDek } from '~/crypto/keys'
import { decryptItem, encryptItem } from '~/crypto/item'

const enc = (s: string) => new TextEncoder().encode(s)
const dec = (b: ArrayBuffer | Uint8Array) => new TextDecoder().decode(b)

let dek: CryptoKey
beforeAll(async () => {
  dek = await generateDek()
})

describe('encrypt/decrypt элемента', () => {
  it('round-trip с метаданными в aad', async () => {
    const aad = enc('note:42')
    const sealed = await encryptItem(dek, enc('текст заметки'), aad)
    const plain = await decryptItem(dek, sealed, aad)
    expect(dec(plain)).toBe('текст заметки')
  })

  it('порча шифртекста ломает расшифровку', async () => {
    const sealed = await encryptItem(dek, enc('важное'))
    sealed.ciphertext[0] ^= 0xff
    await expect(decryptItem(dek, sealed)).rejects.toThrow()
  })

  it('подмена aad ломает расшифровку', async () => {
    const sealed = await encryptItem(dek, enc('важное'), enc('note:1'))
    await expect(decryptItem(dek, sealed, enc('note:2'))).rejects.toThrow()
  })

  it('каждый вызов даёт свежий iv', async () => {
    const a = await encryptItem(dek, enc('одно и то же'))
    const b = await encryptItem(dek, enc('одно и то же'))
    expect(a.iv).not.toEqual(b.iv)
    expect(a.ciphertext).not.toEqual(b.ciphertext)
  })
})
