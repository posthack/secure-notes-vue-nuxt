import type { ItemEnvelope } from '~/crypto'
import type { CryptoClient, VaultParams } from '~/crypto/session'
import type { CryptoRequest, CryptoResponse } from './rpc'

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void }
// omit по union должен раздаваться по вариантам, иначе теряет поля
type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never

export class WorkerCryptoClient implements CryptoClient {
  private worker: Worker
  private seq = 0
  private pending = new Map<number, Pending>()
  private _unlocked = false

  constructor() {
    this.worker = new Worker(new URL('./crypto.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (e: MessageEvent<CryptoResponse>) => {
      const res = e.data
      const p = this.pending.get(res.id)
      if (!p) return
      this.pending.delete(res.id)
      if (res.ok) p.resolve(res.result)
      else p.reject(new Error(res.error))
    }
  }

  get unlocked(): boolean {
    return this._unlocked
  }

  private call(req: WithoutId<CryptoRequest>): Promise<unknown> {
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ ...req, id } as CryptoRequest)
    })
  }

  async setup(password: string): Promise<VaultParams> {
    const params = (await this.call({ op: 'setup', password })) as VaultParams
    this._unlocked = true
    return params
  }

  async unlock(password: string, params: VaultParams): Promise<boolean> {
    const ok = (await this.call({ op: 'unlock', password, params })) as boolean
    this._unlocked = ok
    return ok
  }

  seal(text: string, aad: string): Promise<ItemEnvelope> {
    return this.call({ op: 'seal', text, aad }) as Promise<ItemEnvelope>
  }

  open(env: ItemEnvelope, aad: string): Promise<string> {
    return this.call({ op: 'open', env, aad }) as Promise<string>
  }

  lock(): void {
    this._unlocked = false
    void this.call({ op: 'lock' })
  }
}
