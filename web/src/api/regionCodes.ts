/**
 * TourAPI 지역코드 상수 — 부산 원도심·영도 4개 구.
 *
 * TODO(areaCode2): 아래 시군구코드는 TourAPI 문서 기반 임시값이다.
 * 운영계정 키 발급 후 `/api/areaCode2?areaCode=6`을 실제 호출해 값을 재확인하고,
 * 이 주석을 "확인 날짜: YYYY-MM-DD (areaCode2 실호출)"로 교체할 것. (PLAN.md Phase 1)
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
