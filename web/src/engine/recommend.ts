/**
 * 추천 엔진 — algorithm 스킬 규약 (SPEC.md 4장).
 * 후보 점수 = 방향 일치도 × 접근 가능성 × 운영 상태 × 분산 가중치.
 * 모든 계산은 단말 내에서만 수행한다 (좌표 무전송).
 */
import {
  SECTOR_KO,
  directionScore,
  sectorCenterDeg,
  sectorOf,
  type Sector,
} from "./compass";
import { dispersionWeight, tierOf, type Tier } from "./curation";
import { bearingDeg, type GeoPoint } from "./geo";
import { travelMinutes, type TravelEstimate } from "./zones";
import type { Rng } from "./rng";

/** 이동시간 다이얼 (ui.md S1: 가볍게 / 반나절 / 하루 나들이) */
export type Dial = "light" | "half" | "day";

/** 다이얼 임계값(분) — 초과 = 제외. 하루 나들이는 권역 내 무제한 (algorithm 스킬) */
export const DIAL_LIMIT_MIN: Record<Dial, number> = {
  light: 20,
  half: 40,
  day: Infinity,
};

/** 임계 "초과"만 제외 — 경계값(20분·40분 정각)은 포함 */
export function withinDial(estimate: TravelEstimate, dial: Dial): boolean {
  if (dial === "day") return true; // 권역 내 전체 허용 (연결 미정의 존 쌍 포함)
  if (!estimate.connected) return false; // 연결 정의 없는 존 쌍은 하루 나들이 전용 (zones.md)
  return estimate.minutes <= DIAL_LIMIT_MIN[dial];
}

/** 엔진 입력 POI — API 계층에서 변환해 전달 (좌표는 단말 내 계산 전용) */
export interface EnginePoi {
  contentId: string;
  title: string;
  point: GeoPoint;
}

export interface RankedCandidate {
  poi: EnginePoi;
  score: number;
  bearing: number;
  travel: TravelEstimate;
  tier: Tier;
}

export type ExpansionLevel = "none" | "adjacent" | "wide";

export const EXPANSION_REASON = {
  /** 부채꼴 안에 POI 자체가 없음 (원도심 기준 대개 바다 방향) — ui.md 카피 */
  adjacentNoPoi: "이 방향은 바다예요. 범위를 넓혔어요",
  /** POI는 있으나 다이얼·운영 조건으로 전부 제외됨 */
  adjacentFiltered: "이 시간 안에 갈 곳이 없어요. 범위를 넓혔어요",
  /** 인접 확장 후에도 0개 → 반대편 제외 전방위 */
  wide: "주변 방위에도 없어서 크게 넓혔어요",
} as const;

export interface RecommendInput {
  origin: GeoPoint;
  /** 스핀 정지 방위각 — 연출 최종 각도와 반드시 동일 값 (sensors 스킬) */
  heading: number;
  dial: Dial;
  pois: readonly EnginePoi[];
  rng: Rng;
  /** 직전 당첨 POI — 같은 세션 연속 당첨 방지로 임시 제외 */
  prevContentId?: string;
  /** 운영 상태 점수 (Phase 3에서 detailIntro2 연동) — 기본 1.0 보수 통과 */
  operationScoreOf?: (contentId: string) => number;
}

export interface RecommendResult {
  sector: Sector;
  sectorKo: string;
  expansion: ExpansionLevel;
  /** 확장 발생 시 UI에 반드시 노출할 사유 (algorithm 스킬) */
  expansionReason?: string;
  /** 가중 랜덤으로 선정된 1곳 (후보 0개면 undefined) */
  picked?: RankedCandidate;
  /** "다른 후보 보기" 순환용 나머지 (최대 2곳, 점수순) */
  alternates: RankedCandidate[];
}

/** 확장 단계별 허용 반각: 부채꼴 22.5° → 인접 ±45°(67.5°) → 반대편 제외 전방위(157.5°) */
const HALF_WIDTH_BY_LEVEL: Record<ExpansionLevel, number> = {
  none: 22.5,
  adjacent: 67.5,
  wide: 157.5,
};

function rankCandidates(
  input: RecommendInput,
  sectorCenter: number,
  halfWidth: number,
): RankedCandidate[] {
  const operationScoreOf = input.operationScoreOf ?? (() => 1);
  const ranked: RankedCandidate[] = [];
  for (const poi of input.pois) {
    if (poi.contentId === input.prevContentId) continue;
    const bearing = bearingDeg(input.origin, poi.point);
    const direction = directionScore(bearing, sectorCenter, halfWidth);
    if (direction === 0) continue;
    const travel = travelMinutes(input.origin, poi.point);
    if (!withinDial(travel, input.dial)) continue; // 접근 가능성 0 → 제외
    const score = direction * 1 * operationScoreOf(poi.contentId) * dispersionWeight(poi.contentId);
    if (score <= 0) continue;
    ranked.push({ poi, score, bearing, travel, tier: tierOf(poi.contentId) });
  }
  return ranked.sort((a, b) => b.score - a.score);
}

/** 점수 상위 3개 중 점수 비례 가중 랜덤으로 1곳 선정 */
export function pickWeighted(top: readonly RankedCandidate[], rng: Rng): RankedCandidate {
  const total = top.reduce((sum, c) => sum + c.score, 0);
  let r = rng() * total;
  for (const c of top) {
    r -= c.score;
    if (r <= 0) return c;
  }
  return top[top.length - 1];
}

export function recommend(input: RecommendInput): RecommendResult {
  const sector = sectorOf(input.heading);
  const sectorCenter = sectorCenterDeg(sector);

  // 부채꼴 안에 (다이얼 무관하게) POI가 하나라도 있는지 — 확장 사유 구분용
  const hasAnyPoiInSector = input.pois.some(
    (poi) =>
      poi.contentId !== input.prevContentId &&
      directionScore(bearingDeg(input.origin, poi.point), sectorCenter) > 0,
  );

  for (const level of ["none", "adjacent", "wide"] as const) {
    const ranked = rankCandidates(input, sectorCenter, HALF_WIDTH_BY_LEVEL[level]);
    if (ranked.length === 0) continue;

    const top = ranked.slice(0, 3);
    const picked = pickWeighted(top, input.rng);
    const alternates = top.filter((c) => c !== picked);
    const expansionReason =
      level === "none"
        ? undefined
        : level === "adjacent"
          ? hasAnyPoiInSector
            ? EXPANSION_REASON.adjacentFiltered
            : EXPANSION_REASON.adjacentNoPoi
          : EXPANSION_REASON.wide;

    return {
      sector,
      sectorKo: SECTOR_KO[sector],
      expansion: level,
      expansionReason,
      picked,
      alternates,
    };
  }

  return {
    sector,
    sectorKo: SECTOR_KO[sector],
    expansion: "wide",
    expansionReason: EXPANSION_REASON.wide,
    alternates: [],
  };
}
