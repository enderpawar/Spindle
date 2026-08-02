import { afterEach, describe, expect, it, vi } from 'vitest'
import { GeoFixError, watchCurrentFix } from './geolocation'

afterEach(() => vi.unstubAllGlobals())

describe('활성 코스 위치 구독', () => {
  it('정확도와 좌표를 콜백에만 전달하고 해제 시 clearWatch를 호출한다', () => {
    const clearWatch = vi.fn()
    const watchPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 35.1, longitude: 129.03, accuracy: 24 },
        timestamp: 1234,
      } as GeolocationPosition)
      return 17
    })
    vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch } })
    const onFix = vi.fn()
    const stop = watchCurrentFix(onFix, vi.fn())

    expect(onFix).toHaveBeenCalledWith({
      point: { lat: 35.1, lng: 129.03 },
      accuracyM: 24,
      timestamp: 1234,
    })
    stop()
    expect(clearWatch).toHaveBeenCalledWith(17)
  })

  it('미지원 환경은 오류를 반환하고 안전한 빈 해제 함수를 준다', () => {
    vi.stubGlobal('navigator', {})
    const onError = vi.fn()
    const stop = watchCurrentFix(vi.fn(), onError)
    expect(onError.mock.calls[0][0]).toBeInstanceOf(GeoFixError)
    expect(onError.mock.calls[0][0].kind).toBe('unsupported')
    expect(() => stop()).not.toThrow()
  })
})
