import { describe, expect, it } from "vitest";
import {
  ARRIVAL_MARGIN_MIN,
  TIGHT_SCORE,
  evaluateOperation,
  formatHm,
  isAlwaysOpen,
  parseCloseMinutes,
  parseClosedWeekdays,
} from "./operation";

/** 2026-08-03(월) 기준 시각 — 요일 판정이 걸린 테스트는 이 날짜를 쓴다 */
const MONDAY = (hour: number, minute = 0) => new Date(2026, 7, 3, hour, minute);
/** 2026-08-04(화) */
const TUESDAY = (hour: number, minute = 0) => new Date(2026, 7, 4, hour, minute);

describe("이용시간 파싱", () => {
  it("단일 구간의 마감 시각을 읽는다", () => {
    expect(parseCloseMinutes("09:00~18:00")).toBe(18 * 60);
    expect(parseCloseMinutes("09:00 ~ 18:00")).toBe(18 * 60);
    expect(parseCloseMinutes("10:00-21:30")).toBe(21 * 60 + 30);
    expect(parseCloseMinutes("9시~18시")).toBe(18 * 60);
  });

  it("입장 마감이 있으면 그 시각을 우선한다", () => {
    expect(parseCloseMinutes("09:00~18:00 (입장마감 17:30)")).toBe(17 * 60 + 30);
    expect(parseCloseMinutes("09:00~18:00, 마지막 입장 17:00")).toBe(17 * 60);
  });

  it("계절별로 마감이 다르면 판단을 보류한다 (보수적 통과)", () => {
    expect(parseCloseMinutes("동절기 09:00~17:00 / 하절기 09:00~18:00")).toBeNull();
  });

  it("같은 마감이 여러 번 적혀 있으면 그 값을 쓴다", () => {
    expect(parseCloseMinutes("평일 09:00~18:00, 주말 10:00~18:00")).toBe(18 * 60);
  });

  it("읽을 수 없는 값은 null", () => {
    expect(parseCloseMinutes(undefined)).toBeNull();
    expect(parseCloseMinutes("상시개방")).toBeNull();
    expect(parseCloseMinutes("일출~일몰")).toBeNull();
    expect(parseCloseMinutes("22:00~02:00")).toBeNull(); // 자정 넘김 — 판단 보류
  });
});

describe("휴무일 파싱", () => {
  it("정기 휴무 요일을 읽는다", () => {
    expect([...parseClosedWeekdays("매주 월요일")]).toEqual(["월"]);
    expect([...parseClosedWeekdays("매주 월요일 휴관(공휴일인 경우 다음날)")]).toEqual(["월"]);
    expect([...parseClosedWeekdays("월요일, 화요일 휴관")].sort()).toEqual(["월", "화"]);
  });

  it("연중무휴·없음은 휴무 없음으로 본다", () => {
    expect(parseClosedWeekdays("연중무휴").size).toBe(0);
    expect(parseClosedWeekdays("없음").size).toBe(0);
    expect(parseClosedWeekdays("연중무휴(매주 월요일 시설 점검)").size).toBe(0);
  });

  it("요일이 없는 특정일 휴무는 읽어내지 않는다 (보수적 통과)", () => {
    expect(parseClosedWeekdays("1월 1일, 설날, 추석").size).toBe(0);
    expect(parseClosedWeekdays(undefined).size).toBe(0);
  });
});

describe("상시 개방 판정", () => {
  it("상시개방·24시간 표기를 인식한다", () => {
    expect(isAlwaysOpen({ usetime: "상시개방" })).toBe(true);
    expect(isAlwaysOpen({ usetime: "24시간" })).toBe(true);
    expect(isAlwaysOpen({ usetime: "09:00~18:00" })).toBe(false);
    expect(isAlwaysOpen(undefined)).toBe(false);
  });
});

