import { beforeAll, describe, expect, it } from 'vitest'
import { fromBase64, toBase64 } from '~/crypto/base64'
import { sealString } from '~/crypto/envelope'
import { deriveMasterKey } from '~/crypto/keys'
import {
  exportPublicKey,
  generateKeypair,
  importPublicKey,
  openPrivateKey,
  openSharedNote,
  prepareShare,
  sealPrivateKey,
} from '~/crypto/share'

// владелец шифрует под своим мастер-ключом, получатель — через свою пару ключей
let master: CryptoKey
beforeAll(async () => {
  master = await deriveMasterKey('владелец', new Uint8Array(16))
})

describe('пара ключей и шаринг', () => {
  it('публичный ключ экспортируется и импортируется обратно', async () => {
    const kp = await generateKeypair()
    const spki = await exportPublicKey(kp.publicKey)
    const back = await importPublicKey(spki)
    expect(back.type).toBe('public')
  })

  it('приватный ключ шифруется мастером и восстанавливается рабочим', async () => {
    const kp = await generateKeypair()
    const env = await sealPrivateKey(master, kp.privateKey)
    expect(JSON.stringify(env)).not.toContain('privateKey')
    const priv = await openPrivateKey(master, env)
    // проверяем, что ключ живой: шифруем публичным, расшифровываем восстановленным приватным
    const ct = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      kp.publicKey,
      new TextEncoder().encode('пинг'),
    )
    const pt = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, priv, ct)
    expect(new TextDecoder().decode(pt)).toBe('пинг')
  })

  it('получатель расшифровывает пошаренную заметку своим приватным ключом', async () => {
    const bob = await generateKeypair()
    const noteEnv = await sealString(master, 'секрет для боба', new TextEncoder().encode('note-1'))

    const share = await prepareShare(master, 'note-1', noteEnv, bob.publicKey)
    const text = await openSharedNote(bob.privateKey, share)
    expect(text).toBe('секрет для боба')
  })

  it('чужим приватным ключом пошаренную заметку не открыть', async () => {
    const bob = await generateKeypair()
    const eve = await generateKeypair()
    const noteEnv = await sealString(master, 'только для боба', new TextEncoder().encode('n'))
    const share = await prepareShare(master, 'n', noteEnv, bob.publicKey)
    await expect(openSharedNote(eve.privateKey, share)).rejects.toThrow()
  })

  it('порча обёртки ключа ломает открытие', async () => {
    const bob = await generateKeypair()
    const noteEnv = await sealString(master, 'x', new TextEncoder().encode('n'))
    const share = await prepareShare(master, 'n', noteEnv, bob.publicKey)
    const wrapped = fromBase64(share.wrappedKey)
    wrapped[0] ^= 0xff
    share.wrappedKey = toBase64(wrapped)
    await expect(openSharedNote(bob.privateKey, share)).rejects.toThrow()
  })

  it('подмена noteId (aad) ломает открытие', async () => {
    const bob = await generateKeypair()
    const noteEnv = await sealString(master, 'x', new TextEncoder().encode('note-1'))
    const share = await prepareShare(master, 'note-1', noteEnv, bob.publicKey)
    share.noteId = 'note-2'
    await expect(openSharedNote(bob.privateKey, share)).rejects.toThrow()
  })

  it('в шаре не лежит обёртка под мастер-ключом владельца', async () => {
    const bob = await generateKeypair()
    const noteEnv = await sealString(master, 'x', new TextEncoder().encode('note-1'))
    const share = await prepareShare(master, 'note-1', noteEnv, bob.publicKey)
    // dek завёрнут под rsa получателя, а не aes-kw владельца
    expect(share.wrappedKey).not.toBe(noteEnv.wrappedKey)
    expect(share.ct).toBe(noteEnv.ct)
  })
})
