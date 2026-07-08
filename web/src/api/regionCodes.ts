/**
 * TourAPI 지역코드 상수 — 부산 원도심·영도 4개 구.
 *
 * 확인 날짜: 2026-07-08 (areaCode2 실호출) — `/api/areaCode2?areaCode=6` 응답과 대조 완료.
 * 중구=15·동구=5·서구=11·영도구=14 모두 일치. (PLAN.md Phase 1)
 */

export const BUSAN_AREA_CODE = "6";

export interface SigunguRegion {
  /** UI 표기용 이름 */
  name: string;
  /** TourAPI sigunguCode (areaCode=6 하위) */
  code: string;
}

export const OLD_TOWN_REGIONS: readonly SigunguRegion[] = [
  { name: "중구", code: "15" },
  { name: "동구", code: "5" },
  { name: "서구", code: "11" },
  { name: "영도구", code: "14" },
] as const;
