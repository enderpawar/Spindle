import { describe, expect, it } from 'vitest'
import { fieldOriginFrom } from './useFieldMode'
import { zoneOf } from '../engine/zones'
import { kakaoMapCourseWalkUrl, kakaoMapDirectionsUrl } from '../lib/mapLinks'

// 남포동 일대 — 존 안. 서울시청 — 권역 밖.
const NAMPO = { lat: 35.0977, lng: 129.0301 }
const SEOUL = { lat: 37.5665, lng: 126.978 }

describe('현장 모드 출발점', () => {
  it('GeoPoint의 lng를 Departure의 lon으로 옮겨 담는다', () => {
    const origin = fieldOriginFrom(NAMPO)
    expect(origin).toEqual({ id: 'field-current', name: '내 위치', desc: '현재 위치 기준', lat: NAMPO.lat, lon: NAMPO.lng })
  })

  it('권역 판정으로 현장 모드 진입 가능 여부를 가른다', () => {
    expect(zoneOf(NAMPO)).not.toBeNull()
    expect(zoneOf(SEOUL)).toBeNull()
  })

  it('현재 위치 좌표는 카카오맵 링크 어디에도 들어가지 않는다', () => {
    const origin = fieldOriginFrom(NAMPO)
    const stops = [
      { name: '깡깡이 예술마을', lat: 35.0921, lon: 129.0367 },
      { name: '흰여울문화마을', lat: 35.0787, lon: 129.0448 },
    ]
    const urls = [kakaoMapCourseWalkUrl(stops), kakaoMapDirectionsUrl(stops[0].name, stops[0].lat, stops[0].lon)]
    for (const url of urls) {
      expect(url).not.toBeNull()
      expect(url).not.toContain(String(origin.lat))
      expect(url).not.toContain(String(origin.lon))
    }
  })
})
