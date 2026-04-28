import { createHash } from 'node:crypto'

// строгий CSP — закрываем дыру XSS→E2E (см. SECURITY.md).
// страницы статические (prerender '/' + spa '/app'), per-request nonce тут не
// работает, поэтому script-src держим на 'self' + sha256 инлайн-скриптов,
// которые вставляет сам nuxt (color-mode и window.__NUXT__.config). хэши
// считаем прямо из тела ответа — так они не завязаны на buildId и не протухают
// между сборками. инлайн-стили (style="" на transition'ах nuxt ui/vue) хэшу не
// поддаются, поэтому style-src с 'unsafe-inline' — осознанный компромисс.

const directives = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  'upgrade-insecure-requests',
]

const inlineScript = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi

function scriptHashes(html: string): string[] {
  const hashes = new Set<string>()
  for (const m of html.matchAll(inlineScript)) {
    const type = /type=["']?([^"'\s>]+)/i.exec(m[1] ?? '')?.[1]?.toLowerCase()
    // только исполняемые: без type или js-type. __NUXT_DATA__ (application/json) не трогаем
    if (type && !['module', 'text/javascript', 'application/javascript'].includes(type)) continue
    const body = m[2]
    if (body) hashes.add(createHash('sha256').update(body, 'utf8').digest('base64'))
  }
  return [...hashes]
}

function policy(hashes: string[]): string {
  const script = ["'self'", ...hashes.map((h) => `'sha256-${h}'`)].join(' ')
  return [`script-src ${script}`, ...directives].join('; ')
}

function toHtml(body: unknown): string {
  if (typeof body === 'string') return body
  if (Buffer.isBuffer(body)) return body.toString('utf8')
  if (body instanceof Uint8Array) return Buffer.from(body).toString('utf8')
  return ''
}

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('beforeResponse', (event, res: { body?: unknown }) => {
    setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
    setResponseHeader(event, 'Referrer-Policy', 'no-referrer')
    setResponseHeader(event, 'X-Frame-Options', 'DENY')
    setResponseHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

    const isHtml = String(getResponseHeader(event, 'content-type') ?? '').includes('text/html')
    const hashes = isHtml ? scriptHashes(toHtml(res.body)) : []
    setResponseHeader(event, 'Content-Security-Policy', policy(hashes))
  })
})
