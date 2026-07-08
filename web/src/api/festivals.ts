/**
 * 축제 조회 — searchFestival2 (허용 엔드포인트), 항상 프록시(/api) 경유.
 * eventStartDate=오늘로 진행 중·예정 축제를 받고, 기간 판정은 engine/festival.ts에서.
 * 응답은 세션 메모리 캐시(Map)에만 — 영속 저장 금지 (절대 원칙 3). 좌표 무전송 (원칙 1).
 */
import type { Festival } from '../engine/festival'
import { BUSAN_AREA_CODE, OLD_TOWN_REGIONS } from './regionCodes'
import { callTourApi, extractItems, type ListBody } from './tourapi'

type FetchLike = typeof fetch

interface FestivalRaw {
  contentid: string
  title: string
  eventstartdate?: string
  eventenddate?: string
  firstimage?: string
  addr1?: string
  sigungucode?: string
}

const SIGUNGU_TO_DISTRICT = new Map(OLD_TOWN_REGIONS.map((r) => [r.code, r.name]))

function normalizeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  return url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url
}

/** 로컬 날짜 YYYYMMDD */
export function todayYyyymmdd(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

async function fetchDistrictFestivals(
  sigunguCode: string,
  eventStartDate: string,
  fetchImpl: FetchLike,
): Promise<Festival[]> {
  const body = await callTourApi<ListBody<FestivalRaw>>(
    'searchFestival2',
    {
      areaCode: BUSAN_AREA_CODE,
      sigunguCode,
      eventStartDate,
      arrange: 'A',
      numOfRows: '50',
      pageNo: '1',
    },
    fetchImpl,
  )
  return extractItems(body).map((f) => ({
    contentId: f.contentid,
    title: f.title,
    startDate: f.eventstartdate ?? '',
    endDate: f.eventenddate ?? '',
    district: (f.sigungucode ? SIGUNGU_TO_DISTRICT.get(f.sigungucode) : undefined) ?? SIGUNGU_TO_DISTRICT.get(sigunguCode),
    imageUrl: normalizeImageUrl(f.firstimage),
    addr1: f.addr1 || undefined,
  }))
}

// 세션 메모리 캐시 (날짜별). 실패 Promise는 제거해 재시도 가능.
const cache = new Map<string, Promise<Festival[]>>()

/** 원도심·영도 4개 구의 축제를 병렬 조회 (세션 캐시 경유). */
export function fetchOldTownFestivalsCached(
  eventStartDate: string,
  fetchImpl: FetchLike = fetch,
): Promise<Festival[]> {
  const cached = cache.get(eventStartDate)
  if (cached) return cached
  const pending = Promise.all(
    OLD_TOWN_REGIONS.map((region) => fetchDistrictFestivals(region.code, eventStartDate, fetchImpl)),
  )
    .then((lists) => lists.flat())
    .catch((err: unknown) => {
      cache.delete(eventStartDate)
      throw err
    })
  cache.set(eventStartDate, pending)
  return pending
}

/** 테스트용 */
export function clearFestivalCache(): void {
  cache.clear()
}
