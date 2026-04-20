import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CryptoClient } from '~/crypto/session'
import { WorkerCryptoClient } from '~/lib/cryptoClient'
import { deleteNote, getAllNotes, getVaultMeta, putNote, setVaultMeta } from '~/lib/db'

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

  async function init() {
    status.value = (await getVaultMeta()) ? 'locked' : 'empty'
  }

  async function setup(password: string) {
    const params = await client.setup(password)
    await setVaultMeta({ v: 1, ...params })
    notes.value = []
    status.value = 'unlocked'
  }

  async function unlock(password: string): Promise<boolean> {
    const meta = await getVaultMeta()
    if (!meta) return false
    if (!(await client.unlock(password, meta))) return false
    await loadNotes()
    status.value = 'unlocked'
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
  }

  async function persist(note: Note) {
    const env = await client.seal(JSON.stringify({ title: note.title, body: note.body }), note.id)
    await putNote({ id: note.id, updatedAt: note.updatedAt, env })
  }

  return { status, notes, init, setup, unlock, lock, addNote, updateNote, removeNote }
})
