import { describe, expect, it } from "vitest";
import { haversineMeters } from "./geo";
import { WALK_DETOUR, WALK_SPEED_M_PER_MIN, travelMinutes, zoneOf } from "./zones";

// 임시 존 사각형(TODO(zones.md)) 기준의 대표 지점
const NAMPO = { lat: 35.0985, lng: 129.0306 }; // Z1
const GUKJE_MARKET = { lat: 35.1006, lng: 129.028 }; // Z1
const HUINNYEOUL = { lat: 35.0788, lng: 129.0446 }; // Z3
const BUSAN_STATION = { lat: 35.1152, lng: 129.0403 }; // Z2
const SONGDO = { lat: 35.0765, lng: 129.0173 }; // Z5
const TAEJONGDAE = { lat: 35.0527, lng: 129.0846 }; // Z4

describe("존 판정 (임시 다각형)", () => {
  it("대표 지점이 기대 존으로 판정된다", () => {
    expect(zoneOf(NAMPO)).toBe("Z1");
    expect(zoneOf(BUSAN_STATION)).toBe("Z2");
    expect(zoneOf(HUINNYEOUL)).toBe("Z3");
    expect(zoneOf(TAEJONGDAE)).toBe("Z4");
    expect(zoneOf(SONGDO)).toBe("Z5");
  });
});

describe("travelMinutes — 존-교량 보정 (DoD: 교량 보정 > 직선거리)", () => {
  it("같은 존은 직선 × 1.3 ÷ 67", () => {
    const est = travelMinutes(NAMPO, GUKJE_MARKET);
    expect(est.method).toBe("walk");
    expect(est.connected).toBe(true);
    expect(est.minutes).toBeCloseTo(
      (haversineMeters(NAMPO, GUKJE_MARKET) * WALK_DETOUR) / WALK_SPEED_M_PER_MIN,
      6,
    );
  });

  it("바다 건너(Z1→Z3)는 영도대교 경유 경로가 직선 도보시간보다 크다", () => {
    const est = travelMinutes(NAMPO, HUINNYEOUL);
    const straight = (haversineMeters(NAMPO, HUINNYEOUL) * WALK_DETOUR) / WALK_SPEED_M_PER_MIN;
    expect(est.method).toBe("bridge");
    expect(est.connected).toBe(true);
    expect(est.minutes).toBeGreaterThan(straight);
  });

  it("지하철 연결(Z1→Z2)은 접근 도보 + 고정 10분", () => {
    const est = travelMinutes(NAMPO, BUSAN_STATION);
    expect(est.method).toBe("transit");
    expect(est.minutes).toBeGreaterThan(10);
  });

  it("연결 정의가 없는 존 쌍(Z5→Z4)은 connected=false (하루 나들이 전용)", () => {
    const est = travelMinutes(SONGDO, TAEJONGDAE);
    expect(est.connected).toBe(false);
    expect(est.method).toBe("estimate");
  });
});
