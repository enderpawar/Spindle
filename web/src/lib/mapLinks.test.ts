import { describe, expect, it } from 'vitest'
import { kakaoMapCourseWalkUrl, kakaoMapDirectionsUrl, kakaoMapSearchUrl } from './mapLinks'

describe('kakaoMapSearchUrl', () => {
  it('카카오맵 부산 장소 검색 링크를 만든다', () => {
    expect(kakaoMapSearchUrl('흰여울문화마을')).toBe(
      `https://map.kakao.com/link/search/${encodeURIComponent('부산 흰여울문화마을')}`,
    )
  })

  it('장소명의 특수문자를 URL 경로에 안전하게 인코딩한다', () => {
    expect(kakaoMapSearchUrl('시장 & 골목')).not.toContain('&')
  })
})

describe('kakaoMapDirectionsUrl', () => {
  it('사용자 현재 위치 없이 목적지 이름과 POI 좌표만 포함한다', () => {
    expect(kakaoMapDirectionsUrl('자갈치시장', 35.0967, 129.0306)).toBe(
      `https://map.kakao.com/link/to/${encodeURIComponent('자갈치시장')},35.0967,129.0306`,
    )
  })
})

describe('kakaoMapCourseWalkUrl', () => {
  const 자갈치 = { name: '자갈치시장', lat: 35.0967, lon: 129.0306 }
  const 흰여울 = { name: '흰여울문화마을', lat: 35.0787, lon: 129.0429 }
  const 감천 = { name: '감천문화마을', lat: 35.0975, lon: 129.0106 }
  const 태종대 = { name: '태종대', lat: 35.0537, lon: 129.0866 }

  it('도보 이동수단 경로로 코스 방문 순서를 그대로 잇는다', () => {
    expect(kakaoMapCourseWalkUrl([자갈치, 흰여울, 감천])).toBe(
      'https://map.kakao.com/link/by/walk/' +
        `${encodeURIComponent('자갈치시장')},35.0967,129.0306/` +
        `${encodeURIComponent('흰여울문화마을')},35.0787,129.0429/` +
        `${encodeURIComponent('감천문화마을')},35.0975,129.0106`,
    )
  })

  it('순서가 바뀌면 URL 경유지 순서도 바뀐다', () => {
    expect(kakaoMapCourseWalkUrl([흰여울, 자갈치])).not.toBe(kakaoMapCourseWalkUrl([자갈치, 흰여울]))
  })

  it('한글·특수문자 장소명을 경로 구분자와 섞이지 않게 인코딩한다', () => {
    const url = kakaoMapCourseWalkUrl([{ name: '시장 & 골목/샛길, 2호점', lat: 35.1, lon: 129.03 }, 태종대])
    expect(url).toContain(encodeURIComponent('시장 & 골목/샛길, 2호점'))
    expect(url).not.toContain('&')
    // 장소명 안의 / 와 , 가 인코딩돼 경유지 구분자 수는 장소 수 그대로다
    expect(url?.replace('https://map.kakao.com/link/by/walk/', '').split('/')).toHaveLength(2)
  })

  it('2곳·4곳 경계에서 모두 장소 수만큼의 경유지를 만든다', () => {
    const waypoints = (url: string | null) => url?.replace('https://map.kakao.com/link/by/walk/', '').split('/')
    expect(waypoints(kakaoMapCourseWalkUrl([자갈치, 흰여울]))).toHaveLength(2)
    expect(waypoints(kakaoMapCourseWalkUrl([자갈치, 흰여울, 감천, 태종대]))).toHaveLength(4)
  })

  it('좌표가 없는 장소는 제외하고 남은 순서로 잇는다', () => {
    const url = kakaoMapCourseWalkUrl([
      자갈치,
      { name: '좌표없음', lat: Number.NaN, lon: Number.NaN },
      { name: '널섬', lat: 0, lon: 0 },
      흰여울,
    ])
    expect(url).toBe(
      'https://map.kakao.com/link/by/walk/' +
        `${encodeURIComponent('자갈치시장')},35.0967,129.0306/` +
        `${encodeURIComponent('흰여울문화마을')},35.0787,129.0429`,
    )
  })

  it('유효 좌표가 2곳 미만이면 null — 화면은 장소별 길찾기만 제공한다', () => {
    expect(kakaoMapCourseWalkUrl([자갈치])).toBeNull()
    expect(kakaoMapCourseWalkUrl([자갈치, { name: '범위밖', lat: 999, lon: 999 }])).toBeNull()
    expect(kakaoMapCourseWalkUrl([])).toBeNull()
  })

  it('사용자 위치·방위 데이터를 URL에 넣지 않는다 (절대 원칙 1)', () => {
    const userLat = 35.1631
    const userLon = 129.1635
    const url = kakaoMapCourseWalkUrl([자갈치, 흰여울, 감천]) ?? ''
    expect(url).not.toContain(String(userLat))
    expect(url).not.toContain(String(userLon))
    // 좌표 토큰은 코스 장소 수만큼만 존재한다 — 현재 위치·출발점·방위각이 끼어들 자리가 없다
    expect(url.match(/,3[0-9]\.[0-9]+,1[0-9]{2}\.[0-9]+/g)).toHaveLength(3)
  })
})
