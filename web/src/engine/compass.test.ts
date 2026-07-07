import { describe, expect, it } from "vitest";
import {
  circularDiffDeg,
  directionScore,
  normalizeHeading,
  sectorCenterDeg,
  sectorOf,
} from "./compass";

describe("8방위 분류 — 0°/360° 경계 (DoD)", () => {
  it("북 부채꼴은 337.5°–22.5°를 wrap해서 덮는다", () => {
    expect(sectorOf(0)).toBe("N");
    expect(sectorOf(359.9)).toBe("N");
    expect(sectorOf(337.5)).toBe("N"); // round(337.5/45)=8 → %8=0
    expect(sectorOf(22.4)).toBe("N");
    expect(sectorOf(22.6)).toBe("NE");
    expect(sectorOf(360)).toBe("N");
    expect(sectorOf(-10)).toBe("N"); // 음수 각도 정규화
    expect(sectorOf(720.4)).toBe("N");
  });

  it("나머지 방위 중심선이 정확히 분류된다", () => {
    expect(sectorOf(45)).toBe("NE");
    expect(sectorOf(90)).toBe("E");
    expect(sectorOf(135)).toBe("SE");
    expect(sectorOf(180)).toBe("S");
    expect(sectorOf(225)).toBe("SW");
    expect(sectorOf(270)).toBe("W");
    expect(sectorOf(315)).toBe("NW");
  });

  it("normalizeHeading은 [0,360) 범위를 보장한다", () => {
    expect(normalizeHeading(360)).toBe(0);
    expect(normalizeHeading(-45)).toBe(315);
    expect(normalizeHeading(725)).toBe(5);
  });

  it("circularDiffDeg는 wrap 경계를 넘어도 최단 각차를 준다", () => {
    expect(circularDiffDeg(350, 10)).toBe(20);
    expect(circularDiffDeg(0, 359)).toBe(1);
    expect(circularDiffDeg(90, 270)).toBe(180);
  });
});

describe("방향 일치도 (algorithm 스킬 산식)", () => {
  it("중심선 1.0, 경계 0.5, 밖 0", () => {
    const north = sectorCenterDeg("N");
    expect(directionScore(0, north)).toBe(1);
    expect(directionScore(22.5, north)).toBe(0.5);
    expect(directionScore(337.5, north)).toBe(0.5); // wrap 쪽 경계
    expect(directionScore(23, north)).toBe(0);
  });

  it("확장 반각(67.5°)에서도 같은 산식이 적용된다", () => {
    expect(directionScore(67.5, 0, 67.5)).toBe(0.5);
    expect(directionScore(68, 0, 67.5)).toBe(0);
  });
});
