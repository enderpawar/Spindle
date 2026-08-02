/**
 * GPS 취득 — 현장 모드 출발점(존 판정)과 활성 코스 안내용 (sensors 스킬 규약).
 * getCurrentPosition이 기본이며 watchPosition은 사용자가 시작한 코스 안내 수명주기 안에서만 쓴다.
 * 취득 좌표는 존 판정·거리 계산에만 단말 내에서 쓰고, 어떤 저장소·네트워크에도 내보내지 않는다
 * (절대 원칙 1·3).
 */
import type { GeoPoint } from "../engine/geo";

export type GeoErrorKind = "unsupported" | "denied" | "unavailable" | "timeout";

export class GeoFixError extends Error {
  readonly kind: GeoErrorKind;
  constructor(kind: GeoErrorKind) {
    super(kind);
    this.name = "GeoFixError";
    this.kind = kind;
  }
}

const GEO_TIMEOUT_MS = 10_000;

export interface PositionFix {
  point: GeoPoint;
  accuracyM: number;
  timestamp: number;
}

/** 현재 위치 1회 취득. 실패 시 GeoFixError(kind)로 reject → 현장 모드가 여행 모드로 폴백. */
export function getCurrentFix(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new GeoFixError("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new GeoFixError(mapGeoError(err))),
      { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: 0 },
    );
  });
}

/** 활성 코스 안내 전용 연속 위치 구독. 원시 좌표를 저장·전송·로그하지 않는다. */
export function watchCurrentFix(
  onFix: (fix: PositionFix) => void,
  onError: (error: GeoFixError) => void,
): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError(new GeoFixError("unsupported"));
    return () => {};
  }
  const watchId = navigator.geolocation.watchPosition(
    (pos) => onFix({
      point: { lat: pos.coords.latitude, lng: pos.coords.longitude },
      accuracyM: pos.coords.accuracy,
      timestamp: pos.timestamp,
    }),
    (err) => onError(new GeoFixError(mapGeoError(err))),
    { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: 5_000 },
  );
  return () => navigator.geolocation.clearWatch(watchId);
}

function mapGeoError(err: GeolocationPositionError): GeoErrorKind {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "denied";
    case err.TIMEOUT:
      return "timeout";
    default:
      return "unavailable";
  }
}
