import { describe, expect, it } from "vitest";
import { bearingDeg, type GeoPoint } from "./geo";
import { buildCourse, COURSE_REASON, type BuildCourseInput } from "./course";
import { tierOf } from "./curation";
import type { EnginePoi, ExpansionLevel, RankedCandidate } from "./recommend";
import type { TravelEstimate } from "./zones";

const ORIGIN: GeoPoint = { lat: 0, lng: 0 };

function poi(id: string, lat: number, lng = 0): EnginePoi {
  return { contentId: id, title: id, point: { lat, lng } };
}

function pointAt(origin: GeoPoint, bearing: number, meters: number): GeoPoint {
  const rad = (bearing * Math.PI) / 180;
  const dLat = (meters * Math.cos(rad)) / 111_320;
  const dLng = (meters * Math.sin(rad)) / (111_320 * Math.cos((origin.lat * Math.PI) / 180));
  return { lat: origin.lat + dLat, lng: origin.lng + dLng };
}

function fakeEstimate(from: GeoPoint, to: GeoPoint): TravelEstimate {
  return {
    minutes: Math.abs(to.lat - from.lat) + Math.abs(to.lng - from.lng),
    method: "walk",
    connected: true,
  };
}

function fixedEstimate(minutes: number): () => TravelEstimate {
  return () => ({ minutes, method: "walk", connected: true });
}

function candidate(p: EnginePoi, origin: GeoPoint = ORIGIN): RankedCandidate {
  return {
    poi: p,
    score: 1,
    bearing: bearingDeg(origin, p.point),
    travel: fakeEstimate(origin, p.point),
    tier: tierOf(p.contentId),
  };
}

function input(partial: Partial<BuildCourseInput> & { first: RankedCandidate }): BuildCourseInput {
  return {
    origin: ORIGIN,
    heading: 0,
    budgetMinutes: 40,
    pois: [partial.first.poi],
    expansion: "none",
    travelEstimateOf: fakeEstimate,
    ...partial,
  };
}

