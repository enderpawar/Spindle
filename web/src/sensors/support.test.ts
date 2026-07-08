/**
 * Phase 4 DoD (자동 검증): 센서 미지원 환경(데스크톱)에서 현장 모드가 "미지원" 신호를 내
 * 여행 모드로 폴백하도록 유도하는 프리미티브를 고정한다.
 * (실제 UX 흐름 — 폴백 카드 → 여행 모드 — 은 사람 체크리스트로 확인)
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCurrentFix } from "./geolocation";
import { isOrientationSupported, requestOrientationPermission } from "./orientation";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getCurrentFix — GPS 폴백 신호", () => {
  it("geolocation이 없으면 unsupported로 reject", async () => {
    vi.stubGlobal("navigator", {});
    await expect(getCurrentFix()).rejects.toMatchObject({ kind: "unsupported" });
  });

  it("좌표를 받으면 lat/lng GeoPoint로 resolve", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: 35.1, longitude: 129.03 } } as unknown as GeolocationPosition),
      },
    });
    await expect(getCurrentFix()).resolves.toEqual({ lat: 35.1, lng: 129.03 });
  });

  it("권한 거부는 denied로 매핑", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (_ok: PositionCallback, fail: PositionErrorCallback) =>
          fail({
            code: 1,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
            message: "",
          } as unknown as GeolocationPositionError),
      },
    });
    await expect(getCurrentFix()).rejects.toMatchObject({ kind: "denied" });
  });
});

describe("requestOrientationPermission — 나침반 권한/미지원 분기", () => {
  it("DeviceOrientationEvent 자체가 없으면 미지원 (데스크톱 폴백)", async () => {
    // vitest 기본(node) 환경: window 미정의 → 미지원
    expect(isOrientationSupported()).toBe(false);
    await expect(requestOrientationPermission()).resolves.toBe("unsupported");
  });

  it("requestPermission이 없는 지원 기기(안드로이드·데스크톱 브라우저)는 granted", async () => {
    vi.stubGlobal("window", { DeviceOrientationEvent: function () {} });
    expect(isOrientationSupported()).toBe(true);
    await expect(requestOrientationPermission()).resolves.toBe("granted");
  });

  it("iOS requestPermission 결과(granted/denied)를 반영", async () => {
    const withPermission = (result: string) => ({
      DeviceOrientationEvent: Object.assign(function () {}, {
        requestPermission: () => Promise.resolve(result),
      }),
    });
    vi.stubGlobal("window", withPermission("granted"));
    await expect(requestOrientationPermission()).resolves.toBe("granted");
    vi.stubGlobal("window", withPermission("denied"));
    await expect(requestOrientationPermission()).resolves.toBe("denied");
  });
});
