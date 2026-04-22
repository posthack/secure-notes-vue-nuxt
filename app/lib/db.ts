import { type DBSchema, type IDBPDatabase, openDB } from 'idb'
import type { FileEnvelope, ItemEnvelope } from '~/crypto'

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

// content=false — есть только метаданные (подтянули с сервера), чанки качаем при открытии
export interface StoredFile {
  id: string
  noteId: string
  updatedAt: number
  env: FileEnvelope
  content: boolean
}

interface Schema extends DBSchema {
  vault: { key: string; value: VaultMeta }
  notes: { key: string; value: StoredNote }
  files: { key: string; value: StoredFile; indexes: { noteId: string } }
}

const DB_NAME = 'secure-notes'
const META_KEY = 'meta'
let dbp: Promise<IDBPDatabase<Schema>> | null = null

function db() {
  if (!dbp) {
    dbp = openDB<Schema>(DB_NAME, 2, {
      upgrade(d, from) {
        if (from < 1) {
          d.createObjectStore('vault')
          d.createObjectStore('notes', { keyPath: 'id' })
        }
        if (from < 2) {
          d.createObjectStore('files', { keyPath: 'id' }).createIndex('noteId', 'noteId')
        }
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

export async function getAllFiles(): Promise<StoredFile[]> {
  return (await db()).getAll('files')
}

export async function putFile(file: StoredFile): Promise<void> {
  await (await db()).put('files', file)
}

export async function getFile(id: string): Promise<StoredFile | undefined> {
  return (await db()).get('files', id)
}

export async function deleteFile(id: string): Promise<void> {
  await (await db()).delete('files', id)
}

export async function resetDb(): Promise<void> {
  const d = await db()
  await d.clear('vault')
  await d.clear('notes')
  await d.clear('files')
}
