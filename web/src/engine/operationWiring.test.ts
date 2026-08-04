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
  const pois = [poiAt("open", 0, 300), poiAt("closed", 2, 300)];

  it("운영 점수 0인 POI는 후보에서 빠진다", () => {
    const result = recommend({
      origin: NAMPO,
      heading: 0,
      budgetMinutes: 40,
      pois,
      rng: seededRng(42),
      operationScoreOf: (contentId) => (contentId === "closed" ? 0 : 1),
    });

    const ids = [result.picked, ...result.alternates].map((c) => c?.poi.contentId);
    expect(ids).toContain("open");
    expect(ids).not.toContain("closed");
  });

  it("훅에 보정 이동시간이 함께 전달된다 (도착 시각 판정의 전제)", () => {
    const seen: { contentId: string; travelMinutes: number }[] = [];
    recommend({
      origin: NAMPO,
      heading: 0,
      budgetMinutes: 40,
      pois,
      rng: seededRng(42),
      operationScoreOf: (contentId, travelMinutes) => {
        seen.push({ contentId, travelMinutes });
        return 1;
      },
    });

    expect(seen).toHaveLength(2);
    for (const call of seen) expect(call.travelMinutes).toBeGreaterThan(0);
  });

  it("감점(아슬함)은 제외가 아니라 순위 하락으로 나타난다", () => {
    const result = recommend({
      origin: NAMPO,
      heading: 0,
      budgetMinutes: 40,
      pois,
      rng: seededRng(42),
      // 티어 가중이 결과를 흔들지 않도록 분산 가중치는 동일하게 고정한다.
      dispersionWeightOf: () => 1,
      operationScoreOf: (contentId) => (contentId === "closed" ? 0.55 : 1),
    });

    const ranked = [result.picked, ...result.alternates];
    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.poi.contentId).toBe("open");
  });
});

describe("세션에 쌓인 운영 원문이 엔진 훅까지 닿는다", () => {
  beforeEach(() => {
    operationInfo.clear();
  });

  it("아직 모르는 POI는 1.0으로 보수 통과한다", () => {
    expect(operationScoreOf("unknown-poi", 15)).toBe(1);
  });

  it("오늘 휴무로 확인된 POI는 0점이 된다", () => {
    const weekday = ["일", "월", "화", "수", "목", "금", "토"][new Date().getDay()];
    operationInfo.set("closed-today", { usetime: "09:00~18:00", restdate: `매주 ${weekday}요일` });
    expect(operationScoreOf("closed-today", 15)).toBe(0);
  });

  it("상시 개방으로 확인된 POI는 시간과 무관하게 통과한다", () => {
    operationInfo.set("always", { usetime: "상시개방" });
    expect(operationScoreOf("always", 240)).toBe(1);
  });
});
