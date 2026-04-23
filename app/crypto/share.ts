import { fromBase64, toBase64, utf8 } from './base64'
import type { ItemEnvelope } from './envelope'
import { decryptItem, encryptItem } from './item'
import { generateDek, unwrapDek, wrapDek } from './keys'
import type { Bytes } from './types'

const RSA: RsaHashedKeyGenParams = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
}

export interface Keypair {
  publicKey: CryptoKey
  privateKey: CryptoKey
}

// то, что уходит получателю: шифртекст заметки как есть + dek, завёрнутый его rsa-ключом
export interface SharePayload {
  noteId: string
  iv: string
  ct: string
  wrappedKey: string
}

export function generateKeypair(): Promise<Keypair> {
  return crypto.subtle.generateKey(RSA, true, ['encrypt', 'decrypt']) as Promise<Keypair>
}

export async function exportPublicKey(pub: CryptoKey): Promise<string> {
  return toBase64(new Uint8Array(await crypto.subtle.exportKey('spki', pub)) as Bytes)
}

export function importPublicKey(spki: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('spki', fromBase64(spki), RSA, true, ['encrypt'])
}

function importPrivateKey(pkcs8: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey('pkcs8', pkcs8, RSA, true, ['decrypt'])
}

// приватный ключ храним как обычный элемент: свежий dek под мастером, pkcs8 под dek
export async function sealPrivateKey(
  masterKey: CryptoKey,
  privateKey: CryptoKey,
): Promise<ItemEnvelope> {
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', privateKey)) as Bytes
  const dek = await generateDek()
  const sealed = await encryptItem(dek, pkcs8)
  const wrapped = await wrapDek(dek, masterKey)
  return {
    v: 1,
    wrappedKey: toBase64(wrapped),
    iv: toBase64(sealed.iv),
    ct: toBase64(sealed.ciphertext),
  }
}

export async function openPrivateKey(masterKey: CryptoKey, env: ItemEnvelope): Promise<CryptoKey> {
  const dek = await unwrapDek(fromBase64(env.wrappedKey), masterKey)
  const pkcs8 = await decryptItem(dek, {
    iv: fromBase64(env.iv),
    ciphertext: fromBase64(env.ct),
  })
  return importPrivateKey(pkcs8)
}

// делимся: разворачиваем dek своим мастером, заворачиваем публичным ключом получателя.
// шифртекст и iv заметки не трогаем — получатель расшифрует их тем же dek
export async function prepareShare(
  masterKey: CryptoKey,
  noteId: string,
  noteEnv: ItemEnvelope,
  recipientPub: CryptoKey,
): Promise<SharePayload> {
  const dek = await unwrapDek(fromBase64(noteEnv.wrappedKey), masterKey)
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', dek)) as Bytes
  const wrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, recipientPub, raw)
  return {
    noteId,
    iv: noteEnv.iv,
    ct: noteEnv.ct,
    wrappedKey: toBase64(new Uint8Array(wrapped) as Bytes),
  }
}

export async function openSharedNote(privateKey: CryptoKey, share: SharePayload): Promise<string> {
  const raw = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    fromBase64(share.wrappedKey),
  )
  const dek = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(raw),
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  )
  const pt = await decryptItem(
    dek,
    { iv: fromBase64(share.iv), ciphertext: fromBase64(share.ct) },
    utf8(share.noteId),
  )
  return new TextDecoder().decode(pt)
}
