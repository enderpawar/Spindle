import { describe, expect, it } from "vitest";
import { canRecommendWhileOffline, isApiPath } from "./cachePolicy";

describe("PWA 캐싱 경계", () => {
  it("프록시 API 경로를 명확히 구분한다", () => {
    expect(isApiPath("/api")).toBe(true);
    expect(isApiPath("/api/areaBasedList2")).toBe(true);
    expect(isApiPath("/index.html")).toBe(false);
    expect(isApiPath("/assets/app.js")).toBe(false);
  });

  it("오프라인에서는 추천 실행을 허용하지 않는다", () => {
    expect(canRecommendWhileOffline(false)).toBe(false);
    expect(canRecommendWhileOffline(true)).toBe(true);
  });
});