describe("방향 기반 여행 코스", () => {
  it("첫 장소와 기준 방위는 코스 생성 전후 동일하다", () => {
    const first = candidate(poi("first", 5));
    const result = buildCourse(
      input({
        first,
        pois: [first.poi, poi("second", 20), poi("third", 35)],
        heading: 0,
        budgetMinutes: 40,
      }),
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.sector).toBe("N");
    expect(result.stops[0].candidate.poi.contentId).toBe("first");
    expect(result.stops[0].candidate.bearing).toBe(first.bearing);
  });

  it.each([
    [20, 20.01, 2],
    [40, 40.01, 3],
  ] satisfies Array<[number, number, number]>)(
    "예산 %d분은 총 이동시간 경계값 정각을 포함하고 초과는 제외한다",
    (boundary, over, expectedStops) => {
      const first = candidate(poi("first", 5));
      const boundaryPoi = poi("boundary", boundary);
      const overPoi = poi("over", over);
      const middlePois = boundary === 40 ? [poi("mid", 25)] : [];
      const result = buildCourse(
        input({
          first,
          pois: [first.poi, ...middlePois, boundaryPoi, overPoi],
          heading: 0,
          budgetMinutes: boundary,
        }),
      );

      expect(result.status).toBe("ready");
      if (result.status !== "ready") return;
      expect(result.stops).toHaveLength(expectedStops);
      expect(result.stops.at(-1)?.totalMinutes).toBe(boundary);
      expect(result.stops.map((stop) => stop.candidate.poi.contentId)).not.toContain("over");
    },
  );

  it("같은 contentId를 중복 방문하지 않는다", () => {
    const first = candidate(poi("dup", 5));
    const result = buildCourse(
      input({
        first,
        pois: [first.poi, poi("dup", 7), poi("next", 12)],
        heading: 0,
        budgetMinutes: 20,
      }),
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.stops.map((stop) => stop.candidate.poi.contentId)).toEqual(["dup", "next"]);
  });

  it("동일 입력 후보 집합이면 방문 순서가 결정적으로 정렬된다", () => {
    const first = candidate(poi("first", 5));
    const north = poi("north-score", 8, 0);
    const nearNorth = poi("near-north", 8, 0.1);
    const result = buildCourse(
      input({
        first,
        pois: [first.poi, nearNorth, north],
        heading: 0,
        budgetMinutes: 20,
        travelEstimateOf: fixedEstimate(5),
      }),
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.stops.map((stop) => stop.candidate.poi.contentId)).toEqual([
      "first",
      "north-score",
    ]);
  });

  it("후보 부족 시 2곳 이상은 축소 코스, 2곳 미만은 단일 추천 폴백 사유를 반환한다", () => {
    const first = candidate(poi("first", 5));
    const shortened = buildCourse(
      input({
        first,
        pois: [first.poi, poi("only-next", 15)],
        heading: 0,
        budgetMinutes: 40,
      }),
    );
    const unavailable = buildCourse(
      input({
        first,
        pois: [first.poi],
        heading: 0,
        budgetMinutes: 40,
      }),
    );

    expect(shortened.status).toBe("ready");
    if (shortened.status === "ready") {
      expect(shortened.stops).toHaveLength(2);
      expect(shortened.reasons).toContain(COURSE_REASON.shortened);
    }
    expect(unavailable).toEqual({
      status: "unavailable",
      sector: "N",
      reason: COURSE_REASON.unavailable,
    });
  });

  it("부족한 후속 후보는 인접 방위까지 확장하되 전방위로 넓히지 않는다", () => {
    const firstPoi = { contentId: "first", title: "first", point: pointAt(ORIGIN, 0, 500) };
    const adjacentPoi = {
      contentId: "adjacent",
      title: "adjacent",
      point: pointAt(ORIGIN, 45, 600),
    };
    const oppositePoi = {
      contentId: "opposite",
      title: "opposite",
      point: pointAt(ORIGIN, 180, 200),
    };
    const result = buildCourse(
      input({
        first: candidate(firstPoi),
        pois: [firstPoi, adjacentPoi, oppositePoi],
        heading: 0,
        budgetMinutes: 40,
        travelEstimateOf: fixedEstimate(5),
      }),
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.reasons).toContain(COURSE_REASON.adjacent);
    expect(result.stops.map((stop) => stop.candidate.poi.contentId)).toContain("adjacent");
    expect(result.stops.map((stop) => stop.candidate.poi.contentId)).not.toContain("opposite");
  });

  it("바다 방향 인접 확장 사유는 코스 화면에도 유지할 수 있게 반환한다", () => {
    const firstPoi = {
      contentId: "sea-adjacent-first",
      title: "sea-adjacent-first",
      point: pointAt(ORIGIN, 150, 500),
    };
    const secondPoi = {
      contentId: "sea-adjacent-second",
      title: "sea-adjacent-second",
      point: pointAt(ORIGIN, 145, 600),
    };
    const result = buildCourse(
      input({
        first: candidate(firstPoi),
        pois: [firstPoi, secondPoi],
        heading: 180,
        budgetMinutes: 20,
        expansion: "adjacent" satisfies ExpansionLevel,
        expansionReason: "이 방향은 바다예요. 범위를 넓혔어요",
        travelEstimateOf: fixedEstimate(5),
      }),
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.reasons).toContain("이 방향은 바다예요. 범위를 넓혔어요");
  });

  it("운영 상태가 0인 후보는 후속 장소에서 제외한다", () => {
    const first = candidate(poi("first", 5));
    const result = buildCourse(
      input({
        first,
        pois: [first.poi, poi("closed", 10), poi("open", 15)],
        heading: 0,
        budgetMinutes: 20,
        operationScoreOf: (contentId) => (contentId === "closed" ? 0 : 1),
      }),
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.stops.map((stop) => stop.candidate.poi.contentId)).toEqual(["first", "open"]);
  });
});
