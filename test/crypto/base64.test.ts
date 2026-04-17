import { describe, expect, it } from 'vitest'
import { fromBase64, toBase64 } from '~/crypto/base64'

describe('base64', () => {
  it('round-trip произвольных байтов', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(48))
    expect(fromBase64(toBase64(bytes))).toEqual(bytes)
  })

  it('пустой массив', () => {
    expect(toBase64(new Uint8Array(0))).toBe('')
    expect(fromBase64('')).toEqual(new Uint8Array(0))
  })
})
