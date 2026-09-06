import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearMotionPermissionForTest,
  knownMotionPermission,
  requestMotionPermission,
  subscribeShake,
  type MotionPermission,
} from './motion'
import {
  installShakeActivation,
  noticeForMotionPermission,
  shouldSkipMotionPermissionGesture,
  type ShakeStatus,
} from './useShakeSpin'

interface CapacitorTestGlobal {
  Capacitor?: { isNativePlatform: () => boolean }
}

const originalCapacitor = Object.getOwnPropertyDescriptor(globalThis, 'Capacitor')

beforeEach(() => clearMotionPermissionForTest())

afterEach(() => {
  vi.unstubAllGlobals()
  if (originalCapacitor) {
    Object.defineProperty(globalThis, 'Capacitor', originalCapacitor)
  } else {
    delete (globalThis as CapacitorTestGlobal).Capacitor
  }
})

function fakeMotionWindow(
  permissionRequest?: () => Promise<'granted' | 'denied' | 'default'>,
): EventTarget {
  const host = new EventTarget()
  Object.assign(host, {
    DeviceMotionEvent: Object.assign(
      function DeviceMotionEvent() {},
      permissionRequest ? { requestPermission: permissionRequest } : {},
    ),
  })
  vi.stubGlobal('window', host)
  return host
}

function nativeShell(): void {
  ;(globalThis as CapacitorTestGlobal).Capacitor = { isNativePlatform: () => true }
}

function activation(needsPermission: boolean, initialPermission: MotionPermission | null = null) {
  const statuses: ShakeStatus[] = []
  const notices: Array<string | null> = []
  let permission = initialPermission
  let active = false
  const subscribe = vi.fn(() => {
    active = true
    statuses.push('on')
  })
  const stop = vi.fn(() => {
    active = false
  })
  const enable = vi.fn(async () => {
    permission = await requestMotionPermission()
    if (permission === 'granted') subscribe()
    return permission
  })
  const cleanup = installShakeActivation({
    supported: true,
    needsPermission,
    knownPermission: () => permission,
    subscribe,
    stop,
    enable,
    setStatus: (status) => statuses.push(status),
    setNotice: (notice) => notices.push(notice),
  })
  return {
    statuses,
    notices,
    subscribe,
    stop,
    enable,
    cleanup,
    permission: () => permission,
    active: () => active,
  }
}

describe('requestMotionPermission 세션 판정', () => {
  it('제스처 밖 예외는 거부로 확정하지 않고 이후 granted 재시도를 허용한다', async () => {
    const requestPermission = vi
      .fn<() => Promise<'granted'>>()
      .mockRejectedValueOnce(new Error('gesture required'))
      .mockResolvedValueOnce('granted')
    fakeMotionWindow(requestPermission)

    await expect(requestMotionPermission()).resolves.toBe('retryable')
    expect(knownMotionPermission()).toBeNull()
    await expect(requestMotionPermission()).resolves.toBe('granted')
    expect(knownMotionPermission()).toBe('granted')
  })

  it('default 응답도 거부로 확정하지 않는다', async () => {
    fakeMotionWindow(() => Promise.resolve('default'))

    await expect(requestMotionPermission()).resolves.toBe('retryable')
    expect(knownMotionPermission()).toBeNull()
    expect(noticeForMotionPermission('retryable')).toBeNull()
  })

  it('사용자의 명시적 denied만 확정하고 거부 안내를 제공한다', async () => {
    fakeMotionWindow(() => Promise.resolve('denied'))

    await expect(requestMotionPermission()).resolves.toBe('denied')
    expect(knownMotionPermission()).toBe('denied')
    expect(noticeForMotionPermission('denied')).toContain('권한이 거부돼')
  })
})

