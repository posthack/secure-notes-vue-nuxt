import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { deleteNote, getAllNotes, getVaultMeta, putNote, resetDb, setVaultMeta } from '~/lib/db'
import type { ItemEnvelope } from '~/crypto'

const env = (ct: string): ItemEnvelope => ({ v: 1, wrappedKey: 'w', iv: 'i', ct })

afterEach(async () => {
  await resetDb()
})

describe('idb-слой', () => {
  it('vault meta пишется и читается', async () => {
    expect(await getVaultMeta()).toBeUndefined()
    await setVaultMeta({ v: 1, salt: 'c2FsdA==', iterations: 600_000, verifier: env('v') })
    const meta = await getVaultMeta()
    expect(meta?.iterations).toBe(600_000)
    expect(meta?.salt).toBe('c2FsdA==')
  })

  it('заметки складываются, читаются списком и удаляются', async () => {
    await putNote({ id: 'a', updatedAt: 1, env: env('a') })
    await putNote({ id: 'b', updatedAt: 2, env: env('b') })
    expect((await getAllNotes()).map((n) => n.id).sort()).toEqual(['a', 'b'])

    await deleteNote('a')
    const rest = await getAllNotes()
    expect(rest.map((n) => n.id)).toEqual(['b'])
  })
})
