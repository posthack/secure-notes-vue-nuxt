import { describe, expect, it } from 'vitest'
import { generatePassword } from '~/lib/password'

describe('генератор паролей', () => {
  it('выдаёт пароль нужной длины', () => {
    expect(generatePassword(20)).toHaveLength(20)
    expect(generatePassword(8)).toHaveLength(8)
  })

  it('только из допустимого набора, без похожих символов', () => {
    const p = generatePassword(200)
    expect(p).toMatch(/^[A-Za-z0-9!@#$%^&*_\-+=?]+$/)
    // выкинуты визуально неотличимые: 0 O o 1 l I
    expect(p).not.toMatch(/[0Oo1lI]/)
  })

  it('два вызова дают разные пароли', () => {
    expect(generatePassword(24)).not.toBe(generatePassword(24))
  })
})
