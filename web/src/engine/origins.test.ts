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

  it("현 위치로 잡아도 지도 픽과 같은 슬롯을 쓰고 설명만 달라진다", () => {
    const point = { lat: 35.0985, lng: 129.0306 }; // 남포동
    const gps = pickedOriginFrom(point, "gps");
    const map = pickedOriginFrom(point, "map");

    expect(gps.id).toBe(MAP_PICKED_ORIGIN_ID);
    expect(gps.id).toBe(map.id);
    expect(gps.name).toBe("남포·광복 근처");
    expect(gps.desc).toBe("현 위치 기준 출발점");
    expect(map.desc).toBe("지도에서 직접 찍은 출발점");
  });

  it("권역 밖 현 위치는 지도 픽과 다른 이름으로 떨어진다", () => {
    const origin = pickedOriginFrom({ lat: 35.2, lng: 129.2 }, "gps");
    expect(origin.name).toBe("현 위치");
  });
});
