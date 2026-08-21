import { beforeEach, describe, expect, it, vi } from 'vitest'
import { backGuardCount, clearBackGuards, pushBackGuard, runTopBackGuard } from './backGuards'

describe('backGuards', () => {
  beforeEach(() => {
    clearBackGuards()
  })

  it('열린 오버레이가 없으면 화면 이동에 양보한다', () => {
    expect(runTopBackGuard()).toBe(false)
  })

  it('가장 나중에 열린 오버레이부터 닫는다', () => {
    const sheet = vi.fn()
    const gallery = vi.fn()
    pushBackGuard(sheet)
    pushBackGuard(gallery)

    expect(runTopBackGuard()).toBe(true)
    expect(gallery).toHaveBeenCalledTimes(1)
    expect(sheet).not.toHaveBeenCalled()

    expect(runTopBackGuard()).toBe(true)
    expect(sheet).toHaveBeenCalledTimes(1)
  })

  it('가운데 가드를 해제해도 나머지 순서가 유지된다', () => {
    const bottom = vi.fn()
    const middle = vi.fn()
    const top = vi.fn()
    pushBackGuard(bottom)
    const removeMiddle = pushBackGuard(middle)
    pushBackGuard(top)

    removeMiddle()
    runTopBackGuard()
    runTopBackGuard()

    expect(top).toHaveBeenCalledTimes(1)
    expect(bottom).toHaveBeenCalledTimes(1)
    expect(middle).not.toHaveBeenCalled()
  })

  it('실행한 가드는 스택에서 빠져 사용자가 뒤로가기에 갇히지 않는다', () => {
    // 상태가 바뀌지 않아 훅 cleanup이 돌지 않는 최악의 경우에도 다음 뒤로가기는 화면 이동으로 간다.
    pushBackGuard(vi.fn())
    expect(runTopBackGuard()).toBe(true)
    expect(backGuardCount()).toBe(0)
    expect(runTopBackGuard()).toBe(false)
  })

  it('해제 함수는 자기 항목만 제거한다', () => {
    const sheet = vi.fn()
    const gallery = vi.fn()
    pushBackGuard(sheet)
    const removeGallery = pushBackGuard(gallery)

    removeGallery()
    expect(runTopBackGuard()).toBe(true)
    expect(sheet).toHaveBeenCalledTimes(1)
    expect(gallery).not.toHaveBeenCalled()
  })

  it('같은 함수를 두 번 등록해도 각 해제가 자기 항목만 지운다', () => {
    // StrictMode 이중 마운트에서 같은 dismiss가 두 번 등록될 수 있다.
    const dismiss = vi.fn()
    const removeFirst = pushBackGuard(dismiss)
    pushBackGuard(dismiss)
    expect(backGuardCount()).toBe(2)

    removeFirst()
    expect(backGuardCount()).toBe(1)
    expect(runTopBackGuard()).toBe(true)
    expect(runTopBackGuard()).toBe(false)
    expect(dismiss).toHaveBeenCalledTimes(1)
  })

  it('해제한 뒤에는 스택이 비어 화면 이동이 진행된다', () => {
    const remove = pushBackGuard(vi.fn())
    remove()
    expect(runTopBackGuard()).toBe(false)
  })
})
