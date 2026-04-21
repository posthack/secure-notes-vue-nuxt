import type { ItemEnvelope } from '~/crypto'
import { deleteNote, getAllNotes, putNote, type VaultMeta } from '~/lib/db'

export interface SyncEntry {
  id: string
  env: ItemEnvelope
  updatedAt: number
  deleted?: boolean
}

// last-write-wins по updatedAt. push — что отдать серверу, pull — что применить локально
export function mergeNotes(
  local: SyncEntry[],
  remote: SyncEntry[],
): { push: SyncEntry[]; pull: SyncEntry[] } {
  const byId = new Map<string, { l?: SyncEntry; r?: SyncEntry }>()
  for (const l of local) byId.set(l.id, { ...byId.get(l.id), l })
  for (const r of remote) byId.set(r.id, { ...byId.get(r.id), r })

  const push: SyncEntry[] = []
  const pull: SyncEntry[] = []
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

export function pushVault(meta: VaultMeta): Promise<unknown> {
  return $fetch('/api/vault', { method: 'PUT', body: { meta } })
}

export async function pullVault(): Promise<VaultMeta | null> {
  const res = await $fetch<{ meta: VaultMeta } | null>('/api/vault')
  return res?.meta ?? null
}
