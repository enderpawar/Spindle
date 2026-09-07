import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearMotionPermissionForTest, knownMotionPermission } from './motion'
import { installNativeMotionPermissionWarmup } from './useNativeMotionPermissionWarmup'

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

function setupNative(permissionRequest: () => Promise<'granted' | 'denied'>): EventTarget {
  const host = new EventTarget()
  Object.assign(host, {
    DeviceMotionEvent: Object.assign(function DeviceMotionEvent() {}, {
      requestPermission: permissionRequest,
    }),
  })
  vi.stubGlobal('window', host)
  ;(globalThis as CapacitorTestGlobal).Capacitor = { isNativePlatform: () => true }
  return host
}

describe('앱 최초 네이티브 모션 권한 제스처', () => {
  it('내비 탭을 포함한 최초 pointerup에서 한 번 요청하고 리스너를 해제한다', async () => {
    const requestPermission = vi.fn(() => Promise.resolve('granted' as const))
    const host = setupNative(requestPermission)
    const cleanup = installNativeMotionPermissionWarmup()

    host.dispatchEvent(new Event('pointerup'))
    host.dispatchEvent(new Event('pointerup'))

    expect(requestPermission).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(knownMotionPermission()).toBe('granted'))
    cleanup()
  })

  it('웹에서는 전역 모션 권한 제스처를 설치하지 않는다', () => {
    const requestPermission = vi.fn(() => Promise.resolve('granted' as const))
    const host = new EventTarget()
    Object.assign(host, {
      DeviceMotionEvent: Object.assign(function DeviceMotionEvent() {}, { requestPermission }),
    })
    vi.stubGlobal('window', host)

    const cleanup = installNativeMotionPermissionWarmup()
    host.dispatchEvent(new Event('pointerup'))

    expect(requestPermission).not.toHaveBeenCalled()
    cleanup()
  })

  it('이미 권한이 확정됐으면 전역 제스처 리스너를 설치하지 않는다', async () => {
    const requestPermission = vi.fn(() => Promise.resolve('denied' as const))
    const host = setupNative(requestPermission)
    host.dispatchEvent(new Event('pointerup'))
    const firstCleanup = installNativeMotionPermissionWarmup()
    host.dispatchEvent(new Event('pointerup'))
    await vi.waitFor(() => expect(knownMotionPermission()).toBe('denied'))
    firstCleanup()

    const secondCleanup = installNativeMotionPermissionWarmup()
    host.dispatchEvent(new Event('pointerup'))
    expect(requestPermission).toHaveBeenCalledTimes(1)
    secondCleanup()
  })
})
