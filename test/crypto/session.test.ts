import { describe, expect, it } from 'vitest'
import { VaultSession } from '~/crypto/session'

describe('VaultSession', () => {
  it('setup, потом seal/open заметки', async () => {
    const s = new VaultSession()
    await s.setup('мастер-пароль')
    expect(s.unlocked).toBe(true)

    const env = await s.seal('тело заметки', 'note:1')
    expect(await s.open(env, 'note:1')).toBe('тело заметки')
  })

  it('unlock верным паролем открывает, неверным — нет', async () => {
    const meta = await new VaultSession().setup('верный')

    const wrong = new VaultSession()
    expect(await wrong.unlock('неверный', meta)).toBe(false)
    expect(wrong.unlocked).toBe(false)

    const right = new VaultSession()
    expect(await right.unlock('верный', meta)).toBe(true)
    expect(right.unlocked).toBe(true)
  })

  it('после lock работать с ключом нельзя', async () => {
    const s = new VaultSession()
    await s.setup('пароль')
    s.lock()
    expect(s.unlocked).toBe(false)
    await expect(s.seal('x', 'note:1')).rejects.toThrow()
  })

  // битая пара ключей нужна только для шаринга и не должна мешать открыть хранилище
  it('unlock открывает хранилище даже с повреждённым приватным ключом', async () => {
    const meta = await new VaultSession().setup('пароль')
    meta.privateKey!.ct = meta.privateKey!.ct.slice(0, -4) + 'AAAA'

    const s = new VaultSession()
    expect(await s.unlock('пароль', meta)).toBe(true)
    expect(s.unlocked).toBe(true)
    // заметки читаются, несмотря на битую пару
    const env = await s.seal('тело', 'note:1')
    expect(await s.open(env, 'note:1')).toBe('тело')
  })
})
