import { describe, expect, it } from 'vitest'

// весь проект держится на Web Crypto — если его нет, дальше нет смысла
describe('окружение', () => {
  it('web crypto доступен', () => {
    expect(globalThis.crypto?.subtle).toBeDefined()
  })

  it('getRandomValues отдаёт разные байты', () => {
    const a = crypto.getRandomValues(new Uint8Array(16))
    const b = crypto.getRandomValues(new Uint8Array(16))
    expect(a).not.toEqual(b)
  })
})
