/**
 * 여행 모드 출발점 프리셋 (ui.md S2: 부산역 / 남포동 / 영도 흰여울 입구).
 * 프리셋 좌표는 공개된 장소의 대표 지점이며 사용자 위치가 아니다 — 서버 전송 없음.
 * 좌표는 대략값 (지도 픽은 Phase 5).
 */
import type { GeoPoint } from "./geo";
import type { Departure } from "../mock/pois";
import { ZONES, zoneOf } from "./zones";

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

/** 직접 고른 출발점의 고정 id — 프리셋 목록과 구분해 한 칸만 유지한다. */
export const MAP_PICKED_ORIGIN_ID = "map-picked";

/**
 * 좌표를 어떻게 골랐는지 — 설명 문구만 갈라지고 id는 같다.
 * 지도 픽과 현 위치가 각각 한 칸씩 쌓이면 목록이 지저분해지므로 슬롯은 하나로 둔다.
 */
export type OriginSource = "map" | "gps";

/**
 * 사용자가 고른 좌표를 추천 엔진이 쓰는 출발점으로 감싼다.
 * 좌표는 단말 안에서만 흐르며 어떤 요청·저장소에도 실리지 않는다 (절대 원칙 1).
 */
export function pickedOriginFrom(
  point: GeoPoint,
  source: OriginSource = "map",
): Departure {
  const zone = ZONES.find((z) => z.id === zoneOf(point));
  const fallbackName = source === "gps" ? "현 위치" : "지도에서 고른 지점";
  return {
    id: MAP_PICKED_ORIGIN_ID,
    name: zone ? `${zone.name} 근처` : fallbackName,
    desc: source === "gps" ? "현 위치 기준 출발점" : "지도에서 직접 찍은 출발점",
    lat: point.lat,
    lon: point.lng,
  };
}
