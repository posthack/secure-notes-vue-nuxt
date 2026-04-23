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

  const fileBytes = new Uint8Array([1, 2, 3, 4, 5]) as Uint8Array<ArrayBuffer>

  it('вложение шифруется, переживает lock/unlock и читается обратно', async () => {
    const store = useNotesStore()
    await store.setup('мастер')
    const note = await store.addNote('с файлом', '')
    await store.addFile(note.id, 'ключи.txt', 'text/plain', fileBytes)
    expect(store.files).toHaveLength(1)
    expect(store.files[0]?.name).toBe('ключи.txt')
    expect(store.files[0]?.size).toBe(5)

    store.lock()
    expect(store.files).toHaveLength(0)

    await store.unlock('мастер')
    expect(store.files[0]?.name).toBe('ключи.txt')
    const read = await store.readFile(store.files[0]!.id)
    expect(read.data).toEqual(fileBytes)
    expect(read.type).toBe('text/plain')
  })

  it('удаление заметки уносит её вложения', async () => {
    const store = useNotesStore()
    await store.setup('мастер')
    const note = await store.addNote('a', '')
    await store.addFile(note.id, 'a.bin', 'application/octet-stream', fileBytes)
    expect(store.files).toHaveLength(1)

    await store.removeNote(note.id)
    expect(store.files).toHaveLength(0)
  })
})
