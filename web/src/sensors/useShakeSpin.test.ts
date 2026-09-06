import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestMotionPermission, subscribeShake, type MotionPermission } from './motion'
import { installShakeActivation, type ShakeStatus } from './useShakeSpin'

interface CapacitorTestGlobal {
  Capacitor?: { isNativePlatform: () => boolean }
}

const originalCapacitor = Object.getOwnPropertyDescriptor(globalThis, 'Capacitor')

afterEach(() => {
  vi.unstubAllGlobals()
  if (originalCapacitor) {
    Object.defineProperty(globalThis, 'Capacitor', originalCapacitor)
  } else {
    delete (globalThis as CapacitorTestGlobal).Capacitor
  }
})

function fakeMotionWindow(
  permissionRequest?: () => Promise<'granted' | 'denied'>,
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

function activation(needsPermission: boolean) {
  const statuses: ShakeStatus[] = []
  let permission: MotionPermission | null = null
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
  })
  const cleanup = installShakeActivation({
    supported: true,
    needsPermission,
    knownPermission: () => permission,
    subscribe,
    stop,
    enable,
    setStatus: (status) => statuses.push(status),
  })
  return {
    statuses,
    subscribe,
    stop,
    enable,
    cleanup,
    permission: () => permission,
    active: () => active,
  }
}

describe('useShakeSpin 네이티브 즉시 권한 요청', () => {
  it('네이티브 진입 즉시 제스처 없이 권한을 요청하고 granted면 구독한다', async () => {
    const requestPermission = vi.fn(() => Promise.resolve('granted' as const))
    fakeMotionWindow(requestPermission)
    nativeShell()

    const runtime = activation(true)

    expect(requestPermission).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(runtime.subscribe).toHaveBeenCalledTimes(1))
    expect(runtime.statuses.at(-1)).toBe('on')
    expect(runtime.active()).toBe(true)
    runtime.cleanup()
  })

  it('네이티브 즉시 요청이 denied면 첫 조작 권한 경로로 폴백한다', async () => {
    const requestPermission = vi
      .fn<() => Promise<'granted' | 'denied'>>()
      .mockResolvedValueOnce('denied')
      .mockResolvedValueOnce('granted')
    const host = fakeMotionWindow(requestPermission)
    nativeShell()
    const runtime = activation(true)

    await vi.waitFor(() => expect(runtime.permission()).toBe('denied'))
    expect(runtime.subscribe).not.toHaveBeenCalled()

    host.dispatchEvent(new Event('pointerup'))
    await vi.waitFor(() => expect(requestPermission).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(runtime.subscribe).toHaveBeenCalledTimes(1))
    runtime.cleanup()
  })

  it('needsPermission=false인 네이티브는 권한 API 없이 바로 구독한다', () => {
    const requestPermission = vi.fn(() => Promise.resolve('granted' as const))
    fakeMotionWindow(requestPermission)
    nativeShell()

    const runtime = activation(false)

    expect(requestPermission).not.toHaveBeenCalled()
    expect(runtime.subscribe).toHaveBeenCalledTimes(1)
    expect(runtime.active()).toBe(true)
    runtime.cleanup()
  })

  it('권한 Promise 완료 전에 화면을 떠나면 뒤늦게 생긴 구독도 제거한다', async () => {
    let resolvePermission!: (permission: 'granted') => void
    const requestPermission = vi.fn(
      () => new Promise<'granted'>((resolve) => {
        resolvePermission = resolve
      }),
    )
    fakeMotionWindow(requestPermission)
    nativeShell()
    const runtime = activation(true)

    runtime.cleanup()
    expect(runtime.active()).toBe(false)
    resolvePermission('granted')

    await vi.waitFor(() => expect(runtime.subscribe).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(runtime.stop).toHaveBeenCalledTimes(2))
    expect(runtime.active()).toBe(false)
  })

  it('웹에서는 기존처럼 첫 조작에만 권한을 요청한다', async () => {
    const requestPermission = vi.fn(() => Promise.resolve('granted' as const))
    const host = fakeMotionWindow(requestPermission)
    const runtime = activation(true)

    expect(requestPermission).not.toHaveBeenCalled()
    expect(runtime.subscribe).not.toHaveBeenCalled()

    host.dispatchEvent(new Event('pointerup'))
    await vi.waitFor(() => expect(requestPermission).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(runtime.subscribe).toHaveBeenCalledTimes(1))
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
