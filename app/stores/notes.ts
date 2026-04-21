import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CryptoClient } from '~/crypto/session'
import { WorkerCryptoClient } from '~/lib/cryptoClient'
import {
  deleteNote,
  getAllNotes,
  getVaultMeta,
  putNote,
  setVaultMeta,
  type VaultMeta,
} from '~/lib/db'
import { pullVault, pushNote, pushVault, syncNotes } from '~/lib/sync'

const TOMBSTONE_ENV = { v: 1, wrappedKey: '', iv: '', ct: '' } as const

export interface Note {
  id: string
  title: string
  body: string
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
  }

  async function setup(password: string) {
    const params = await client.setup(password)
    const meta: VaultMeta = { v: 1, ...params }
    await setVaultMeta(meta)
    if (remote.value) await pushVault(meta)
    notes.value = []
    status.value = 'unlocked'
  }

  async function unlock(password: string): Promise<boolean> {
    const meta = await getVaultMeta()
    if (!meta) return false
    if (!(await client.unlock(password, meta))) return false
    await loadNotes()
    status.value = 'unlocked'
    await sync()
    return true
  }

  function lock() {
    client.lock()
    notes.value = []
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
  }

  async function persist(note: Note) {
    const env = await client.seal(JSON.stringify({ title: note.title, body: note.body }), note.id)
    await putNote({ id: note.id, updatedAt: note.updatedAt, env })
    if (remote.value) await pushNote({ id: note.id, env, updatedAt: note.updatedAt })
  }

  return {
    status,
    notes,
    remote,
    init,
    enableSync,
    sync,
    setup,
    unlock,
    lock,
    addNote,
    updateNote,
    removeNote,
  }
})