describe("운영 상태 평가", () => {
  it("정보가 없으면 보수적으로 통과시킨다", () => {
    expect(evaluateOperation({ info: undefined, travelMinutes: 20 })).toMatchObject({
      kind: "unknown",
      score: 1,
    });
    expect(evaluateOperation({ info: {}, travelMinutes: 20 })).toMatchObject({
      kind: "unknown",
      score: 1,
    });
  });

  it("계절별 표기처럼 모호한 이용시간도 통과시킨다", () => {
    const status = evaluateOperation({
      info: { usetime: "동절기 09:00~17:00 / 하절기 09:00~18:00" },
      travelMinutes: 20,
      now: TUESDAY(16, 50),
    });
    expect(status.kind).toBe("unknown");
    expect(status.score).toBe(1);
    expect(status.line).toBeUndefined();
  });

  it("오늘이 휴무일이면 후보에서 제외한다", () => {
    const status = evaluateOperation({
      info: { usetime: "09:00~18:00", restdate: "매주 월요일" },
      travelMinutes: 10,
      now: MONDAY(10),
    });
    expect(status.kind).toBe("closedToday");
    expect(status.score).toBe(0);
    expect(status.line).toBe("오늘은 쉬는 날이에요");
  });

  it("휴무 요일이 아니면 정상 평가한다", () => {
    const status = evaluateOperation({
      info: { usetime: "09:00~18:00", restdate: "매주 월요일" },
      travelMinutes: 10,
      now: TUESDAY(10),
    });
    expect(status.kind).toBe("open");
    expect(status.score).toBe(1);
  });

  it("도착이 마감 이후면 제외한다", () => {
    // 17:30 + 이동 30분 + 마진 10분 = 18:10 > 18:00
    const status = evaluateOperation({
      info: { usetime: "09:00~18:00" },
      travelMinutes: 30,
      now: TUESDAY(17, 30),
    });
    expect(status.kind).toBe("tooLate");
    expect(status.score).toBe(0);
    expect(status.line).toContain("18:00 마감");
    expect(status.line).toContain("늦어요");
  });

  it("머무를 시간이 30분도 안 남으면 감점하되 제외하지는 않는다", () => {
    // 17:00 + 25 + 10 = 17:35 → 25분 남음
    const status = evaluateOperation({
      info: { usetime: "09:00~18:00" },
      travelMinutes: 25,
      now: TUESDAY(17, 0),
    });
    expect(status.kind).toBe("tight");
    expect(status.score).toBe(TIGHT_SCORE);
    expect(status.line).toContain("아슬해요");
  });

  it("여유 있게 도착하면 만점", () => {
    const status = evaluateOperation({
      info: { usetime: "09:00~18:00" },
      travelMinutes: 20,
      now: TUESDAY(13, 0),
    });
    expect(status).toMatchObject({ kind: "open", score: 1, closeMinutes: 18 * 60 });
    expect(status.line).toBe("오늘 18:00 마감 · 지금 출발해도 여유 있어요");
  });

  it("안전 마진이 실제로 판정을 바꾼다", () => {
    // 마진이 없으면 17:25 도착(5분 남음)으로 통과했을 경계 — 마진 10분이 마감 밖으로 민다
    const status = evaluateOperation({
      info: { usetime: "09:00~17:30" },
      travelMinutes: 25,
      now: TUESDAY(17, 0),
    });
    expect(status.kind).toBe("tooLate");
    expect(ARRIVAL_MARGIN_MIN).toBe(10);
  });

  it("상시 개방은 시간과 무관하게 통과한다", () => {
    const status = evaluateOperation({
      info: { usetime: "상시개방" },
      travelMinutes: 40,
      now: TUESDAY(23, 30),
    });
    expect(status).toMatchObject({ kind: "alwaysOpen", score: 1 });
  });

  it("자정을 넘겨 도착하면 마감 이후로 본다", () => {
    const status = evaluateOperation({
      info: { usetime: "09:00~18:00" },
      travelMinutes: 40,
      now: TUESDAY(23, 50),
    });
    expect(status.kind).toBe("tooLate");
  });
});

describe("시각 표기", () => {
  it("자정 기준 분을 HH:MM으로 적는다", () => {
    expect(formatHm(9 * 60)).toBe("09:00");
    expect(formatHm(18 * 60 + 30)).toBe("18:30");
  });
});
