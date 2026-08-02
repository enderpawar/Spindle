import { describe, expect, it } from 'vitest'
import { kakaoMapSearchUrl } from './mapLinks'

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
