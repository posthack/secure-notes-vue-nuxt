import type { FileEnvelope, FileMeta, ItemEnvelope } from '~/crypto'
import type { VaultParams } from '~/crypto/session'

export type CryptoRequest =
  | { id: number; op: 'setup'; password: string }
  | { id: number; op: 'unlock'; password: string; params: VaultParams }
  | { id: number; op: 'seal'; text: string; aad: string }
  | { id: number; op: 'open'; env: ItemEnvelope; aad: string }
  | { id: number; op: 'sealFile'; fileId: string; meta: FileMeta; data: Uint8Array }
  | { id: number; op: 'openFileMeta'; fileId: string; env: FileEnvelope }
  | { id: number; op: 'openFile'; fileId: string; env: FileEnvelope }
  | { id: number; op: 'lock' }

export type CryptoResponse =
  { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string }
