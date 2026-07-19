/**
 * 방향 기반 여행 코스 엔진 — docs/course.md Phase 7.
 * 출발점·방위·후보 필터·구간 이동비용·방문 순서는 모두 단말 내에서 계산한다.
 */
import { directionScore, sectorCenterDeg, sectorOf, type Sector } from "./compass";
import { dispersionWeight, tierOf } from "./curation";
import { bearingDeg, type GeoPoint } from "./geo";
import {
  type DialMinutes,
  type EnginePoi,
  type ExpansionLevel,
  type RankedCandidate,
} from "./recommend";
import { travelMinutes, type TravelEstimate } from "./zones";

/** 예산(분) → 코스 목표 장소 수 (docs/course.md: 2~4곳). 20분 이하 2곳 · 1시간 이하 3곳 · 그 이상/하루 4곳 */
export function courseTargetCount(budgetMinutes: DialMinutes): number {
  if (!Number.isFinite(budgetMinutes)) return 4;
  if (budgetMinutes <= 20) return 2;
  if (budgetMinutes <= 60) return 3;
  return 4;
}

export const COURSE_REASON = {
  adjacent: "이어 갈 장소가 적어 인접 방위까지 넓혔어요",
  shortened: "목표보다 적지만 가능한 코스로 줄였어요",
  unavailable: "이 방향에서는 코스를 만들 장소가 부족해요",
} as const;

export interface CourseStop {
  candidate: RankedCandidate;
  /** 이전 지점에서 이 장소까지의 보정 이동시간. 첫 장소는 출발점→첫 장소. */
  leg: TravelEstimate;
  totalMinutes: number;
}

export type CourseResult =
  | {
      status: "ready";
      sector: Sector;
      stops: CourseStop[];
      targetCount: number;
      totalMinutes: number;
      reasons: string[];
    }
  | {
      status: "unavailable";
      sector: Sector;
      reason: string;
    };

type TravelEstimator = (from: GeoPoint, to: GeoPoint) => TravelEstimate;

export interface BuildCourseInput {
  origin: GeoPoint;
  heading: number;
  budgetMinutes: DialMinutes;
  pois: readonly EnginePoi[];
  /** 단일 추천 결과의 현재 장소. 코스의 첫 장소로 고정한다. */
  first: RankedCandidate;
  expansion: ExpansionLevel;
  expansionReason?: string;
  /** 운영 상태가 확실히 휴무면 0. 파싱 실패/미조회는 1로 보수 통과. */
  operationScoreOf?: (contentId: string) => number;
  /**
   * 분산 가중치 주입 — 기본은 curation.ts의 contentId 표(dispersionWeight).
   * 정적 큐레이션 풀처럼 티어를 다른 곳에서 관리하면 단일 추천과 동일하게 이 훅으로 주입한다.
   */
  dispersionWeightOf?: (contentId: string) => number;
  /** 테스트 주입용. 앱에서는 zones.ts의 travelMinutes를 사용한다. */
  travelEstimateOf?: TravelEstimator;
}

const HALF_WIDTH_BY_LEVEL: Record<ExpansionLevel, number> = {
  none: 22.5,
  adjacent: 67.5,
  wide: 157.5,
};

function canAppend(totalMinutes: number, leg: TravelEstimate, budgetMinutes: DialMinutes): boolean {
  if (!Number.isFinite(budgetMinutes)) return true; // 하루 — 권역 내 무제한
  if (!leg.connected) return false;
  return totalMinutes + leg.minutes <= budgetMinutes;
}

function courseCandidate(
  poi: EnginePoi,
  input: BuildCourseInput,
  sectorCenter: number,
  halfWidth: number,
  estimate: TravelEstimator,
): RankedCandidate | null {
  const operationScore = input.operationScoreOf?.(poi.contentId) ?? 1;
  if (operationScore <= 0) return null;

  const bearing = bearingDeg(input.origin, poi.point);
  const direction = directionScore(bearing, sectorCenter, halfWidth);
  if (direction === 0) return null;

  const dispersion = input.dispersionWeightOf?.(poi.contentId) ?? dispersionWeight(poi.contentId);
  const score = direction * operationScore * dispersion;
  if (score <= 0) return null;

  return {
    poi,
    score,
    bearing,
    travel: estimate(input.origin, poi.point),
    tier: tierOf(poi.contentId),
  };
}

function chooseNext(
  stops: readonly CourseStop[],
  input: BuildCourseInput,
  halfWidth: number,
  estimate: TravelEstimator,
): CourseStop | null {
  const sectorCenter = sectorCenterDeg(sectorOf(input.heading));
  const used = new Set(stops.map((stop) => stop.candidate.poi.contentId));
  const prev = stops[stops.length - 1].candidate.poi.point;
  const total = stops[stops.length - 1].totalMinutes;
  let best: CourseStop | null = null;

  for (const poi of input.pois) {
    if (used.has(poi.contentId)) continue;
    const candidate = courseCandidate(poi, input, sectorCenter, halfWidth, estimate);
    if (!candidate) continue;

    const leg = estimate(prev, candidate.poi.point);
    if (!canAppend(total, leg, input.budgetMinutes)) continue;

    const next: CourseStop = {
      candidate,
      leg,
      totalMinutes: total + leg.minutes,
    };

    if (
      best === null ||
      next.leg.minutes < best.leg.minutes ||
      (next.leg.minutes === best.leg.minutes && next.candidate.score > best.candidate.score) ||
      (next.leg.minutes === best.leg.minutes &&
        next.candidate.score === best.candidate.score &&
        next.candidate.poi.contentId < best.candidate.poi.contentId)
    ) {
      best = next;
    }
  }

  return best;
}

function buildWithHalfWidth(
  input: BuildCourseInput,
  halfWidth: number,
  estimate: TravelEstimator,
): CourseStop[] {
  const targetCount = courseTargetCount(input.budgetMinutes);
  const stops: CourseStop[] = [
    {
      candidate: input.first,
      leg: input.first.travel,
      totalMinutes: input.first.travel.minutes,
    },
  ];

  while (stops.length < targetCount) {
    const next = chooseNext(stops, input, halfWidth, estimate);
    if (!next) break;
    stops.push(next);
  }

  return stops;
}

export function buildCourse(input: BuildCourseInput): CourseResult {
  const sector = sectorOf(input.heading);
  const targetCount = courseTargetCount(input.budgetMinutes);
  const estimate = input.travelEstimateOf ?? travelMinutes;
  const primaryHalfWidth = HALF_WIDTH_BY_LEVEL[input.expansion];
  let stops = buildWithHalfWidth(input, primaryHalfWidth, estimate);
  const reasons = input.expansionReason ? [input.expansionReason] : [];

  // 코스만을 위해 전방위로 넓히지는 않는다. 기본 부채꼴이 부족할 때만 인접 방위까지 허용.
  if (stops.length < targetCount && primaryHalfWidth < HALF_WIDTH_BY_LEVEL.adjacent) {
    const adjacentStops = buildWithHalfWidth(input, HALF_WIDTH_BY_LEVEL.adjacent, estimate);
    if (adjacentStops.length > stops.length) {
      stops = adjacentStops;
      reasons.push(COURSE_REASON.adjacent);
    }
  }

  if (stops.length < 2) {
    return { status: "unavailable", sector, reason: COURSE_REASON.unavailable };
  }

  if (stops.length < targetCount) {
    reasons.push(COURSE_REASON.shortened);
  }

  return {
    status: "ready",
    sector,
    stops,
    targetCount,
    totalMinutes: stops[stops.length - 1].totalMinutes,
    reasons: [...new Set(reasons)],
  };
}
