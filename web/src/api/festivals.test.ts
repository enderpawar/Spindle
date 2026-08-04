import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearFestivalCache, fetchOldTownFestivalsCached, todayYyyymmdd } from './festivals'

function okList(items: unknown[]) {
  return {
    response: {
      header: { resultCode: '0000', resultMsg: 'OK' },
      body: { items: items.length > 0 ? { item: items } : '', numOfRows: '50', pageNo: '1', totalCount: String(items.length) },
    },
  }
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => clearFestivalCache())

describe('fetchOldTownFestivalsCached — searchFestival2', () => {
  it('허용 엔드포인트·파라미터만 보내고 사용자 좌표·방위각은 넣지 않는다', async () => {
    // 4개 구 병렬 호출이 각자 새 Response를 받도록 매 호출 새로 생성
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(okList([]))))
    await fetchOldTownFestivalsCached('20260708', fetchMock as typeof fetch)

    expect(fetchMock).toHaveBeenCalledTimes(4) // 4개 구 병렬
    for (const call of fetchMock.mock.calls) {
      const url = String(call[0])
      expect(url).toContain('/api/searchFestival2')
      expect(url).toContain('eventStartDate=20260708')
      expect(url).toContain('areaCode=6')
      // 좌표·방위각 파라미터가 절대 없어야 한다 (절대 원칙 1)
      expect(url).not.toMatch(/lat|lon|lng|heading|bearing|azimuth|map[xy]/i)
    }
  })

  it('sigungucode→구 매핑과 http→https 이미지 정규화를 수행한다', async () => {
    const item = {
      contentid: '100',
      title: '광복로 축제',
      eventstartdate: '20260705',
      eventenddate: '20260712',
      firstimage: 'http://tong.visitkorea.or.kr/a.jpg',
      addr1: '부산광역시 중구',
      sigungucode: '15',
    }
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(okList([item]))))
    const festivals = await fetchOldTownFestivalsCached('20260708', fetchMock as typeof fetch)
    const f = festivals.find((x) => x.contentId === '100')
    expect(f?.district).toBe('중구')
    expect(f?.imageUrl).toBe('https://tong.visitkorea.or.kr/a.jpg')
    expect(f?.startDate).toBe('20260705')
  })

  it('todayYyyymmdd는 8자리 YYYYMMDD를 만든다', () => {
    expect(todayYyyymmdd(new Date(2026, 6, 8))).toBe('20260708')
    expect(todayYyyymmdd(new Date(2026, 0, 1))).toBe('20260101')
  })
})
