// без визуально похожих символов: 0/O/o, 1/l/I — чтобы пароль можно было переписать
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*_-+=?'

// равномерная выборка из crypto.getRandomValues, с отбрасыванием остатка (без модульного смещения)
export function generatePassword(length = 20): string {
  const out: string[] = []
  const max = Math.floor(256 / ALPHABET.length) * ALPHABET.length
  const buf = new Uint8Array(length * 2)
  while (out.length < length) {
    crypto.getRandomValues(buf)
    for (const b of buf) {
      if (out.length >= length) break
      if (b < max) out.push(ALPHABET[b % ALPHABET.length]!)
    }
  }
  return out.join('')
}
