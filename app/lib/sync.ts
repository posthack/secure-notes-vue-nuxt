import type { FileEnvelope, ItemEnvelope, SharePayload } from '~/crypto'
import {
  deleteFile,
  deleteNote,
  getAllFiles,
  getAllNotes,
  getFile,
  putFile,
  putNote,
  type StoredFile,
  type VaultMeta,
} from '~/lib/db'

export interface SyncEntry {
  id: string
  env: ItemEnvelope
  updatedAt: number
  deleted?: boolean
}

interface Versioned {
  id: string
  updatedAt: number
  deleted?: boolean
}

// last-write-wins по updatedAt. push — что отдать серверу, pull — что применить локально.
// local и remote могут быть разной формы (у файлов метаданные ≠ полная запись)
export function mergeEntries<L extends Versioned, R extends Versioned>(
  local: L[],
  remote: R[],
): { push: L[]; pull: R[] } {
  const byId = new Map<string, { l?: L; r?: R }>()
  for (const l of local) byId.set(l.id, { ...byId.get(l.id), l })
  for (const r of remote) byId.set(r.id, { ...byId.get(r.id), r })

  const push: L[] = []
  const pull: R[] = []
  for (const { l, r } of byId.values()) {
    if (l && !r) push.push(l)
    else if (r && !l) pull.push(r)
    else if (l && r) {
      if (r.updatedAt > l.updatedAt) pull.push(r)
      else if (l.updatedAt > r.updatedAt) push.push(l)
    }
  }
  return { push, pull }
}

export const mergeNotes = mergeEntries<SyncEntry, SyncEntry>

export async function syncNotes(): Promise<boolean> {
  const remote = await $fetch<SyncEntry[]>('/api/notes')
  const local: SyncEntry[] = (await getAllNotes()).map((n) => ({
    id: n.id,
    env: n.env,
    updatedAt: n.updatedAt,
  }))

  const { push, pull } = mergeNotes(local, remote)

  for (const r of pull) {
    if (r.deleted) await deleteNote(r.id)
    else await putNote({ id: r.id, updatedAt: r.updatedAt, env: r.env })
  }
  await Promise.all(push.map((l) => pushNote(l)))

  return pull.some((r) => !r.deleted) || pull.length > 0
}

export function pushNote(entry: SyncEntry): Promise<unknown> {
  return $fetch(`/api/notes/${entry.id}`, {
    method: 'PUT',
    body: { env: entry.env, updatedAt: entry.updatedAt, deleted: entry.deleted ?? false },
  })
}

// метаданные файла: обёртка ключа и шифрованное имя, но без чанков
type FileMetaEnv = Pick<FileEnvelope, 'v' | 'wrappedKey' | 'meta'>

interface FileSyncMeta {
  id: string
  noteId: string
  meta: FileMetaEnv
  updatedAt: number
  deleted?: boolean
}

// синкаем только метаданные файлов; чанки тянем лениво при открытии (downloadFileContent)
export async function syncFiles(): Promise<boolean> {
  const remote = await $fetch<FileSyncMeta[]>('/api/files')
  const local = await getAllFiles()

  const { push, pull } = mergeEntries(local, remote)
  let changed = false

  for (const r of pull) {
    if (r.deleted) {
      await deleteFile(r.id)
    } else {
      await putFile({
        id: r.id,
        noteId: r.noteId,
        updatedAt: r.updatedAt,
        env: { ...r.meta, chunks: [] },
        content: false,
      })
    }
    changed = true
  }
  // в push попадают только локально созданные файлы — они с содержимым
  for (const l of push) {
    if (l.content) await pushFile(l)
  }

  return changed
}

// подтягиваем чанки конкретного файла и дописываем их в локальную запись
export async function downloadFileContent(id: string): Promise<StoredFile | undefined> {
  const local = await getFile(id)
  if (!local) return undefined
  if (local.content) return local

  const res = await $fetch<{ env: FileEnvelope }>(`/api/files/${id}`)
  const updated: StoredFile = { ...local, env: res.env, content: true }
  await putFile(updated)
  return updated
}

export function pushFile(entry: StoredFile): Promise<unknown> {
  return $fetch(`/api/files/${entry.id}`, {
    method: 'PUT',
    body: {
      noteId: entry.noteId,
      env: entry.env,
      updatedAt: entry.updatedAt,
      deleted: false,
    },
  })
}

export function pushFileTombstone(id: string, noteId: string): Promise<unknown> {
  return $fetch(`/api/files/${id}`, {
    method: 'PUT',
    body: {
      noteId,
      env: { v: 1, wrappedKey: '', meta: { iv: '', ct: '' }, chunks: [] },
      updatedAt: Date.now(),
      deleted: true,
    },
  })
}

export function pushVault(meta: VaultMeta): Promise<unknown> {
  return $fetch('/api/vault', { method: 'PUT', body: { meta } })
}

export async function pullVault(): Promise<VaultMeta | null> {
  const res = await $fetch<{ meta: VaultMeta } | null>('/api/vault')
  return res?.meta ?? null
}

// --- шаринг ---

export interface IncomingShare extends SharePayload {
  id: string
  ownerEmail: string
  expiresAt: number | null
}

export interface OutgoingShare {
  id: string
  noteId: string
  recipientEmail: string
  expiresAt: number | null
  createdAt: number
}

export function publishPublicKey(publicKey: string): Promise<unknown> {
  return $fetch('/api/pubkey', { method: 'PUT', body: { publicKey } })
}

// 404, если у получателя нет аккаунта или он не публиковал ключ
export async function fetchPublicKey(email: string): Promise<string> {
  const res = await $fetch<{ publicKey: string }>('/api/pubkey', { query: { email } })
  return res.publicKey
}

export function createShare(body: {
  recipientEmail: string
  noteId: string
  iv: string
  ct: string
  wrappedKey: string
  expiresAt: number | null
}): Promise<{ id: string }> {
  return $fetch('/api/shares', { method: 'POST', body })
}

export function fetchIncomingShares(): Promise<IncomingShare[]> {
  return $fetch<IncomingShare[]>('/api/shares/in')
}

export function fetchOutgoingShares(): Promise<OutgoingShare[]> {
  return $fetch<OutgoingShare[]>('/api/shares/out')
}

export function deleteShare(id: string): Promise<unknown> {
  return $fetch(`/api/shares/${id}`, { method: 'DELETE' })
}
