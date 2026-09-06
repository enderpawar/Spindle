import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestMotionPermission, subscribeShake } from './motion'
import {
  installShakeActivation,
  NATIVE_MOTION_SAMPLE_WAIT_MS,
  type ShakeStatus,
} from './useShakeSpin'

interface CapacitorTestGlobal {
  Capacitor?: { isNativePlatform: () => boolean }
}

const originalCapacitor = Object.getOwnPropertyDescriptor(globalThis, 'Capacitor')

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  if (originalCapacitor) {
    Object.defineProperty(globalThis, 'Capacitor', originalCapacitor)
  } else {
    delete (globalThis as CapacitorTestGlobal).Capacitor
  }
})

function fakeMotionWindow(requestPermission?: () => Promise<'granted'>): EventTarget {
  const host = new EventTarget()
  Object.assign(host, {
    DeviceMotionEvent: Object.assign(function DeviceMotionEvent() {},
      requestPermission ? { requestPermission } : {},
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
  let onSample: (() => void) | undefined
  const subscribe = vi.fn((sample?: () => void) => {
    onSample = sample
    statuses.push('on')
  })
  const stop = vi.fn()
  const enable = vi.fn(async () => {
    await requestMotionPermission()
  })
  const cleanup = installShakeActivation({
    supported: true,
    needsPermission,
    knownPermission: () => null,
    subscribe,
    stop,
    enable,
    setStatus: (status) => statuses.push(status),
  })
  return { statuses, subscribe, stop, enable, cleanup, sample: () => onSample?.() }
}

describe('useShakeSpin 네이티브 권한 생존 확인', () => {
  it('네이티브에서 표본이 오면 권한 요청 없이 즉시 켜진 상태를 유지한다', async () => {
    vi.useFakeTimers()
    const requestPermission = vi.fn(() => Promise.resolve('granted' as const))
    fakeMotionWindow(requestPermission)
    nativeShell()
    const runtime = activation(true)

    expect(runtime.statuses.at(-1)).toBe('on')
    runtime.sample()
    await vi.advanceTimersByTimeAsync(NATIVE_MOTION_SAMPLE_WAIT_MS)

    expect(requestPermission).not.toHaveBeenCalled()
    expect(runtime.enable).not.toHaveBeenCalled()
    expect(runtime.stop).not.toHaveBeenCalled()
    runtime.cleanup()
    expect(runtime.stop).toHaveBeenCalledTimes(1)
  })

  it('네이티브에서 1.2초간 표본이 없으면 첫 pointerup에 권한을 요청한다', async () => {
    vi.useFakeTimers()
    const requestPermission = vi.fn(() => Promise.resolve('granted' as const))
    const host = fakeMotionWindow(requestPermission)
    nativeShell()
    const runtime = activation(true)

    await vi.advanceTimersByTimeAsync(NATIVE_MOTION_SAMPLE_WAIT_MS)
    expect(runtime.stop).toHaveBeenCalledTimes(1)
    expect(runtime.statuses.at(-1)).toBe('off')
    expect(requestPermission).not.toHaveBeenCalled()

    host.dispatchEvent(new Event('pointerup'))
    await Promise.resolve()
    expect(requestPermission).toHaveBeenCalledTimes(1)
    runtime.cleanup()
  })

  it('네이티브에서 표본과 requestPermission이 모두 없으면 조용히 구독을 유지한다', async () => {
    vi.useFakeTimers()
    fakeMotionWindow()
    nativeShell()
    const runtime = activation(false)

    await vi.advanceTimersByTimeAsync(NATIVE_MOTION_SAMPLE_WAIT_MS)
    expect(runtime.statuses.at(-1)).toBe('on')
    expect(runtime.enable).not.toHaveBeenCalled()
    expect(runtime.stop).not.toHaveBeenCalled()
    runtime.cleanup()
  })

  it('웹에서는 기존처럼 첫 조작에 권한을 요청한다', async () => {
    const requestPermission = vi.fn(() => Promise.resolve('granted' as const))
    const host = fakeMotionWindow(requestPermission)
    const runtime = activation(true)

    expect(runtime.subscribe).not.toHaveBeenCalled()
    host.dispatchEvent(new Event('pointerup'))
    await Promise.resolve()

    expect(requestPermission).toHaveBeenCalledTimes(1)
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
