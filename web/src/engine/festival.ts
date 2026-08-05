/**
 * 축제 특별 카드 (Phase 7 2순위) — 방위+기간이 맞는 축제만 일반 결과 위에 노출.
 * 순수 모듈: 매칭·기간 판정만 담당하고 네트워크는 api/festivals.ts가 맡는다.
 * 축제 위치는 TourAPI 응답의 구(district)만 쓰고, 좌표 필드는 읽지도 보내지도 않는다.
 */
import { DIRECTIONS, POI_POOL, type DirectionId } from '../mock/pois'

export interface Festival {
  contentId: string
  title: string
  /** YYYYMMDD */
  startDate: string
  /** YYYYMMDD */
  endDate: string
  district?: string
  imageUrl?: string
  addr1?: string
}

/** 각 방위가 포함하는 구 — POI_POOL에서 파생 (존-방위 매핑의 단일 출처). */
export const DIRECTION_DISTRICTS: Record<DirectionId, string[]> = (() => {
  const acc = {} as Record<DirectionId, Set<string>>
  for (const dir of DIRECTIONS) acc[dir.id] = new Set<string>()
  for (const poi of POI_POOL) acc[poi.direction].add(poi.district)
  const out = {} as Record<DirectionId, string[]>
  for (const dir of DIRECTIONS) out[dir.id] = [...acc[dir.id]]
  return out
})()

const YYYYMMDD = /^\d{8}$/

/** 오늘(YYYYMMDD)이 축제 기간 안인가. 문자열 8자리 비교로 판정. */
export function isFestivalOngoing(festival: Pick<Festival, 'startDate' | 'endDate'>, today: string): boolean {
  if (!YYYYMMDD.test(festival.startDate) || !YYYYMMDD.test(festival.endDate)) return false
  return festival.startDate <= today && today <= festival.endDate
}

/** 오늘 이후에 시작하는 축제인가 (진행 중은 제외). */
export function isFestivalUpcoming(festival: Pick<Festival, 'startDate' | 'endDate'>, today: string): boolean {
  if (!YYYYMMDD.test(festival.startDate) || !YYYYMMDD.test(festival.endDate)) return false
  return festival.startDate > today
}

export interface FestivalBoard {
  /** 진행 중 목록을 보여주는지, 예정 목록으로 대체했는지 */
  kind: 'ongoing' | 'upcoming'
  festivals: Festival[]
}

/**
 * 축제 화면에 세울 목록 — 진행 중이 있으면 그것만, 하나도 없으면 예정 축제로 대체한다.
 * searchFestival2는 `eventStartDate` 기준으로 진행 중·예정을 함께 돌려주므로
 * 폴백에 추가 호출이 필요 없다 (실호출 확인 2026-08-05: eventStartDate=20260101 응답에
 * 2025-12-05 시작 축제가 포함).
 */
export function festivalBoardFor(festivals: Festival[], today: string): FestivalBoard {
  const ongoing = festivals
    .filter((f) => isFestivalOngoing(f, today))
    .sort((a, b) => a.endDate.localeCompare(b.endDate))
  if (ongoing.length > 0) return { kind: 'ongoing', festivals: ongoing }

  const upcoming = festivals
    .filter((f) => isFestivalUpcoming(f, today))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
  return { kind: 'upcoming', festivals: upcoming }
}

/**
 * 방위+기간이 맞는 축제 하나. 가장 곧 끝나는 것 우선(지금 아니면 놓치는 희소성).
 * 매칭 없으면 null → 특별 카드를 띄우지 않는다.
 */
export function pickFestivalForDirection(
  festivals: Festival[],
  direction: DirectionId,
  today: string,
): Festival | null {
  const districts = new Set(DIRECTION_DISTRICTS[direction] ?? [])
  const matches = festivals.filter(
    (f) => f.district !== undefined && districts.has(f.district) && isFestivalOngoing(f, today),
  )
  if (matches.length === 0) return null
  return [...matches].sort((a, b) => a.endDate.localeCompare(b.endDate))[0]
}
