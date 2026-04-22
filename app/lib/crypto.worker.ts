import { VaultSession } from '~/crypto/session'
import type { Bytes } from '~/crypto/types'
import type { CryptoRequest, CryptoResponse } from './rpc'

// объявляем self локально, чтобы не тянуть webworker lib и не ловить конфликты с dom
declare const self: {
  onmessage: ((e: MessageEvent<CryptoRequest>) => void) | null
  postMessage(msg: CryptoResponse): void
}

const session = new VaultSession()

self.onmessage = async (e) => {
  const req = e.data
  try {
    let result: unknown = null
    switch (req.op) {
      case 'setup':
        result = await session.setup(req.password)
        break
      case 'unlock':
        result = await session.unlock(req.password, req.params)
        break
      case 'seal':
        result = await session.seal(req.text, req.aad)
        break
      case 'open':
        result = await session.open(req.env, req.aad)
        break
      case 'sealFile':
        result = await session.sealFile(req.fileId, req.meta, req.data as Bytes)
        break
      case 'openFileMeta':
        result = await session.openFileMeta(req.fileId, req.env)
        break
      case 'openFile':
        result = await session.openFile(req.fileId, req.env)
        break
      case 'lock':
        session.lock()
        break
    }
    self.postMessage({ id: req.id, ok: true, result })
  } catch (err) {
    self.postMessage({ id: req.id, ok: false, error: (err as Error).message })
  }
}
