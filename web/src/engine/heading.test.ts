import { describe, expect, it } from "vitest";
import {
  HeadingSmoother,
  circularConcentration,
  circularMeanDeg,
  headingFromOrientation,
} from "./heading";

describe("headingFromOrientation — 진북 기준 heading 추출", () => {
  it("iOS webkitCompassHeading을 그대로 사용한다", () => {
    expect(headingFromOrientation({ webkitCompassHeading: 132 })).toBe(132);
  });

  it("webkitCompassHeading은 absolute alpha보다 우선한다", () => {
    expect(headingFromOrientation({ webkitCompassHeading: 90, alpha: 45, absolute: true })).toBe(90);
  });

  it("표준 absolute alpha는 360-alpha로 변환한다 (alpha=90 → 270)", () => {
    expect(headingFromOrientation({ alpha: 90, absolute: true })).toBe(270);
  });

  it("alpha=0 absolute는 0으로 정규화된다", () => {
    expect(headingFromOrientation({ alpha: 0, absolute: true })).toBe(0);
  });

  it("절대 방위가 아니면(absolute=false) null — 방향을 신뢰하지 않는다", () => {
    expect(headingFromOrientation({ alpha: 120, absolute: false })).toBeNull();
    expect(headingFromOrientation({ alpha: 120 })).toBeNull();
  });

  it("방위 값이 전혀 없으면 null", () => {
    expect(headingFromOrientation({})).toBeNull();
    expect(headingFromOrientation({ webkitCompassHeading: null, alpha: null })).toBeNull();
  });
});

describe("circularMeanDeg — 원형 평균 (0/360 경계)", () => {
  it("빈 배열은 null", () => {
    expect(circularMeanDeg([])).toBeNull();
  });

  it("작은 각도들은 산술 평균과 일치 ([10,20,30] → 20)", () => {
    expect(circularMeanDeg([10, 20, 30])).toBeCloseTo(20, 5);
  });

  it("0/360 경계를 넘는 표본 ([350,10] → 0, 180 아님)", () => {
    const m = circularMeanDeg([350, 10]);
    expect(m).not.toBeNull();
    // 0과 360은 같은 각도 — wrap을 감안해 원형 거리로 비교
    expect(Math.min(m!, 360 - m!)).toBeCloseTo(0, 3);
  });

  it("정확히 상쇄되는 표본([0,180])은 null", () => {
    expect(circularMeanDeg([0, 180])).toBeNull();
  });
});

describe("circularConcentration — 안정도 지표", () => {
  it("동일한 표본은 집중도 1", () => {
    expect(circularConcentration([100, 100, 100])).toBeCloseTo(1, 5);
  });

  it("8방위로 고르게 흩어진 표본은 집중도 ~0", () => {
    expect(circularConcentration([0, 45, 90, 135, 180, 225, 270, 315])).toBeCloseTo(0, 5);
  });

  it("빈 배열은 0", () => {
    expect(circularConcentration([])).toBe(0);
  });
});

describe("HeadingSmoother — 링버퍼 스무딩·안정 판정", () => {
  it("최근 size개만 유지한다", () => {
    const s = new HeadingSmoother(3);
    s.push(10);
    s.push(20);
    s.push(30);
    s.push(40); // 10 밀려남 → [20,30,40]
    expect(s.sampleCount).toBe(3);
    expect(s.value).toBeCloseTo(30, 5);
  });

  it("표본이 가득 차지 않으면 안정이 아니다", () => {
    const s = new HeadingSmoother(8);
    for (let i = 0; i < 4; i++) s.push(100);
    expect(s.isStable()).toBe(false);
  });

  it("가득 차고 흔들림이 없으면 안정", () => {
    const s = new HeadingSmoother(8);
    for (let i = 0; i < 8; i++) s.push(100);
    expect(s.isStable()).toBe(true);
    expect(s.value).toBeCloseTo(100, 5);
  });

  it("가득 차도 크게 흔들리면 안정이 아니다", () => {
    const s = new HeadingSmoother(8);
    [0, 45, 90, 135, 180, 225, 270, 315].forEach((d) => s.push(d));
    expect(s.isStable()).toBe(false);
  });

  it("reset 후에는 표본이 비고 value가 null", () => {
    const s = new HeadingSmoother(4);
    s.push(50);
    s.reset();
    expect(s.sampleCount).toBe(0);
    expect(s.value).toBeNull();
  });
});
