export const KDF_ITERATIONS = 600_000
export const SALT_BYTES = 16

export function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function deriveMasterKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations = KDF_ITERATIONS,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  )
}

export async function wrapDek(
  dek: CryptoKey,
  masterKey: CryptoKey,
): Promise<Uint8Array<ArrayBuffer>> {
  const wrapped = await crypto.subtle.wrapKey('raw', dek, masterKey, 'AES-KW')
  return new Uint8Array(wrapped)
}

// dek извлекаемый — иначе не переобернуть при смене пароля
export function unwrapDek(
  wrapped: Uint8Array<ArrayBuffer>,
  masterKey: CryptoKey,
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey('raw', wrapped, masterKey, 'AES-KW', { name: 'AES-GCM' }, true, [
    'encrypt',
    'decrypt',
  ])
}
