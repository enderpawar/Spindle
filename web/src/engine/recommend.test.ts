import { describe, expect, it } from "vitest";
import {
  EXPANSION_REASON,
  recommend,
  withinDial,
  type EnginePoi,
  type RecommendInput,
} from "./recommend";
import { seededRng } from "./rng";
import type { GeoPoint } from "./geo";
import type { TravelEstimate } from "./zones";

const NAMPO: GeoPoint = { lat: 35.0985, lng: 129.0306 };

/** origin에서 방위 bearing(도)·거리 meters 지점 좌표 생성 (테스트 픽스처용 근사) */
function pointAt(origin: GeoPoint, bearing: number, meters: number): GeoPoint {
  const rad = (bearing * Math.PI) / 180;
  const dLat = (meters * Math.cos(rad)) / 111_320;
  const dLng = (meters * Math.sin(rad)) / (111_320 * Math.cos((origin.lat * Math.PI) / 180));
  return { lat: origin.lat + dLat, lng: origin.lng + dLng };
}

function poiAt(id: string, bearing: number, meters: number, origin: GeoPoint = NAMPO): EnginePoi {
  return { contentId: id, title: `POI ${id}`, point: pointAt(origin, bearing, meters) };
}

function input(partial: Partial<RecommendInput>): RecommendInput {
  return {
    origin: NAMPO,
    heading: 0,
    budgetMinutes: 40,
    pois: [],
    rng: seededRng(42),
    ...partial,
  };
}

describe("이동시간 다이얼 임계 경계값 20/40분 (DoD)", () => {
  const est = (minutes: number, connected = true): TravelEstimate => ({
    minutes,
    method: "walk",
    connected,
  });

  it("경계값 정각은 포함, 초과는 제외 (임의 분 예산에서도 동일)", () => {
    expect(withinDial(est(20), 20)).toBe(true);
    expect(withinDial(est(20.01), 20)).toBe(false);
    expect(withinDial(est(40), 40)).toBe(true);
    expect(withinDial(est(40.01), 40)).toBe(false);
    expect(withinDial(est(90), 90)).toBe(true);
    expect(withinDial(est(90.01), 90)).toBe(false);
    expect(withinDial(est(999), Infinity)).toBe(true);
  });

  it("연결 미정의 존 쌍은 하루(무제한)에서만 허용 (zones.md)", () => {
    expect(withinDial(est(5, false), 20)).toBe(false);
    expect(withinDial(est(5, false), 240)).toBe(false); // 유한 예산은 아무리 커도 불허
    expect(withinDial(est(5, false), Infinity)).toBe(true);
  });
});

describe("바다 방향 인접 확장 (DoD: 남포에서 남쪽)", () => {
  it("남쪽 부채꼴에 POI가 없으면 인접 방위로 확장하고 '바다' 사유를 낸다", () => {
    // 남포 남쪽(157.5°–202.5°)은 바다 — POI 없음. 남동(150°)에 하나, 북(0°)에 하나.
    const pois = [poiAt("se-poi", 150, 900), poiAt("north-poi", 0, 900)];
    const result = recommend(input({ heading: 180, budgetMinutes: Infinity, pois }));

    expect(result.sector).toBe("S");
    expect(result.expansion).toBe("adjacent");
    expect(result.expansionReason).toBe(EXPANSION_REASON.adjacentNoPoi);
    expect(result.expansionReason).toContain("바다");
    expect(result.picked?.poi.contentId).toBe("se-poi"); // 인접 범위(±67.5°) 내 유일 후보
  });

  it("부채꼴에 POI는 있지만 다이얼로 전부 제외되면 사유가 달라진다", () => {
    // 북쪽 10km 지점 — 방향은 맞지만 '가볍게(20분)'로는 도달 불가 (존 밖 + 연결 없음)
    const pois = [poiAt("far-north", 0, 10_000), poiAt("near-ne", 45, 500)];
    const result = recommend(input({ heading: 0, budgetMinutes: 20, pois }));

    expect(result.expansion).not.toBe("none");
    expect(result.expansionReason).toBe(EXPANSION_REASON.adjacentFiltered);
  });

  it("인접 확장 후에도 0개면 반대편 제외 전방위로 넓힌다", () => {
    // 북동(30°) POI — 남 스핀 기준 인접(±67.5°) 밖이지만 반대편 45° 부채꼴은 아님 (Δ150 ≤ 157.5)
    const pois = [poiAt("ne-poi", 30, 900)];
    const result = recommend(input({ heading: 180, budgetMinutes: Infinity, pois }));

    expect(result.expansion).toBe("wide");
    expect(result.expansionReason).toBe(EXPANSION_REASON.wide);
    expect(result.picked?.poi.contentId).toBe("ne-poi");
  });

  it("전방위에도 후보가 없으면 picked 없이 사유만 반환 (UI 빈 화면 금지용)", () => {
    const result = recommend(input({ heading: 180, budgetMinutes: Infinity, pois: [] }));
    expect(result.picked).toBeUndefined();
    expect(result.expansionReason).toBeTruthy();
  });
});

describe("가중 랜덤 선정 (DoD: 시드 고정 재현성)", () => {
  const pois = [
    poiAt("a", 0, 400),
    poiAt("b", 10, 500),
    poiAt("c", 350, 600),
    poiAt("d", 20, 700),
  ];

  it("같은 시드·같은 입력이면 항상 같은 결과", () => {
    const runs = Array.from({ length: 5 }, () =>
      recommend(input({ heading: 0, pois, rng: seededRng(7) })),
    );
    const ids = runs.map((r) => r.picked?.poi.contentId);
    expect(new Set(ids).size).toBe(1);
  });

  it("상위 3개만 후보이고 나머지는 alternates로 순환된다", () => {
    const result = recommend(input({ heading: 0, pois, rng: seededRng(7) }));
    expect(result.picked).toBeDefined();
    expect(result.alternates).toHaveLength(2);
    const ids = [result.picked!.poi.contentId, ...result.alternates.map((c) => c.poi.contentId)];
    expect(new Set(ids).size).toBe(3);
  });

  it("직전 당첨 POI는 후보에서 임시 제외된다", () => {
    const result = recommend(
      input({ heading: 0, pois, rng: seededRng(7), prevContentId: "a" }),
    );
    const ids = [result.picked!.poi.contentId, ...result.alternates.map((c) => c.poi.contentId)];
    expect(ids).not.toContain("a");
  });
});
