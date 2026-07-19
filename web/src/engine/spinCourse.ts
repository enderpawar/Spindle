/**
 * 스핀 단일 추천 → 방향 기반 여행 코스 브리지 (docs/course.md).
 *
 * 화면(별이 앱)의 Poi·Departure·이동시간 예산을 코스 엔진(engine/course)에 연결하고,
 * 결과를 다시 화면용 Poi 배열로 되돌린다. 후보 선정·구간 이동비용·방문 순서 계산은
 * 전부 단말 내에서 수행하고, 외부 경로 API는 호출하지 않는다 (AGENTS.md 절대 원칙 1).
 *
 * 첫 장소(anchor)는 사용자가 보고 있던 추천 장소로 고정하며 다시 추첨하지 않는다.
 * 코스의 기준 방위는 "출발점 → 첫 장소"의 실제 방위각이다 — 즉 첫 장소가 방향 앵커다
 * (docs/course.md §1·§3). 인접 확장이 필요하면 코스 엔진이 ±67.5°까지만 넓히고
 * 전방위로는 넓히지 않는다.
 */
import { directionScore, sectorCenterDeg, sectorOf } from './compass'
import { COURSE_REASON, buildCourse } from './course'
import { tierOf } from './curation'
import { bearingDeg } from './geo'
import type { DialMinutes, RankedCandidate } from './recommend'
import {
  ENGINE_POIS,
  POI_BY_CONTENT_ID,
  dispersionWeightOf,
  toGeo,
} from './spinRecommend'
import { travelMinutes, type TravelEstimate } from './zones'
import { directionFromHeading, type Departure, type DirectionInfo, type Poi } from '../mock/pois'

export interface CourseStopView {
  poi: Poi
  /** 1-based 방문 순서 */
  order: number
  /** 이전 지점(출발점 또는 직전 장소)에서 이 장소까지의 보정 이동시간(분, 반올림) */
  legMinutes: number
  /** 출발점부터 이 장소까지 누적 보정 이동시간(분, 반올림) */
  totalMinutes: number
  method: TravelEstimate['method']
}

export type ReadyCourse = {
  status: 'ready'
  direction: DirectionInfo
  stops: CourseStopView[]
  totalMinutes: number
  /** 인접 확장·축소 코스·바다 방향 등 사용자에게 보여줄 사유 (없으면 빈 배열) */
  reasons: string[]
  targetCount: number
}

export type AppCourse = ReadyCourse | { status: 'unavailable'; reason: string }

export interface BuildCourseFromAnchorInput {
  departure: Departure
  /** 이동시간 예산(분) — Infinity = 하루 */
  budgetMinutes: DialMinutes
  /** 단일 추천에서 사용자가 보고 있던 장소 — 코스의 첫 장소로 고정 */
  anchor: Poi
  /** 단일 추천에서 방위 확장 등이 있었으면 그 사유를 코스 화면에도 유지 (docs/course.md §3) */
  noteReason?: string
  /** 운영 상태 점수 훅 (Phase 3 detailIntro2 연동 시). 미지정이면 전부 통과(1). */
  operationScoreOf?: (contentId: string) => number
}

/**
 * 현재 추천 장소를 첫 장소로 고정한 채 이어 갈 수 있는 2~4개 코스를 만든다.
 * 코스를 만들 장소가 부족하면(2곳 미만) `unavailable`을 돌려주고 화면은 단일 추천을 유지한다.
 */
export function buildCourseFromAnchor(input: BuildCourseFromAnchorInput): AppCourse {
  const origin = toGeo(input.departure)
  const anchorPoint = { lat: input.anchor.lat, lng: input.anchor.lon }
  // 코스 기준 방위 = 출발점에서 첫 장소를 본 실제 방위각 (첫 장소 = 방향 앵커)
  const heading = bearingDeg(origin, anchorPoint)
  const sectorCenter = sectorCenterDeg(sectorOf(heading))

  const first: RankedCandidate = {
    poi: { contentId: input.anchor.contentId, title: input.anchor.name, point: anchorPoint },
    score: directionScore(heading, sectorCenter) * dispersionWeightOf(input.anchor.contentId),
    bearing: heading,
    travel: travelMinutes(origin, anchorPoint),
    tier: tierOf(input.anchor.contentId),
  }

  const result = buildCourse({
    origin,
    heading,
    budgetMinutes: input.budgetMinutes,
    pois: ENGINE_POIS,
    first,
    expansion: 'none',
    operationScoreOf: input.operationScoreOf,
    dispersionWeightOf,
  })

  if (result.status === 'unavailable') {
    return { status: 'unavailable', reason: result.reason }
  }

  const stops: CourseStopView[] = []
  result.stops.forEach((stop, i) => {
    const poi = POI_BY_CONTENT_ID.get(stop.candidate.poi.contentId)
    if (!poi) return
    stops.push({
      poi,
      order: i + 1,
      legMinutes: Math.max(1, Math.round(stop.leg.minutes)),
      totalMinutes: Math.max(1, Math.round(stop.totalMinutes)),
      method: stop.leg.method,
    })
  })

  // 방어적 폴백: 매핑 후 2곳 미만이면 단일 추천을 유지한다 (도달 불가에 가깝지만 데드엔드 차단).
  if (stops.length < 2) {
    return { status: 'unavailable', reason: COURSE_REASON.unavailable }
  }

  const reasons = input.noteReason ? [input.noteReason, ...result.reasons] : result.reasons

  return {
    status: 'ready',
    direction: directionFromHeading(heading),
    stops,
    totalMinutes: stops[stops.length - 1].totalMinutes,
    reasons: [...new Set(reasons)],
    targetCount: result.targetCount,
  }
}
