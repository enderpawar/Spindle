import { describe, expect, it } from "vitest";
import { MAP_PICKED_ORIGIN_ID, pickedOriginFrom } from "./origins";

describe("pickedOriginFrom", () => {
  it("존 안 좌표는 존 이름을 붙인 출발점이 된다", () => {
    const origin = pickedOriginFrom({ lat: 35.0985, lng: 129.0306 }); // 남포동
    expect(origin.id).toBe(MAP_PICKED_ORIGIN_ID);
    expect(origin.name).toBe("남포·광복 근처");
    expect(origin.lat).toBeCloseTo(35.0985);
    expect(origin.lon).toBeCloseTo(129.0306);
  });

  it("권역 밖 좌표도 좌표는 그대로 옮겨 담는다 (선택 차단은 화면 몫)", () => {
    const origin = pickedOriginFrom({ lat: 35.2, lng: 129.2 }); // 해운대 방면
    expect(origin.name).toBe("지도에서 고른 지점");
    expect(origin.lat).toBeCloseTo(35.2);
    expect(origin.lon).toBeCloseTo(129.2);
  });
});
