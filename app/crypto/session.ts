import { fromBase64, toBase64, utf8 } from './base64'
import type { ItemEnvelope } from './envelope'
import { openString, sealString } from './envelope'
import type { FileEnvelope, FileMeta } from './file'
import { openFile, openFileMeta, sealFile } from './file'
import { deriveMasterKey, KDF_ITERATIONS, SALT_BYTES } from './keys'
import type { Bytes } from './types'

const VERIFIER = 'secure-notes-vault'

export interface VaultParams {
  salt: string
  iterations: number
  verifier: ItemEnvelope
}

// то, что нужно стору; реализуют и VaultSession, и воркерный клиент
export interface CryptoClient {
  readonly unlocked: boolean
  setup(password: string): Promise<VaultParams>
  unlock(password: string, params: VaultParams): Promise<boolean>
  seal(text: string, aad: string): Promise<ItemEnvelope>
  open(env: ItemEnvelope, aad: string): Promise<string>
  sealFile(fileId: string, meta: FileMeta, data: Bytes): Promise<FileEnvelope>
  openFileMeta(fileId: string, env: FileEnvelope): Promise<FileMeta>
  openFile(fileId: string, env: FileEnvelope): Promise<{ meta: FileMeta; data: Bytes }>
  lock(): void
}

export class VaultSession implements CryptoClient {
  private key: CryptoKey | null = null

  get unlocked(): boolean {
    return this.key !== null
  }

  async setup(password: string): Promise<VaultParams> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
    this.key = await deriveMasterKey(password, salt)
    const verifier = await sealString(this.key, VERIFIER)
    return { salt: toBase64(salt), iterations: KDF_ITERATIONS, verifier }
  }

  async unlock(password: string, params: VaultParams): Promise<boolean> {
    const key = await deriveMasterKey(password, fromBase64(params.salt), params.iterations)
    try {
      if ((await openString(key, params.verifier)) !== VERIFIER) return false
    } catch {
      return false
    }
    this.key = key
    return true
  }

  async seal(text: string, aad: string): Promise<ItemEnvelope> {
    return sealString(this.requireKey(), text, utf8(aad))
  }

  async open(env: ItemEnvelope, aad: string): Promise<string> {
    return openString(this.requireKey(), env, utf8(aad))
  }

  sealFile(fileId: string, meta: FileMeta, data: Bytes): Promise<FileEnvelope> {
    return sealFile(this.requireKey(), fileId, meta, data)
  }

  openFileMeta(fileId: string, env: FileEnvelope): Promise<FileMeta> {
    return openFileMeta(this.requireKey(), fileId, env)
  }

  openFile(fileId: string, env: FileEnvelope): Promise<{ meta: FileMeta; data: Bytes }> {
    return openFile(this.requireKey(), fileId, env)
  }

  lock(): void {
    this.key = null
  }

  private requireKey(): CryptoKey {
    if (!this.key) throw new Error('vault locked')
    return this.key
  }
}
