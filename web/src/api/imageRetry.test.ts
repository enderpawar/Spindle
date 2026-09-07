import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadImageWithRetry } from './imageRetry'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('대체 사진 조회 수명주기', () => {
  it('일시적 실패 후 1초 뒤 다시 조회해 같은 화면에서 사진을 복구한다', async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('https://img/recovered.jpg')
    const onResult = vi.fn()
    const cancel = loadImageWithRetry(request, onResult)
    await vi.advanceTimersByTimeAsync(999)
    expect(request).toHaveBeenCalledTimes(1)
    expect(onResult).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(request).toHaveBeenCalledTimes(2)
    expect(onResult).toHaveBeenCalledWith('https://img/recovered.jpg')
    expect(vi.getTimerCount()).toBe(0)
    cancel()
  })

  it('정상적인 사진 없음은 재시도하지 않는다', async () => {
    const request = vi.fn().mockResolvedValue(null)
    const onResult = vi.fn()
    const cancel = loadImageWithRetry(request, onResult)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(request).toHaveBeenCalledTimes(1)
    expect(onResult).toHaveBeenCalledWith(null)
    cancel()
  })

  it('연속 실패해도 재시도는 한 번으로 제한한다', async () => {
    const request = vi.fn().mockRejectedValue(new Error('offline'))
    const onResult = vi.fn()
    const cancel = loadImageWithRetry(request, onResult)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(request).toHaveBeenCalledTimes(2)
    expect(onResult).toHaveBeenCalledExactlyOnceWith(null)
    expect(vi.getTimerCount()).toBe(0)
    cancel()
  })

  it('화면을 떠나거나 다른 후보로 바뀌면 예약된 재시도를 취소한다', async () => {
    const request = vi.fn().mockRejectedValue(new Error('offline'))
    const onResult = vi.fn()
    const cancel = loadImageWithRetry(request, onResult)
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(1)
    cancel()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(request).toHaveBeenCalledTimes(1)
    expect(onResult).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['resolve', 'reject'] as const)('화면을 떠난 뒤 늦은 %s는 상태 변경·재시도를 만들지 않는다', async (outcome) => {
    let resolve!: (url: string) => void
    let reject!: (error: Error) => void
    const request = vi.fn(() => new Promise<string>((res, rej) => { resolve = res; reject = rej }))
    const onResult = vi.fn()
    const cancel = loadImageWithRetry(request, onResult)
    cancel()
    if (outcome === 'resolve') resolve('https://img/stale.jpg')
    else reject(new Error('offline'))
    await vi.advanceTimersByTimeAsync(5_000)
    expect(request).toHaveBeenCalledTimes(1)
    expect(onResult).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