describe('useShakeSpin 권한 진입 경로', () => {
  it('네이티브에서 이미 granted면 제스처 없이 즉시 구독한다', () => {
    const requestPermission = vi.fn(() => Promise.resolve('granted' as const))
    fakeMotionWindow(requestPermission)
    nativeShell()

    const runtime = activation(true, 'granted')

    expect(requestPermission).not.toHaveBeenCalled()
    expect(runtime.subscribe).toHaveBeenCalledTimes(1)
    expect(runtime.active()).toBe(true)
    runtime.cleanup()
  })

  it('네이티브에서 아직 모르면 화면 첫 조작까지 기다린다', async () => {
    const requestPermission = vi.fn(() => Promise.resolve('granted' as const))
    const host = fakeMotionWindow(requestPermission)
    nativeShell()
    const runtime = activation(true)

    expect(requestPermission).not.toHaveBeenCalled()
    expect(runtime.subscribe).not.toHaveBeenCalled()

    host.dispatchEvent(new Event('pointerup'))
    await vi.waitFor(() => expect(requestPermission).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(runtime.subscribe).toHaveBeenCalledTimes(1))
    runtime.cleanup()
  })

  it('최초 제스처에서 실제로 거부했으면 스핀 화면에 거부 안내를 표시한다', () => {
    const requestPermission = vi.fn(() => Promise.resolve('denied' as const))
    fakeMotionWindow(requestPermission)
    nativeShell()

    const runtime = activation(true, 'denied')

    expect(runtime.statuses.at(-1)).toBe('unavailable')
    expect(runtime.notices.at(-1)).toContain('권한이 거부돼')
    expect(requestPermission).not.toHaveBeenCalled()
    runtime.cleanup()
  })

  it('needsPermission=false인 네이티브는 권한 API 없이 바로 구독한다', () => {
    const requestPermission = vi.fn(() => Promise.resolve('granted' as const))
    fakeMotionWindow(requestPermission)
    nativeShell()

    const runtime = activation(false)

    expect(requestPermission).not.toHaveBeenCalled()
    expect(runtime.subscribe).toHaveBeenCalledTimes(1)
    runtime.cleanup()
  })

  it('권한 Promise 완료 전에 화면을 떠나면 뒤늦게 생긴 구독도 제거한다', async () => {
    let resolvePermission!: (permission: 'granted') => void
    const requestPermission = vi.fn(
      () => new Promise<'granted'>((resolve) => {
        resolvePermission = resolve
      }),
    )
    const host = fakeMotionWindow(requestPermission)
    nativeShell()
    const runtime = activation(true)

    host.dispatchEvent(new Event('pointerup'))
    runtime.cleanup()
    resolvePermission('granted')

    await vi.waitFor(() => expect(runtime.subscribe).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(runtime.stop).toHaveBeenCalledTimes(2))
    expect(runtime.active()).toBe(false)
  })

  it('웹에서는 첫 조작에 요청하지만 내비 탭은 계속 제외한다', async () => {
    class NavElement extends EventTarget {
      closest(selector: string): NavElement | null {
        return selector === 'nav' ? this : null
      }
    }
    vi.stubGlobal('Element', NavElement)
    const nav = new NavElement()
    expect(shouldSkipMotionPermissionGesture(nav, false)).toBe(true)
    expect(shouldSkipMotionPermissionGesture(nav, true)).toBe(false)

    const requestPermission = vi.fn(() => Promise.resolve('granted' as const))
    const host = fakeMotionWindow(requestPermission)
    const runtime = activation(true)
    expect(requestPermission).not.toHaveBeenCalled()

    host.dispatchEvent(new Event('pointerup'))
    await vi.waitFor(() => expect(requestPermission).toHaveBeenCalledTimes(1))
    runtime.cleanup()
  })
})

describe('subscribeShake 표본 신호', () => {
  function motionEvent(x: number, y: number, z: number): Event {
    return Object.assign(new Event('devicemotion'), {
      accelerationIncludingGravity: { x, y, z },
      acceleration: null,
    })
  }

  it('가속도 값이 없는 이벤트에도 값 없는 onSample을 호출한다', () => {
    const host = fakeMotionWindow()
    const onShake = vi.fn()
    const onSample = vi.fn()
    const unsubscribe = subscribeShake(onShake, onSample)

    host.dispatchEvent(new Event('devicemotion'))

    expect(onSample).toHaveBeenCalledWith()
    expect(onShake).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('onSample 없는 기존 한 인자 호출도 흔들림을 전달하고 해제된다', () => {
    const host = fakeMotionWindow()
    const onShake = vi.fn()
    const unsubscribe = subscribeShake(onShake)

    host.dispatchEvent(motionEvent(0, 0, 9.8))
    host.dispatchEvent(motionEvent(20, 0, 9.8))
    expect(onShake).toHaveBeenCalledTimes(1)

    unsubscribe()
    host.dispatchEvent(motionEvent(-20, 0, 9.8))
    expect(onShake).toHaveBeenCalledTimes(1)
  })
})
