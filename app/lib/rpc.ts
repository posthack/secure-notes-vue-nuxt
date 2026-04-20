import type { ItemEnvelope } from '~/crypto'
import type { VaultParams } from '~/crypto/session'

export type CryptoRequest =
  | { id: number; op: 'setup'; password: string }
  | { id: number; op: 'unlock'; password: string; params: VaultParams }
  | { id: number; op: 'seal'; text: string; aad: string }
  | { id: number; op: 'open'; env: ItemEnvelope; aad: string }
  | { id: number; op: 'lock' }

export type CryptoResponse =
  { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string }
