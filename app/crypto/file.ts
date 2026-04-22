import { fromBase64, toBase64, utf8 } from './base64'
import { generateDek, unwrapDek, wrapDek } from './keys'
import { decryptItem, encryptItem, type Sealed } from './item'
import type { Bytes } from './types'

// содержимое режем на чанки — большой файл не держим одним куском в памяти,
// и каждый чанк это отдельный gcm-фрейм со своим iv
export const CHUNK_BYTES = 256 * 1024

export interface FileMeta {
  name: string
  type: string
  size: number
}

interface Box {
  iv: string
  ct: string
}

export interface FileEnvelope {
  v: 1
  wrappedKey: string
  meta: Box
  chunks: Box[]
}

const box = (s: Sealed): Box => ({ iv: toBase64(s.iv), ct: toBase64(s.ciphertext) })
const unbox = (b: Box): Sealed => ({ iv: fromBase64(b.iv), ciphertext: fromBase64(b.ct) })

// чанк привязан к файлу и своей позиции — переставить или подсунуть из другого файла не выйдет
const chunkAad = (fileId: string, i: number) => utf8(`${fileId}:${i}`)

export async function sealFile(
  masterKey: CryptoKey,
  fileId: string,
  meta: FileMeta,
  data: Bytes,
): Promise<FileEnvelope> {
  const dek = await generateDek()
  const sealedMeta = await encryptItem(dek, utf8(JSON.stringify(meta)), utf8(fileId))

  const chunks: Box[] = []
  for (let off = 0, i = 0; off < data.length; off += CHUNK_BYTES, i++) {
    const part = data.subarray(off, off + CHUNK_BYTES) as Bytes
    chunks.push(box(await encryptItem(dek, part, chunkAad(fileId, i))))
  }

  const wrapped = await wrapDek(dek, masterKey)
  return { v: 1, wrappedKey: toBase64(wrapped), meta: box(sealedMeta), chunks }
}

export async function openFileMeta(
  masterKey: CryptoKey,
  fileId: string,
  env: FileEnvelope,
): Promise<FileMeta> {
  const dek = await unwrapDek(fromBase64(env.wrappedKey), masterKey)
  const raw = await decryptItem(dek, unbox(env.meta), utf8(fileId))
  return JSON.parse(new TextDecoder().decode(raw)) as FileMeta
}

export async function openFile(
  masterKey: CryptoKey,
  fileId: string,
  env: FileEnvelope,
): Promise<{ meta: FileMeta; data: Bytes }> {
  const dek = await unwrapDek(fromBase64(env.wrappedKey), masterKey)
  const meta = JSON.parse(
    new TextDecoder().decode(await decryptItem(dek, unbox(env.meta), utf8(fileId))),
  ) as FileMeta

  const parts: Bytes[] = []
  let total = 0
  for (let i = 0; i < env.chunks.length; i++) {
    const part = await decryptItem(dek, unbox(env.chunks[i]!), chunkAad(fileId, i))
    parts.push(part)
    total += part.length
  }
  // размер аутентифицирован в meta — расхождение значит, что чанк потеряли или дописали
  if (total !== meta.size) throw new Error('file size mismatch')

  const data = new Uint8Array(total) as Bytes
  let off = 0
  for (const p of parts) {
    data.set(p, off)
    off += p.length
  }
  return { meta, data }
}
