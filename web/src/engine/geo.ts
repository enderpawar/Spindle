/**
 * 지리 수학 유틸 — 전부 단말 내 계산 (AGENTS.md 절대 원칙 1).
 * 좌표는 어떤 네트워크 요청에도 실리지 않는다.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** 두 지점 간 대원(하버사인) 거리 (m) */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}

/** from → to 초기 방위각 (진북 기준 시계방향 0–360) */
export function bearingDeg(from: GeoPoint, to: GeoPoint): number {
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δλ = toRad(to.lng - from.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = toDeg(Math.atan2(y, x));
  return (θ + 360) % 360;
}

/** 다각형 내부 판정 (ray casting) — 존 판정용, 단말 내 전용 */
export function pointInPolygon(p: GeoPoint, polygon: readonly GeoPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects =
      a.lng > p.lng !== b.lng > p.lng &&
      p.lat < ((b.lat - a.lat) * (p.lng - a.lng)) / (b.lng - a.lng) + a.lat;
    if (intersects) inside = !inside;
  }
  return inside;
}
