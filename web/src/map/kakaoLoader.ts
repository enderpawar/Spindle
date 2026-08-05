export interface KakaoLatLng {
  getLat(): number
  getLng(): number
}

export interface KakaoLatLngBounds {
  extend(position: KakaoLatLng): void
}

export interface KakaoPoint {
  x: number
  y: number
}

/** 좌표↔컨테이너 픽셀 변환 — 선택 핀을 시트 위쪽에 맞출 때만 쓴다. */
export interface KakaoProjection {
  containerPointFromCoords(position: KakaoLatLng): KakaoPoint
  coordsFromContainerPoint(point: KakaoPoint): KakaoLatLng
}

export interface KakaoMap {
  getProjection(): KakaoProjection
  /** 현재 지도 중심 — 출발점 찍기 모드에서 화면 중앙 좌표를 읽는 데만 쓴다 (단말 내 계산). */
  getCenter(): KakaoLatLng
  setBounds(
    bounds: KakaoLatLngBounds,
    paddingTop?: number,
    paddingRight?: number,
    paddingBottom?: number,
    paddingLeft?: number,
  ): void
  panTo(position: KakaoLatLng): void
  panBy(dx: number, dy: number): void
  setCenter(position: KakaoLatLng): void
  getLevel(): number
  setLevel(level: number, options?: { animate?: boolean }): void
  relayout(): void
}

export interface KakaoCustomOverlay {
  setMap(map: KakaoMap | null): void
  setPosition(position: KakaoLatLng): void
  setZIndex(zIndex: number): void
}

export interface KakaoPolyline {
  setMap(map: KakaoMap | null): void
  setPath(path: KakaoLatLng[]): void
}

type KakaoMapEvent = 'click' | 'dragstart' | 'zoom_changed' | 'idle'
type KakaoMapEventListener = () => void

export interface KakaoMapsNs {
  load(callback: () => void): void
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap
  LatLng: new (lat: number, lng: number) => KakaoLatLng
  LatLngBounds: new () => KakaoLatLngBounds
  Point: new (x: number, y: number) => KakaoPoint
  CustomOverlay: new (options: {
    position: KakaoLatLng
    content: HTMLElement
    xAnchor: number
    yAnchor: number
    zIndex: number
    clickable: boolean
  }) => KakaoCustomOverlay
  Polyline: new (options: {
    path: KakaoLatLng[]
    strokeWeight: number
    strokeColor: string
    strokeOpacity: number
    strokeStyle: 'shortdash'
  }) => KakaoPolyline
  event: {
    addListener(target: KakaoMap, type: KakaoMapEvent, listener: KakaoMapEventListener): void
    removeListener(target: KakaoMap, type: KakaoMapEvent, listener: KakaoMapEventListener): void
  }
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsNs }
  }
}

const SCRIPT_MARKER = 'data-spindle-kakao-maps'
const LOAD_TIMEOUT_MS = 10_000

let loaderPromise: Promise<KakaoMapsNs> | null = null

/** SDK 스크립트와 초기화를 한 번만 공유하고, 실패한 시도는 다음 호출에서 재시도한다. */
export function loadKakaoMaps(): Promise<KakaoMapsNs> {
  if (loaderPromise) return loaderPromise

  const key = import.meta.env.VITE_KAKAO_JS_KEY?.trim()
  if (!key) return Promise.reject(new Error('VITE_KAKAO_JS_KEY가 비어 있습니다.'))

  const attempt = new Promise<KakaoMapsNs>((resolve, reject) => {
    let settled = false
    let script = document.querySelector<HTMLScriptElement>(`script[${SCRIPT_MARKER}]`)

    const finish = (maps: KakaoMapsNs) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      resolve(maps)
    }

    const fail = (reason: string) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      script?.remove()
      reject(new Error(reason))
    }

    const initialize = () => {
      const maps = window.kakao?.maps
      if (!maps) {
        fail('카카오맵 SDK 전역 객체를 찾을 수 없습니다.')
        return
      }
      try {
        maps.load(() => finish(maps))
      } catch {
        fail('카카오맵 SDK 초기화에 실패했습니다.')
      }
    }

    const timeoutId = window.setTimeout(() => {
      fail('카카오맵 SDK 로드 시간이 10초를 넘었습니다.')
    }, LOAD_TIMEOUT_MS)

    if (window.kakao?.maps) {
      initialize()
      return
    }

    const isNewScript = !script
    if (!script) {
      script = document.createElement('script')
      script.setAttribute(SCRIPT_MARKER, '')
      script.async = true
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`
    }

    script.addEventListener('load', initialize, { once: true })
    script.addEventListener('error', () => fail('카카오맵 SDK 스크립트를 불러오지 못했습니다.'), { once: true })
    if (isNewScript) document.head.appendChild(script)
  })

  loaderPromise = attempt
  void attempt.catch(() => {
    if (loaderPromise === attempt) loaderPromise = null
  })
  return attempt
}
