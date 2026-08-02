import { useEffect, useState } from 'react'
import { KakaoMapView } from './KakaoMapView'
import { loadKakaoMaps } from './kakaoLoader'
import { LocalMapView, type MapViewProps } from './LocalMapView'

type MapMode = 'loading' | 'kakao' | 'local'

/** 키와 네트워크가 준비되면 카카오맵을 쓰고, 실패하면 내장 지도에 머문다. */
export function MapView(props: MapViewProps) {
  const [mode, setMode] = useState<MapMode>('loading')
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

  if (mode === 'kakao') return <KakaoMapView {...props} />
  if (mode === 'local') return <LocalMapView {...props} />
  return <div style={{ position: 'absolute', inset: 0, background: '#c3dcf9' }} />
}
