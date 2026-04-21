import { describe, expect, it } from 'vitest'
import { mergeNotes, type SyncEntry } from '~/lib/sync'

const e = (id: string, updatedAt: number, extra: Partial<SyncEntry> = {}): SyncEntry => ({
  id,
  updatedAt,
  env: { v: 1, wrappedKey: 'w', iv: 'i', ct: id + updatedAt },
  ...extra,
})

describe('mergeNotes (last-write-wins)', () => {
  it('локальная новее — уходит в push, серверная новее — в pull', () => {
    const local = [e('a', 5), e('b', 1), e('c', 9)]
    const remote = [e('a', 2), e('b', 8)]

    const { push, pull } = mergeNotes(local, remote)
    // a: локальная новее -> push; c: только локально -> push
    expect(push.map((x) => x.id).sort()).toEqual(['a', 'c'])
    // b: серверная новее -> pull
    expect(pull.map((x) => x.id)).toEqual(['b'])
  })

  it('серверный тумбстоун новее — приходит в pull как удаление', () => {
    const local = [e('a', 3)]
    const remote = [e('a', 7, { deleted: true })]

    const { push, pull } = mergeNotes(local, remote)
    expect(push).toHaveLength(0)
    expect(pull[0]).toMatchObject({ id: 'a', deleted: true })
  })

  it('одинаковый updatedAt — ничего не двигаем', () => {
    const { push, pull } = mergeNotes([e('a', 4)], [e('a', 4)])
    expect(push).toHaveLength(0)
    expect(pull).toHaveLength(0)
  })
})
