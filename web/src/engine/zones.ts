/**
 * 존-교량 접근 가능성 모델 — `docs/zones.md`가 단일 진실 원천.
 * 여기 수치를 바꾸면 zones.md도 함께 갱신한다 (algorithm 스킬 규약).
 *
 * TODO(zones.md): 아래 존 다각형·경유점·고정시간은 전부 **임시값**(대략적 사각형)이다.
 * 0주차 현장·지도 검증으로 확정되면 zones.md의 좌표로 교체할 것 (Phase 5 전 확정 필수).
 */
import { haversineMeters, pointInPolygon, type GeoPoint } from "./geo";

export type ZoneId = "Z1" | "Z2" | "Z3" | "Z4" | "Z5";

export interface ZoneDef {
  id: ZoneId;
  name: string;
  polygon: readonly GeoPoint[];
}

function rect(latMin: number, latMax: number, lngMin: number, lngMax: number): GeoPoint[] {
  return [
    { lat: latMin, lng: lngMin },
    { lat: latMin, lng: lngMax },
    { lat: latMax, lng: lngMax },
    { lat: latMax, lng: lngMin },
  ];
}

// TODO(zones.md): 임시 사각형 구획 — 확정 다각형으로 교체
export const ZONES: readonly ZoneDef[] = [
  { id: "Z1", name: "남포·광복", polygon: rect(35.09, 35.108, 129.02, 129.042) },
  { id: "Z2", name: "부산역·초량", polygon: rect(35.108, 35.13, 129.028, 129.055) },
  { id: "Z3", name: "영도 서부", polygon: rect(35.065, 35.098, 129.032, 129.058) },
  { id: "Z4", name: "영도 동부", polygon: rect(35.045, 35.098, 129.058, 129.11) },
  { id: "Z5", name: "서구(송도·아미)", polygon: rect(35.05, 35.108, 128.99, 129.02) },
];

export function zoneOf(p: GeoPoint): ZoneId | null {
  for (const zone of ZONES) {
    if (pointInPolygon(p, zone.polygon)) return zone.id;
  }
  return null;
}

/** 도보 우회계수 (원도심 골목 기준) — zones.md */
export const WALK_DETOUR = 1.3;
/** 분속 67m = 4km/h — zones.md */
export const WALK_SPEED_M_PER_MIN = 67;

function walkMinutesByDistance(meters: number): number {
  return (meters * WALK_DETOUR) / WALK_SPEED_M_PER_MIN;
}

type Connection =
  | {
      pair: [ZoneId, ZoneId];
      kind: "bridge";
      /** 교량 양단 경유점 — 경로거리 = from→w1→w2→to */
      waypoints: [GeoPoint, GeoPoint];
    }
  | {
      pair: [ZoneId, ZoneId];
      kind: "transit";
      /** 탑승 고정 시간(분) + 양쪽 접근점까지 도보 */
      fixedMinutes: number;
      stations: [GeoPoint, GeoPoint];
    };

// TODO(zones.md): 경유점·역 좌표·고정시간 전부 임시값 — 확정 필요
export const CONNECTIONS: readonly Connection[] = [
  {
    pair: ["Z1", "Z3"],
    kind: "bridge", // 영도대교
    waypoints: [
      { lat: 35.0965, lng: 129.0344 },
      { lat: 35.0925, lng: 129.0387 },
    ],
  },
  {
    pair: ["Z1", "Z2"],
    kind: "transit", // 지하철 1호선 남포 ↔ 부산역, 탑승 10분 고정
    fixedMinutes: 10,
    stations: [
      { lat: 35.0975, lng: 129.0335 }, // 남포역
      { lat: 35.1151, lng: 129.0394 }, // 부산역(지하철)
    ],
  },
  {
    pair: ["Z2", "Z3"],
    kind: "bridge", // 부산대교 (지하철+도보 대안과 짧은 쪽 채택 — 대안은 확정 후 추가)
    waypoints: [
      { lat: 35.101, lng: 129.0398 },
      { lat: 35.095, lng: 129.043 },
    ],
  },
  {
    pair: ["Z3", "Z4"],
    kind: "transit", // 태종대 방면 버스 25분 고정 근사
    fixedMinutes: 25,
    stations: [
      { lat: 35.0916, lng: 129.0451 },
      { lat: 35.0527, lng: 129.0846 },
    ],
  },
];

function samePair(c: Connection, a: ZoneId, b: ZoneId): boolean {
  return (c.pair[0] === a && c.pair[1] === b) || (c.pair[0] === b && c.pair[1] === a);
}

export interface TravelEstimate {
  minutes: number;
  method: "walk" | "bridge" | "transit" | "estimate";
  /** 존 간 연결 정의가 있는가 — false면 "하루 나들이"에서만 후보 허용 (zones.md) */
  connected: boolean;
}

/**
 * 출발점 → POI 보정 이동시간.
 * 같은 존: 직선 × 1.3 ÷ 67. 다른 존: 연결 정의(교량 경로거리·대중교통 고정시간) 중 최소.
 * 연결 정의 없음(존 미판정 포함): 직선 근사 + connected=false — 바다 건너 직선거리를
 * 판정에 쓰지 않기 위해 "하루 나들이" 외 다이얼에서는 후보에서 제외된다.
 */
export function travelMinutes(from: GeoPoint, to: GeoPoint): TravelEstimate {
  const zoneFrom = zoneOf(from);
  const zoneTo = zoneOf(to);
  const direct = walkMinutesByDistance(haversineMeters(from, to));

  if (zoneFrom !== null && zoneFrom === zoneTo) {
    return { minutes: direct, method: "walk", connected: true };
  }

  if (zoneFrom !== null && zoneTo !== null) {
    let best: TravelEstimate | null = null;
    for (const conn of CONNECTIONS) {
      if (!samePair(conn, zoneFrom, zoneTo)) continue;
      let est: TravelEstimate;
      if (conn.kind === "bridge") {
        const [w1, w2] = conn.waypoints;
        const routeA =
          haversineMeters(from, w1) + haversineMeters(w1, w2) + haversineMeters(w2, to);
        const routeB =
          haversineMeters(from, w2) + haversineMeters(w2, w1) + haversineMeters(w1, to);
        est = {
          minutes: walkMinutesByDistance(Math.min(routeA, routeB)),
          method: "bridge",
          connected: true,
        };
      } else {
        const [s1, s2] = conn.stations;
        const accessA = haversineMeters(from, s1) + haversineMeters(s2, to);
        const accessB = haversineMeters(from, s2) + haversineMeters(s1, to);
        est = {
          minutes: walkMinutesByDistance(Math.min(accessA, accessB)) + conn.fixedMinutes,
          method: "transit",
          connected: true,
        };
      }
      if (best === null || est.minutes < best.minutes) best = est;
    }
    if (best) return best;
  }

  return { minutes: direct, method: "estimate", connected: false };
}
