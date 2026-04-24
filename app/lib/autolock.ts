// запирает хранилище после простоя. трогаем на активности, гасим при выходе
export class AutoLock {
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private onLock: () => void,
    private timeoutMs: number,
  ) {}

  touch(): void {
    this.stop()
    this.timer = setTimeout(() => {
      this.timer = null
      this.onLock()
    }, this.timeoutMs)
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  get armed(): boolean {
    return this.timer !== null
  }
}
