/**
 * 관광지 집중률 예측 조회. 사용자 위치와 무관한 부산 법정구역 코드만 프록시에 보낸다.
 * 응답은 세션 메모리에서만 재사용하며 추천 엔진에는 전달하지 않는다.
 */
import { callTourApi, extractItems, toNumber, type ListBody } from './tourapi'

type FetchLike = typeof fetch

export const CONGESTION_THRESHOLD = 70
export const COMFORTABLE_THRESHOLD = 40
const BUSAN_LEGAL_AREA_CODE = '26'
const NUM_OF_ROWS = 100

/** 공공데이터포털 관광지 집중률 API 법정구역 코드, 2026-08-02 확인. */
export const OLD_TOWN_LEGAL_DISTRICTS = [
  { name: '중구', code: '26110' },
  { name: '서구', code: '26140' },
  { name: '동구', code: '26170' },
  { name: '영도구', code: '26200' },
] as const

interface CongestionForecastRaw {
  baseYmd?: string
  areaCd?: string
  signguCd?: string
  tAtsNm?: string
  cnctrRate?: string
}

export interface CongestionForecast {
  forecastDate: string
  districtCode: string
  attractionName: string
  rate: number
}

export interface NamedPoi {
  id: string
  name: string
}

/** 로컬 날짜를 API의 YYYYMMDD 형식으로 만든다. */
export function localYyyymmdd(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function normalizeForecast(raw: CongestionForecastRaw): CongestionForecast | null {
  const rate = toNumber(raw.cnctrRate)
  if (!raw.baseYmd || !raw.signguCd || !raw.tAtsNm?.trim() || rate === undefined) return null
  return {
    forecastDate: raw.baseYmd,
    districtCode: raw.signguCd,
    attractionName: raw.tAtsNm.trim(),
    rate,
  }
}

async function fetchDistrictCongestion(
  districtCode: string,
  fetchImpl: FetchLike,
): Promise<CongestionForecast[]> {
  const all: CongestionForecast[] = []
  let pageNo = 1
  for (;;) {
    const body = await callTourApi<ListBody<CongestionForecastRaw>>(
      'tatsCnctrRatedList',
      {
        areaCd: BUSAN_LEGAL_AREA_CODE,
        signguCd: districtCode,
        numOfRows: String(NUM_OF_ROWS),
        pageNo: String(pageNo),
      },
      fetchImpl,
    )
    const items = extractItems(body)
    for (const item of items) {
      const forecast = normalizeForecast(item)
      if (forecast) all.push(forecast)
    }
    const totalCount = toNumber(String(body.totalCount)) ?? 0
    if (pageNo * NUM_OF_ROWS >= totalCount || items.length === 0) return all
    pageNo += 1
  }
}

// 날짜별 세션 메모리 캐시. 하나라도 실패하면 제거해 전체 지역을 다시 검증할 수 있게 한다.
const sessionCache = new Map<string, Promise<CongestionForecast[]>>()

export function fetchOldTownCongestionCached(
  targetDate: string,
  fetchImpl: FetchLike = fetch,
): Promise<CongestionForecast[]> {
  const cached = sessionCache.get(targetDate)
  if (cached) return cached
  const pending = Promise.all(
    OLD_TOWN_LEGAL_DISTRICTS.map((district) =>
      fetchDistrictCongestion(district.code, fetchImpl),
    ),
  )
    .then((lists) => lists.flat())
    .catch((error: unknown) => {
      sessionCache.delete(targetDate)
      throw error
    })
  sessionCache.set(targetDate, pending)
  return pending
}

/** 비교용 이름 정규화. 괄호·공백·구두점을 제거하고 한글·영숫자만 남긴다. */
export function normalizeAttractionName(name: string): string {
  return name.toLocaleLowerCase('ko-KR').replace(/[^가-힣a-z0-9]/g, '')
}

function uniquePoiMatch(pois: readonly NamedPoi[], attractionName: string): NamedPoi | undefined {
  const target = normalizeAttractionName(attractionName)
  if (!target) return undefined
  const exact = pois.filter((poi) => normalizeAttractionName(poi.name) === target)
  if (exact.length === 1) return exact[0]

  // 공식명에 지역명·시설 유형이 덧붙는 경우만 보수적으로 포괄 매칭한다.
  const contained = pois.filter((poi) => {
    const candidate = normalizeAttractionName(poi.name)
    return Math.min(candidate.length, target.length) >= 4 &&
      (candidate.includes(target) || target.includes(candidate))
  })
  return contained.length === 1 ? contained[0] : undefined
}

/** 당일 예측을 POI id로 색인한다. 중복 예측은 보수적으로 가장 높은 값을 사용한다. */
function matchForecastsToPois(
  pois: readonly NamedPoi[],
  forecasts: readonly CongestionForecast[],
  targetDate: string,
): ReadonlyMap<string, CongestionForecast> {
  const matched = new Map<string, CongestionForecast>()
  for (const forecast of forecasts) {
    if (forecast.forecastDate !== targetDate) continue
    const poi = uniquePoiMatch(pois, forecast.attractionName)
    if (!poi) continue
    const previous = matched.get(poi.id)
    if (!previous || forecast.rate > previous.rate) matched.set(poi.id, forecast)
  }
  return matched
}

/** 당일 기준 이상 예측만 POI id로 색인한다. */
export function matchBusyPois(
  pois: readonly NamedPoi[],
  forecasts: readonly CongestionForecast[],
  targetDate: string,
): ReadonlyMap<string, CongestionForecast> {
  return new Map(
    [...matchForecastsToPois(pois, forecasts, targetDate)]
      .filter(([, forecast]) => forecast.rate >= CONGESTION_THRESHOLD),
  )
}

/** 당일 최고 예측값까지 기준 이하인 장소만 '가기 좋음'으로 보수적으로 색인한다. */
export function matchComfortablePois(
  pois: readonly NamedPoi[],
  forecasts: readonly CongestionForecast[],
  targetDate: string,
): ReadonlyMap<string, CongestionForecast> {
  return new Map(
    [...matchForecastsToPois(pois, forecasts, targetDate)]
      .filter(([, forecast]) => forecast.rate <= COMFORTABLE_THRESHOLD),
  )
}

/** 테스트용 */
export function clearCongestionCache(): void {
  sessionCache.clear()
}
