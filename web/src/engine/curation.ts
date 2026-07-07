/**
 * POI 인기도 티어 분산 가중치 — `docs/curation.md`가 단일 진실 원천.
 * 이 모듈은 가중치 메타데이터만 담는다. TourAPI 응답 내용은 절대 적재하지 않는다.
 *
 * TODO(curation.md): 큐레이션 표가 아직 초안(빈 표)이라 티어 지정이 없다.
 * 9주차 확정 시 contentId → 티어 항목을 채울 것 (Phase 5 전 확정 필수).
 */

export type Tier = "T1" | "T2" | "T3";

export const TIER_WEIGHT: Record<Tier, number> = {
  T1: 0.5,
  T2: 1.0,
  T3: 1.6,
};

// TODO(curation.md): 확정 표 반영 전 — 빈 맵 (전원 T2 취급)
export const TIER_BY_CONTENT_ID: ReadonlyMap<string, Tier> = new Map<string, Tier>([]);

/** 표에 없는 contentId는 T2 (curation.md 규칙) */
export function tierOf(contentId: string): Tier {
  return TIER_BY_CONTENT_ID.get(contentId) ?? "T2";
}

export function dispersionWeight(contentId: string): number {
  return TIER_WEIGHT[tierOf(contentId)];
}
