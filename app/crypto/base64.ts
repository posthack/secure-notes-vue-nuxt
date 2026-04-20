import type { Bytes } from './types'

export function toBase64(bytes: Bytes): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

export function fromBase64(s: string): Bytes {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function utf8(s: string): Bytes {
  return new Uint8Array(new TextEncoder().encode(s))
}
