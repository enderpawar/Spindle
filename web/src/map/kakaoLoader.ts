import { isNativeShell } from '../native/shell'

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

/**
 * 마지막 로드 결과 — 설정 화면이 읽어 사용자에게 보여 준다.
 *
 * 실기기에서만 재현되는 실패를 여러 번 겪었는데(iOS 앱의 Referer 도메인 검사), 개발 머신이
 * Windows라 Safari 웹 인스펙터로 콘솔을 볼 수 없다. 사유를 화면에 남기지 않으면 빌드를
 * 올려 가며 추측할 수밖에 없다. 지도가 내장 지도로 바뀐 이유는 사용자에게도 정당한 정보다.
 */
let lastResult: { ok: boolean; reason?: string } | null = null

export function kakaoLoadResult(): { ok: boolean; reason?: string } | null {
  return lastResult
}

/** SDK 스크립트와 초기화를 한 번만 공유하고, 실패한 시도는 다음 호출에서 재시도한다. */
export function loadKakaoMaps(): Promise<KakaoMapsNs> {
  if (loaderPromise) return loaderPromise

  const key = import.meta.env.VITE_KAKAO_JS_KEY?.trim()
  if (!key) {
    lastResult = { ok: false, reason: 'VITE_KAKAO_JS_KEY가 비어 있습니다.' }
    return Promise.reject(new Error(lastResult.reason))
  }

  const attempt = new Promise<KakaoMapsNs>((resolve, reject) => {
    let settled = false
    let script = document.querySelector<HTMLScriptElement>(`script[${SCRIPT_MARKER}]`)

    const finish = (maps: KakaoMapsNs) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      lastResult = { ok: true }
      resolve(maps)
    }

    const fail = (reason: string) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      script?.remove()
      lastResult = { ok: false, reason }
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
      // 카카오는 Referer로 도메인 제한을 검사하는데 커스텀 스킴의 호스트를 파싱하지 못한다.
      // iOS 앱(capacitor://localhost)에서 온 요청을 `caller=capacitor:` 로 읽고 401로 거절하며,
      // 콘솔에 등록해도 비교할 문자열이 만들어지지 않아 통과할 수 없다. Referer가 없으면
      // 200으로 내려준다(실제 응답으로 확인).
      //
      // main.tsx가 문서 정책(<meta name="referrer">)도 걸지만 그것만 믿지 않는다 —
      // 동적으로 삽입한 meta를 엔진이 무시할 수 있어서, 이 요청에는 직접 지정한다.
      // 웹·PWA는 정상 오리진이라 도메인 제한을 그대로 받는다.
      if (isNativeShell()) script.referrerPolicy = 'no-referrer'
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
