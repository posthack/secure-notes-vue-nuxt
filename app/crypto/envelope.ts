import { fromBase64, toBase64, utf8 } from './base64'
import { generateDek, unwrapDek, wrapDek } from './keys'
import { decryptItem, encryptItem } from './item'
import type { Bytes } from './types'

export interface ItemEnvelope {
  v: 1
  wrappedKey: string
  iv: string
  ct: string
}

export async function sealString(
  masterKey: CryptoKey,
  text: string,
  aad?: Bytes,
): Promise<ItemEnvelope> {
  const dek = await generateDek()
  const sealed = await encryptItem(dek, utf8(text), aad)
  const wrapped = await wrapDek(dek, masterKey)
  return {
    v: 1,
    wrappedKey: toBase64(wrapped),
    iv: toBase64(sealed.iv),
    ct: toBase64(sealed.ciphertext),
  }
}

export async function openString(
  masterKey: CryptoKey,
  env: ItemEnvelope,
  aad?: Bytes,
): Promise<string> {
  const dek = await unwrapDek(fromBase64(env.wrappedKey), masterKey)
  const sealed = { iv: fromBase64(env.iv), ciphertext: fromBase64(env.ct) }
  return new TextDecoder().decode(await decryptItem(dek, sealed, aad))
}

// смена пароля: разворачиваем dek старым ключом, оборачиваем новым. шифртекст не трогаем
export async function rewrapEnvelope(
  env: ItemEnvelope,
  oldMasterKey: CryptoKey,
  newMasterKey: CryptoKey,
): Promise<ItemEnvelope> {
  const dek = await unwrapDek(fromBase64(env.wrappedKey), oldMasterKey)
  const wrapped = await wrapDek(dek, newMasterKey)
  return { ...env, wrappedKey: toBase64(wrapped) }
}
