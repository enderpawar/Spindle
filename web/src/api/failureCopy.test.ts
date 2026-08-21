import { afterEach, describe, expect, it, vi } from "vitest";
import { failureCauseLine } from "./failureCopy";
import { TourApiError } from "./tourapi";

/** node 환경에는 onLine이 없다 — 오프라인 판정만 임시로 심는다. */
function withOnline(value: boolean, run: () => void): void {
  vi.stubGlobal("navigator", { onLine: value });
  try {
    run();
  } finally {
    vi.unstubAllGlobals();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("failureCauseLine", () => {
  it("원인별로 다른 문구를 돌려준다", () => {
    expect(failureCauseLine(new TourApiError("x", { kind: "offline" }))).toBe("네트워크 연결이 끊겨 있어요");
    expect(failureCauseLine(new TourApiError("x", { kind: "timeout" }))).toBe("응답이 늦어지고 있어요");
    expect(failureCauseLine(new TourApiError("x", { kind: "network" }))).toBe("잠시 연결이 어려워요");
    expect(failureCauseLine(new TourApiError("x", { kind: "http", status: 502 }))).toBe(
      "관광정보 서버가 잠시 불안정해요",
    );
    expect(failureCauseLine(new TourApiError("x", { kind: "api", resultCode: "22" }))).toBe(
      "관광정보를 받아오지 못했어요",
    );
  });

  it("resultMsg나 HTTP 상태 같은 기술 문자열을 노출하지 않는다", () => {
    const line = failureCauseLine(new TourApiError("SERVICE_KEY_IS_NOT_REGISTERED_ERROR", { kind: "api" }));
    expect(line).not.toContain("ERROR");
    expect(failureCauseLine(new TourApiError("프록시 응답 오류 (HTTP 503)", { kind: "http" }))).not.toContain("503");
  });

  it("원인을 모르면 기존 문구로 안전하게 떨어진다", () => {
    expect(failureCauseLine(new Error("변환 실패"))).toBe("잠시 연결이 어려워요");
    expect(failureCauseLine(undefined)).toBe("잠시 연결이 어려워요");
    expect(failureCauseLine(null)).toBe("잠시 연결이 어려워요");
  });

  it("TourAPI를 거치지 않은 실패라도 오프라인이면 그렇게 알려준다", () => {
    withOnline(false, () => {
      expect(failureCauseLine(new Error("변환 실패"))).toBe("네트워크 연결이 끊겨 있어요");
    });
    withOnline(true, () => {
      expect(failureCauseLine(new Error("변환 실패"))).toBe("잠시 연결이 어려워요");
    });
  });

  it("어떤 입력에도 빈 문자열을 내지 않는다", () => {
    for (const input of [undefined, null, 0, "", new Error(""), new TourApiError("")]) {
      expect(failureCauseLine(input).length).toBeGreaterThan(0);
    }
  });
});
