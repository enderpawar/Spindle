import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { loadKakaoMaps } from './kakaoLoader'
import type { MapViewProps } from './LocalMapView'
import { MapChunkBoundary } from './MapChunkBoundary'

type MapMode = 'loading' | 'kakao' | 'local'

/*
 * 지도 구현은 초기 번들에서 빼고 지도를 실제로 여는 화면에서만 받는다.
 * 홈·스핀·리빌·결과(심사 시연 동선)는 지도를 그리지 않으므로 그만큼 첫 화면이 가벼워진다.
 *
 * 경계를 화면이 아니라 이 서브트리에 두는 이유: 화면 전환은 `viewTransition.ts`가
 * `startViewTransition(() => flushSync(...))`로 스냅샷을 찍는다. 화면 자체가 지연 로드면
 * flushSync가 Suspense fallback을 동기 커밋해 전환 스냅샷에 빈 화면이 찍힌다.
 * 지도만 나누면 전환은 기존 그대로고, fallback은 지도 자리만 덮는다.
 */
const loadKakaoView = () => import('./KakaoMapView').then((m) => ({ default: m.KakaoMapView }))
const loadLocalView = () => import('./LocalMapView').then((m) => ({ default: m.LocalMapView }))

/**
 * 지도 공급자 컴포넌트를 만든다.
 *
 * `attempt` 값 자체는 쓰지 않지만, 오를 때마다 **새 lazy 컴포넌트**를 돌려주는 것이 목적이다.
 * React.lazy는 실패한 import Promise까지 캐시하므로, 같은 컴포넌트를 다시 그리면 네트워크가
 * 돌아와도 즉시 같은 실패를 되돌려준다. 새로 만들어야 청크를 다시 받는다.
 */
function createMapProvider(mode: MapMode, _attempt: number) {
  return lazy(mode === 'kakao' ? loadKakaoView : loadLocalView)
}

/** 지도가 들어올 자리를 지키는 바다색 판 — 청크를 받는 동안에도 화면이 흔들리지 않는다. */
function MapPlaceholder() {
  return <div style={{ position: 'absolute', inset: 0, background: '#c3dcf9' }} />
}

/** 키와 네트워크가 준비되면 카카오맵을 쓰고, 실패하면 내장 지도에 머문다. */
export function MapView(props: MapViewProps) {
  const [mode, setMode] = useState<MapMode>('loading')
  const [attempt, setAttempt] = useState(0)
  const onProviderChange = props.onProviderChange

  useEffect(() => {
    let active = true
    const key = import.meta.env.VITE_KAKAO_JS_KEY?.trim()

    if (!key) {
      console.info('[지도] 카카오 JavaScript 키가 없어 로컬 지도로 전환합니다.')
      setMode('local')
      onProviderChange?.('local')
      return () => {
        active = false
      }
    }

    void loadKakaoMaps().then(
      () => {
        if (active) {
          setMode('kakao')
          onProviderChange?.('kakao')
        }
      },
      (error: unknown) => {
        console.info('[지도] 카카오맵을 불러오지 못해 로컬 지도로 전환합니다.', error)
        if (active) {
          setMode('local')
          onProviderChange?.('local')
        }
      },
    )

    return () => {
      active = false
    }
  }, [onProviderChange])

  // 재시도(attempt)와 공급자 전환(mode)에서만 새로 만든다 — 사유는 createMapProvider 주석.
  const Provider = useMemo(() => createMapProvider(mode, attempt), [attempt, mode])

  if (mode === 'loading') return <MapPlaceholder />

  return (
    <MapChunkBoundary key={attempt} onRetry={() => setAttempt((n) => n + 1)}>
      <Suspense fallback={<MapPlaceholder />}>
        <Provider {...props} />
      </Suspense>
    </MapChunkBoundary>
  )
}
