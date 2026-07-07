/**
 * 여행 모드 출발점 프리셋 (ui.md S2: 부산역 / 남포동 / 영도 흰여울 입구).
 * 프리셋 좌표는 공개된 장소의 대표 지점이며 사용자 위치가 아니다 — 서버 전송 없음.
 * 좌표는 대략값 (지도 픽은 Phase 5).
 */
import type { GeoPoint } from "./geo";

export interface OriginPreset {
  id: string;
  name: string;
  point: GeoPoint;
}

export const ORIGIN_PRESETS: readonly OriginPreset[] = [
  { id: "busan-station", name: "부산역", point: { lat: 35.1152, lng: 129.0403 } },
  { id: "nampo", name: "남포동", point: { lat: 35.0985, lng: 129.0306 } },
  { id: "yeongdo-huinnyeoul", name: "영도(흰여울 입구)", point: { lat: 35.0788, lng: 129.0446 } },
];
