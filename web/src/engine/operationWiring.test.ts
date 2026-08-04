/**
 * 운영 상태 축이 **실제로 배선돼 있는지** 고정하는 회귀 테스트.
 *
 * 이 축은 한동안 훅만 존재하고 프로덕션 경로에서 아무도 값을 넘기지 않아
 * 항상 1.0으로 동작했다(기능설명서는 4요소 산식이라고 서술 중). 같은 일이 다시
 * 생기지 않도록 "훅이 점수에 반영되는가"와 "세션 원문이 훅에 닿는가"를 함께 잠근다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OperationInfo } from "./operation";

const { operationInfo } = vi.hoisted(() => ({
  operationInfo: new Map<string, OperationInfo>(),
}));

// spinRecommend가 세션 저장소에서 읽어오는 지점만 갈아 끼운다.
vi.mock("../api/details", () => ({
  getOperationInfo: (contentId: string) => operationInfo.get(contentId),
}));

import type { GeoPoint } from "./geo";
import { recommend, type EnginePoi } from "./recommend";
import { seededRng } from "./rng";
import { operationScoreOf } from "./spinRecommend";

const NAMPO: GeoPoint = { lat: 35.0985, lng: 129.0306 };

function pointAt(origin: GeoPoint, bearing: number, meters: number): GeoPoint {
  const rad = (bearing * Math.PI) / 180;
  const dLat = (meters * Math.cos(rad)) / 111_320;
  const dLng = (meters * Math.sin(rad)) / (111_320 * Math.cos((origin.lat * Math.PI) / 180));
  return { lat: origin.lat + dLat, lng: origin.lng + dLng };
}

function poiAt(id: string, bearing: number, meters: number): EnginePoi {
  return { contentId: id, title: `POI ${id}`, point: pointAt(NAMPO, bearing, meters) };
}

describe("운영 상태 점수가 추천 산식에 반영된다", () => {
  const pois = [poiAt("open", 0, 300), poiAt("shut", 2, 300)];

  it("운영 점수 0인 POI는 후보에서 빠진다", () => {
    const result = recommend({
      origin: NAMPO,
      heading: 0,
      budgetMinutes: 40,
      pois,
      rng: seededRng(42),
      operationScoreOf: (contentId) => (contentId === "shut" ? 0 : 1),
    });

    const ids = [result.picked, ...result.alternates].map((c) => c?.poi.contentId);
    expect(ids).toContain("open");
    expect(ids).not.toContain("shut");
  });

  it("모든 후보가 닫혀 있으면 그 방위에서 후보가 나오지 않는다", () => {
    const result = recommend({
      origin: NAMPO,
      heading: 0,
      budgetMinutes: 40,
      pois,
      rng: seededRng(42),
      operationScoreOf: () => 0,
    });

    // 전 방위로 넓혀도 전부 0점이면 추천 없음 — 상위 화면의 폴백이 받는다.
    expect(result.picked).toBeUndefined();
    expect(result.alternates).toHaveLength(0);
  });
});

describe("세션에 쌓인 운영 원문이 엔진 훅까지 닿는다", () => {
  beforeEach(() => {
    operationInfo.clear();
  });

  it("아직 모르는 POI는 1.0으로 보수 통과한다", () => {
    expect(operationScoreOf("unknown-poi")).toBe(1);
  });

  it("운영을 중단한 POI는 0점이 된다", () => {
    operationInfo.set("shut-down", { usetime: "09:00~18:00", restdate: "임시 휴관" });
    expect(operationScoreOf("shut-down")).toBe(0);
  });

  it("오늘이 정기 휴무 요일이면 0점이 된다", () => {
    const weekday = ["일", "월", "화", "수", "목", "금", "토"][new Date().getDay()];
    operationInfo.set("closed-today", { usetime: "09:00~18:00", restdate: `매주 ${weekday}요일` });
    expect(operationScoreOf("closed-today")).toBe(0);
  });

  it("상시 개방으로 확인된 POI는 시각과 무관하게 통과한다", () => {
    operationInfo.set("always", { usetime: "상시개방" });
    expect(operationScoreOf("always")).toBe(1);
  });
});
