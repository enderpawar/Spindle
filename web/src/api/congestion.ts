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

/** 정규화 후 완전히 같은 이름이 유일할 때만 연결한다. */
function exactPoiMatch(pois: readonly NamedPoi[], target: string): NamedPoi | undefined {
  const exact = pois.filter((poi) => normalizeAttractionName(poi.name) === target)
  return exact.length === 1 ? exact[0] : undefined
}

/** 공식명에 지역명·시설 유형이 덧붙는 경우만 보수적으로 포괄 매칭한다. */
function containedPoiMatch(pois: readonly NamedPoi[], target: string): NamedPoi | undefined {
  const contained = pois.filter((poi) => {
    const candidate = normalizeAttractionName(poi.name)
    return Math.min(candidate.length, target.length) >= 4 &&
      (candidate.includes(target) || target.includes(candidate))
  })
  return contained.length === 1 ? contained[0] : undefined
}

/** 같은 POI에 여러 예측이 걸리면 보수적으로 가장 높은 값을 남긴다. */
function keepHigher(
  matched: Map<string, CongestionForecast>,
  poiId: string,
  forecast: CongestionForecast,
): void {
  const previous = matched.get(poiId)
  if (!previous || forecast.rate > previous.rate) matched.set(poiId, forecast)
}

/**
 * 당일 예측을 POI id로 색인한다.
 *
 * 정확 일치를 먼저 확정하고 포함 매칭은 남은 POI에만 허용한다 — "국제시장"과
 * "국제시장 먹자골목"처럼 한쪽이 다른 쪽 이름을 통째로 포함하는 별개 관광지가
 * 실제로 존재해서, 한 번에 처리하면 남의 혼잡도가 옮겨붙는다.
 */
function matchForecastsToPois(
  pois: readonly NamedPoi[],
  forecasts: readonly CongestionForecast[],
  targetDate: string,
): ReadonlyMap<string, CongestionForecast> {
  const matched = new Map<string, CongestionForecast>()
  const pending: { target: string; forecast: CongestionForecast }[] = []

  // 1패스 — 이름이 정확히 같은 예측만 POI를 선점한다.
  for (const forecast of forecasts) {
    if (forecast.forecastDate !== targetDate) continue
    const target = normalizeAttractionName(forecast.attractionName)
    if (!target) continue
    const poi = exactPoiMatch(pois, target)
    if (poi) keepHigher(matched, poi.id, forecast)
    else pending.push({ target, forecast })
  }

  // 2패스 — 포함 매칭은 선점되지 않은 POI에만 건다. 서로 다른 관광지명이 같은 POI를
  // 노리면 어느 쪽이 그 장소인지 알 수 없으므로 둘 다 버린다.
  const claims = new Map<string, { names: Set<string>; forecasts: CongestionForecast[] }>()
  for (const { target, forecast } of pending) {
    const poi = containedPoiMatch(pois, target)
    if (!poi || matched.has(poi.id)) continue
    const claim = claims.get(poi.id) ?? { names: new Set<string>(), forecasts: [] }
    claim.names.add(target)
    claim.forecasts.push(forecast)
    claims.set(poi.id, claim)
  }
  for (const [poiId, claim] of claims) {
    if (claim.names.size > 1) continue
    for (const forecast of claim.forecasts) keepHigher(matched, poiId, forecast)
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
