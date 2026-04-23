import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CryptoClient } from '~/crypto/session'
import { WorkerCryptoClient } from '~/lib/cryptoClient'
import {
  deleteFile,
  deleteNote,
  getAllFiles,
  getAllNotes,
  getFile,
  getVaultMeta,
  putFile,
  putNote,
  setVaultMeta,
  type VaultMeta,
} from '~/lib/db'
import {
  downloadFileContent,
  pullVault,
  pushFile,
  pushFileTombstone,
  pushNote,
  pushVault,
  syncFiles,
  syncNotes,
} from '~/lib/sync'

// разумный потолок для браузерного E2E — файл целиком проходит через память
export const MAX_FILE_BYTES = 25 * 1024 * 1024

const TOMBSTONE_ENV = { v: 1, wrappedKey: '', iv: '', ct: '' } as const

export const DEMO_PASSWORD = 'demo'
const DEMO_NOTES = [
  {
    title: 'Wi-Fi на даче',
    body: 'сеть: dacha-2g\nпароль: sosny-2019-lето',
  },
  {
    title: 'Загранпаспорт',
    body: '75 1234567, выдан 12.03.2022\nдействует до 12.03.2032',
  },
  {
    title: 'Что купить на выходных',
    body: 'краска для забора\nсаморезы 4x50\nдоски, 6 шт',
  },
]

export interface Note {
  id: string
  title: string
  body: string
  updatedAt: number
}

// в списке держим только метаданные; содержимое расшифровываем при скачивании
export interface FileItem {
  id: string
  noteId: string
  name: string
  type: string
  size: number
  updatedAt: number
}

type Status = 'loading' | 'empty' | 'locked' | 'unlocked'

let makeClient: () => CryptoClient = () => new WorkerCryptoClient()
export function setCryptoClientFactory(f: () => CryptoClient): void {
  makeClient = f
}

export const useNotesStore = defineStore('notes', () => {
  const client = makeClient()
  const status = ref<Status>('loading')
  const notes = ref<Note[]>([])
  const files = ref<FileItem[]>([])
  const remote = ref(false)

  async function init() {
    status.value = (await getVaultMeta()) ? 'locked' : 'empty'
  }

  // включаем синк после логина; на новом устройстве подтягиваем чужой vault.
  // смотрим на локальный vault, а не на status — иначе гонка с init()
  async function enableSync() {
    remote.value = true
    if (await getVaultMeta()) return
    const meta = await pullVault()
    if (meta) {
      await setVaultMeta(meta)
      status.value = 'locked'
    }
  }

  async function sync() {
    if (!remote.value) return
    if (await syncNotes()) await loadNotes()
    if (await syncFiles()) await loadFiles()
  }

  async function setup(password: string) {
    const params = await client.setup(password)
    const meta: VaultMeta = { v: 1, ...params }
    await setVaultMeta(meta)
    if (remote.value) await pushVault(meta)
    notes.value = []
    files.value = []
    status.value = 'unlocked'
  }

  // для витрины: хранилище с паролем demo и парой заметок
  async function loadDemo() {
    await setup(DEMO_PASSWORD)
    for (const n of DEMO_NOTES) await addNote(n.title, n.body)
  }

  async function unlock(password: string): Promise<boolean> {
    const meta = await getVaultMeta()
    if (!meta) return false
    if (!(await client.unlock(password, meta))) return false
    await loadNotes()
    await loadFiles()
    status.value = 'unlocked'
    await sync()
    return true
  }

  function lock() {
    client.lock()
    notes.value = []
    files.value = []
    status.value = 'locked'
  }

  async function loadNotes() {
    const stored = await getAllNotes()
    const open = stored.map(async (n) => {
      const data = JSON.parse(await client.open(n.env, n.id)) as { title: string; body: string }
      return { id: n.id, title: data.title, body: data.body, updatedAt: n.updatedAt }
    })
    notes.value = (await Promise.all(open)).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async function addNote(title: string, body: string): Promise<Note> {
    const note: Note = { id: crypto.randomUUID(), title, body, updatedAt: Date.now() }
    await persist(note)
    notes.value = [note, ...notes.value]
    return note
  }

  async function updateNote(id: string, patch: Partial<Pick<Note, 'title' | 'body'>>) {
    const note = notes.value.find((n) => n.id === id)
    if (!note) return
    Object.assign(note, patch, { updatedAt: Date.now() })
    await persist(note)
  }

  async function removeNote(id: string) {
    await deleteNote(id)
    notes.value = notes.value.filter((n) => n.id !== id)
    if (remote.value) {
      await pushNote({ id, env: { ...TOMBSTONE_ENV }, updatedAt: Date.now(), deleted: true })
    }
    // вложения заметки уносим вместе с ней
    for (const f of files.value.filter((f) => f.noteId === id)) await removeFile(f.id)
  }

  async function loadFiles() {
    const stored = await getAllFiles()
    const items = stored.map(async (f) => {
      const meta = await client.openFileMeta(f.id, f.env)
      return {
        id: f.id,
        noteId: f.noteId,
        name: meta.name,
        type: meta.type,
        size: meta.size,
        updatedAt: f.updatedAt,
      }
    })
    files.value = (await Promise.all(items)).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async function addFile(
    noteId: string,
    name: string,
    type: string,
    data: Uint8Array<ArrayBuffer>,
  ) {
    if (data.length > MAX_FILE_BYTES) throw new Error('файл слишком большой')
    const id = crypto.randomUUID()
    const updatedAt = Date.now()
    const env = await client.sealFile(id, { name, type, size: data.length }, data)
    await putFile({ id, noteId, updatedAt, env, content: true })
    if (remote.value) await pushFile({ id, noteId, updatedAt, env, content: true })
    files.value = [{ id, noteId, name, type, size: data.length, updatedAt }, ...files.value]
  }

  // расшифровка содержимого по требованию; на чужом устройстве сперва тянем чанки
  async function readFile(
    id: string,
  ): Promise<{ name: string; type: string; data: Uint8Array<ArrayBuffer> }> {
    let stored = await getFile(id)
    if (stored && !stored.content && remote.value) stored = await downloadFileContent(id)
    if (!stored) throw new Error('файл не найден')
    const { meta, data } = await client.openFile(id, stored.env)
    return { name: meta.name, type: meta.type, data }
  }

  async function removeFile(id: string) {
    const f = files.value.find((f) => f.id === id)
    await deleteFile(id)
    files.value = files.value.filter((f) => f.id !== id)
    if (remote.value && f) await pushFileTombstone(id, f.noteId)
  }

  async function persist(note: Note) {
    const env = await client.seal(JSON.stringify({ title: note.title, body: note.body }), note.id)
    await putNote({ id: note.id, updatedAt: note.updatedAt, env })
    if (remote.value) await pushNote({ id: note.id, env, updatedAt: note.updatedAt })
  }

  return {
    status,
    notes,
    files,
    remote,
    init,
    enableSync,
    sync,
    setup,
    loadDemo,
    unlock,
    lock,
    addNote,
    updateNote,
    removeNote,
    addFile,
    readFile,
    removeFile,
  }
})
