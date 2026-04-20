import 'fake-indexeddb/auto'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VaultSession } from '~/crypto/session'
import { resetDb } from '~/lib/db'
import { setCryptoClientFactory, useNotesStore } from '~/stores/notes'

beforeEach(() => {
  setActivePinia(createPinia())
  setCryptoClientFactory(() => new VaultSession())
})

afterEach(async () => {
  await resetDb()
})

describe('notes store', () => {
  it('init на пустом хранилище — статус empty', async () => {
    const store = useNotesStore()
    await store.init()
    expect(store.status).toBe('empty')
  })

  it('setup создаёт хранилище и разблокирует', async () => {
    const store = useNotesStore()
    await store.setup('мастер')
    expect(store.status).toBe('unlocked')
  })

  it('заметка шифруется, сохраняется и переживает lock/unlock', async () => {
    const store = useNotesStore()
    await store.setup('мастер')
    await store.addNote('Заголовок', 'секретное тело')
    expect(store.notes).toHaveLength(1)

    store.lock()
    expect(store.status).toBe('locked')
    expect(store.notes).toHaveLength(0)

    const ok = await store.unlock('мастер')
    expect(ok).toBe(true)
    expect(store.notes[0]?.title).toBe('Заголовок')
    expect(store.notes[0]?.body).toBe('секретное тело')
  })

  it('неверный пароль не разблокирует', async () => {
    const store = useNotesStore()
    await store.setup('мастер')
    store.lock()
    expect(await store.unlock('чужой')).toBe(false)
    expect(store.status).toBe('locked')
  })

  it('редактирование и удаление', async () => {
    const store = useNotesStore()
    await store.setup('мастер')
    await store.addNote('a', 'один')
    const id = store.notes[0]!.id

    await store.updateNote(id, { body: 'два' })
    expect(store.notes[0]?.body).toBe('два')

    await store.removeNote(id)
    expect(store.notes).toHaveLength(0)
  })
})
