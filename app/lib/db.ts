import { type DBSchema, type IDBPDatabase, openDB } from 'idb'
import type { ItemEnvelope } from '~/crypto'

export interface VaultMeta {
  v: 1
  salt: string
  iterations: number
  verifier: ItemEnvelope
}

export interface StoredNote {
  id: string
  updatedAt: number
  env: ItemEnvelope
}

interface Schema extends DBSchema {
  vault: { key: string; value: VaultMeta }
  notes: { key: string; value: StoredNote }
}

const DB_NAME = 'secure-notes'
const META_KEY = 'meta'
let dbp: Promise<IDBPDatabase<Schema>> | null = null

function db() {
  if (!dbp) {
    dbp = openDB<Schema>(DB_NAME, 1, {
      upgrade(d) {
        d.createObjectStore('vault')
        d.createObjectStore('notes', { keyPath: 'id' })
      },
    })
  }
  return dbp
}

export async function getVaultMeta(): Promise<VaultMeta | undefined> {
  return (await db()).get('vault', META_KEY)
}

export async function setVaultMeta(meta: VaultMeta): Promise<void> {
  await (await db()).put('vault', meta, META_KEY)
}

export async function getAllNotes(): Promise<StoredNote[]> {
  return (await db()).getAll('notes')
}

export async function putNote(note: StoredNote): Promise<void> {
  await (await db()).put('notes', note)
}

export async function deleteNote(id: string): Promise<void> {
  await (await db()).delete('notes', id)
}

export async function resetDb(): Promise<void> {
  const d = await db()
  await d.clear('vault')
  await d.clear('notes')
}
