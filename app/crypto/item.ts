import type { Bytes } from './types'

export const IV_BYTES = 12

export interface Sealed {
  iv: Bytes
  ciphertext: Bytes
}

export async function encryptItem(dek: CryptoKey, data: Bytes, aad?: Bytes): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const params: AesGcmParams = { name: 'AES-GCM', iv }
  if (aad) params.additionalData = aad
  const ct = await crypto.subtle.encrypt(params, dek, data)
  return { iv, ciphertext: new Uint8Array(ct) }
}

export async function decryptItem(dek: CryptoKey, sealed: Sealed, aad?: Bytes): Promise<Bytes> {
  const params: AesGcmParams = { name: 'AES-GCM', iv: sealed.iv }
  if (aad) params.additionalData = aad
  const pt = await crypto.subtle.decrypt(params, dek, sealed.ciphertext)
  return new Uint8Array(pt)
}
