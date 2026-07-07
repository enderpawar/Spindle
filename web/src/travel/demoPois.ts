/**
 * 데모 POI 픽스처 — `?demo=1`일 때만 사용하는 **합성 데이터**다.
 * TourAPI 응답이 아니며(실시간 호출 규정과 무관), 키 미발급 상태에서
 * 여행 모드 흐름(S1→S4)·확장 사유 노출을 검증하기 위한 용도.
 * 제출 전 submission-check에서 게이트 유지 여부를 재확인한다.
 */
import type { EnginePoi } from "../engine/recommend";
import type { GeoPoint } from "../engine/geo";

function pointAt(origin: GeoPoint, bearing: number, meters: number): GeoPoint {
  const rad = (bearing * Math.PI) / 180;
  return {
    lat: origin.lat + (meters * Math.cos(rad)) / 111_320,
    lng:
      origin.lng +
      (meters * Math.sin(rad)) / (111_320 * Math.cos((origin.lat * Math.PI) / 180)),
  };
}

const NAMPO: GeoPoint = { lat: 35.0985, lng: 129.0306 };

// 남포 기준 여러 방위·거리에 분산 배치 (남쪽 바다 방향은 의도적으로 비움 → 확장 사유 확인용)
export const DEMO_POIS: readonly EnginePoi[] = [
  { contentId: "demo-1", title: "데모 · 골목 시장", point: pointAt(NAMPO, 10, 500) },
  { contentId: "demo-2", title: "데모 · 전망 계단", point: pointAt(NAMPO, 35, 1200) },
  { contentId: "demo-3", title: "데모 · 근대 창고", point: pointAt(NAMPO, 60, 800) },
  { contentId: "demo-4", title: "데모 · 책방 골목", point: pointAt(NAMPO, 90, 600) },
  { contentId: "demo-5", title: "데모 · 언덕 마을", point: pointAt(NAMPO, 120, 1500) },
  { contentId: "demo-6", title: "데모 · 등대 산책로", point: pointAt(NAMPO, 145, 2200) },
  { contentId: "demo-7", title: "데모 · 오래된 다방", point: pointAt(NAMPO, 250, 700) },
  { contentId: "demo-8", title: "데모 · 벽화 골목", point: pointAt(NAMPO, 280, 900) },
  { contentId: "demo-9", title: "데모 · 야시장 입구", point: pointAt(NAMPO, 310, 400) },
  { contentId: "demo-10", title: "데모 · 옛 정미소", point: pointAt(NAMPO, 340, 1100) },
  { contentId: "demo-11", title: "데모 · 북항 전망대", point: pointAt(NAMPO, 25, 2600) },
  { contentId: "demo-12", title: "데모 · 자갈 해안길", point: pointAt(NAMPO, 105, 2000) },
];
