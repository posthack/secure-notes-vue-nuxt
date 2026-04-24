import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AutoLock } from '~/lib/autolock'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('AutoLock', () => {
  it('запирает после простоя', () => {
    let locked = 0
    const al = new AutoLock(() => locked++, 1000)
    al.touch()
    vi.advanceTimersByTime(999)
    expect(locked).toBe(0)
    vi.advanceTimersByTime(1)
    expect(locked).toBe(1)
  })

  it('активность сбрасывает отсчёт', () => {
    let locked = 0
    const al = new AutoLock(() => locked++, 1000)
    al.touch()
    vi.advanceTimersByTime(800)
    al.touch()
    vi.advanceTimersByTime(800)
    expect(locked).toBe(0)
    vi.advanceTimersByTime(200)
    expect(locked).toBe(1)
  })

  it('stop отменяет запирание', () => {
    let locked = 0
    const al = new AutoLock(() => locked++, 1000)
    al.touch()
    al.stop()
    vi.advanceTimersByTime(5000)
    expect(locked).toBe(0)
    expect(al.armed).toBe(false)
  })
})
