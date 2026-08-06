import { describe, expect, it } from "vitest";
import { computeBottomGap } from "./appFrame";

const iphone = {
  iosStandalone: true,
  screenHeight: 852,
  screenWidth: 393,
  innerHeight: 793,
};

describe("앱 프레임 하단 보정", () => {
  it("iOS standalone에서 짧게 보고된 뷰포트만큼 보정값을 낸다", () => {
    expect(computeBottomGap(iphone)).toBe(59);
  });

  it("뷰포트가 화면 전체를 덮으면 보정하지 않는다", () => {
    expect(computeBottomGap({ ...iphone, innerHeight: 852 })).toBe(0);
  });

  it("iOS standalone이 아니면 보정하지 않는다", () => {
    // Android 홈화면 실행은 이 버그가 없고, 차이는 시스템 바 높이라서 보정하면 안 된다.
    expect(computeBottomGap({ ...iphone, iosStandalone: false })).toBe(0);
  });

  it("상태바 높이를 넘는 차이는 오측정으로 보고 무시한다", () => {
    expect(computeBottomGap({ ...iphone, innerHeight: 600 })).toBe(0);
  });

  it("가로 모드는 보정 대상이 아니다", () => {
    expect(
      computeBottomGap({ ...iphone, screenHeight: 393, screenWidth: 852, innerHeight: 334 }),
    ).toBe(0);
  });
});
