import { describe, expect, it } from "vitest";
import {
  CLOSED_NOTICE,
  OFF_HOURS_NOTICE,
  evaluateOperation,
  findClosureEvidence,
  formatHm,
  isAlwaysOpen,
  parseClosedWeekdays,
  parseHourRange,
} from "./operation";

/** 2026-08-03(월) */
const MONDAY = (hour: number, minute = 0) => new Date(2026, 7, 3, hour, minute);
/** 2026-08-04(화) */
const TUESDAY = (hour: number, minute = 0) => new Date(2026, 7, 4, hour, minute);

describe("운영 중단 판정", () => {
  it("중단·중지·종료 표현을 잡는다", () => {
    expect(findClosureEvidence({ usetime: "운영 중단" })).toBe("운영 중단");
    expect(findClosureEvidence({ usetime: "현재 운영을 중단하였습니다" })).not.toBeNull();
    expect(findClosureEvidence({ restdate: "영업 중지" })).not.toBeNull();
    expect(findClosureEvidence({ overview: "2025년부로 운영 종료되었습니다" })).not.toBeNull();
  });

  it("기약 없는 휴관·휴업을 잡는다", () => {
    expect(findClosureEvidence({ restdate: "임시 휴관" })).not.toBeNull();
    expect(findClosureEvidence({ usetime: "코로나19로 인해 잠정 휴업" })).not.toBeNull();
    expect(findClosureEvidence({ restdate: "무기한 휴관" })).not.toBeNull();
  });

  it("폐업·폐관·철거를 잡는다", () => {
    expect(findClosureEvidence({ overview: "폐업한 시설입니다" })).not.toBeNull();
    expect(findClosureEvidence({ usetime: "폐관" })).not.toBeNull();
    expect(findClosureEvidence({ overview: "건물이 철거되어 관람할 수 없습니다" })).not.toBeNull();
  });

  it("소개(overview)에만 적힌 중단 공지도 잡는다", () => {
    const status = evaluateOperation(
      {
        usetime: "09:00~18:00",
        restdate: "연중무휴",
        overview: "리모델링으로 인해 운영이 중단되었습니다.",
      },
      TUESDAY(13),
    );
    expect(status.kind).toBe("closed");
    expect(status.notice).toBe(CLOSED_NOTICE);
  });

  it("하루 마감 시각을 뜻하는 종료 표기는 중단이 아니다", () => {
    expect(findClosureEvidence({ usetime: "운영종료 18:00" })).toBeNull();
    expect(findClosureEvidence({ usetime: "09:00~18:00 (운영 종료 18시)" })).toBeNull();
  });

  it("정기 휴무는 중단이 아니다", () => {
    expect(findClosureEvidence({ restdate: "매주 월요일 휴관" })).toBeNull();
    expect(findClosureEvidence({ restdate: "1월 1일, 설날, 추석" })).toBeNull();
    expect(findClosureEvidence({ restdate: "연중무휴" })).toBeNull();
  });
});

describe("이용시간 파싱", () => {
  it("단일 구간을 읽는다", () => {
    expect(parseHourRange("09:00~18:00")).toEqual({ open: 9 * 60, close: 18 * 60 });
    expect(parseHourRange("10:00 - 21:30")).toEqual({ open: 10 * 60, close: 21 * 60 + 30 });
    expect(parseHourRange("9시~18시")).toEqual({ open: 9 * 60, close: 18 * 60 });
  });

  it("같은 구간이 여러 번 적혀 있으면 그 구간을 쓴다", () => {
    expect(parseHourRange("평일 09:00~18:00, 주말 09:00~18:00")).toEqual({
      open: 9 * 60,
      close: 18 * 60,
    });
  });

  it("구간이 서로 다르게 여럿이면 판단을 보류한다", () => {
    expect(parseHourRange("동절기 09:00~17:00 / 하절기 09:00~18:00")).toBeNull();
    expect(parseHourRange("평일 09:00~18:00, 주말 10:00~20:00")).toBeNull();
  });

  it("읽을 수 없는 값은 null", () => {
    expect(parseHourRange(undefined)).toBeNull();
    expect(parseHourRange("상시개방")).toBeNull();
    expect(parseHourRange("22:00~02:00")).toBeNull(); // 자정 넘김 — 판단 보류
  });
});

describe("휴무일·상시개방 파싱", () => {
  it("정기 휴무 요일을 읽는다", () => {
    expect([...parseClosedWeekdays("매주 월요일")]).toEqual(["월"]);
    expect([...parseClosedWeekdays("매주 월요일 휴관(공휴일인 경우 다음날)")]).toEqual(["월"]);
    expect([...parseClosedWeekdays("월요일, 화요일 휴관")].sort()).toEqual(["월", "화"]);
  });

  it("연중무휴·없음은 휴무 없음으로 본다", () => {
    expect(parseClosedWeekdays("연중무휴").size).toBe(0);
    expect(parseClosedWeekdays("없음").size).toBe(0);
  });

  it("요일이 없는 특정일 휴무는 읽어내지 않는다", () => {
    expect(parseClosedWeekdays("1월 1일, 설날, 추석").size).toBe(0);
    expect(parseClosedWeekdays(undefined).size).toBe(0);
  });

  it("상시개방·24시간·일출~일몰을 인식한다", () => {
    expect(isAlwaysOpen({ usetime: "상시개방" })).toBe(true);
    expect(isAlwaysOpen({ usetime: "24시간" })).toBe(true);
    expect(isAlwaysOpen({ usetime: "일출~일몰" })).toBe(true);
    expect(isAlwaysOpen({ usetime: "09:00~18:00" })).toBe(false);
  });
});

describe("현재 시각 기준 운영시간 판정", () => {
  const info = { usetime: "09:00~18:00", restdate: "매주 월요일" };

  it("운영시간 안이면 통과", () => {
    expect(evaluateOperation(info, TUESDAY(13))).toMatchObject({ kind: "open", score: 1 });
  });

  it("개장 전이면 제외", () => {
    const status = evaluateOperation(info, TUESDAY(8, 30));
    expect(status.kind).toBe("offHours");
    expect(status.score).toBe(0);
    expect(status.notice).toBe(OFF_HOURS_NOTICE);
  });

  it("마감 이후면 제외", () => {
    expect(evaluateOperation(info, TUESDAY(18, 0)).kind).toBe("offHours"); // 마감 정각은 이미 끝
    expect(evaluateOperation(info, TUESDAY(21, 0)).kind).toBe("offHours");
  });

  it("개장 정각·마감 1분 전은 통과", () => {
    expect(evaluateOperation(info, TUESDAY(9, 0)).kind).toBe("open");
    expect(evaluateOperation(info, TUESDAY(17, 59)).kind).toBe("open");
  });

  it("오늘이 정기 휴무 요일이면 시간과 무관하게 제외", () => {
    const status = evaluateOperation(info, MONDAY(13));
    expect(status.kind).toBe("offHours");
    expect(status.score).toBe(0);
  });

  it("상시개방은 한밤중에도 통과", () => {
    expect(evaluateOperation({ usetime: "상시개방" }, TUESDAY(3)).kind).toBe("open");
  });

  it("이용시간을 읽지 못하면 보수적으로 통과", () => {
    expect(evaluateOperation(undefined, TUESDAY(3))).toMatchObject({ kind: "open", score: 1 });
    expect(evaluateOperation({}, TUESDAY(3)).kind).toBe("open");
    expect(
      evaluateOperation({ usetime: "동절기 09:00~17:00 / 하절기 09:00~18:00" }, TUESDAY(23)).kind,
    ).toBe("open");
  });

  it("운영 중단이 운영시간 판정보다 우선한다", () => {
    const status = evaluateOperation({ usetime: "09:00~18:00", restdate: "임시 휴관" }, TUESDAY(13));
    expect(status.kind).toBe("closed");
    expect(status.notice).toBe(CLOSED_NOTICE);
  });
});

describe("시각 표기", () => {
  it("자정 기준 분을 HH:MM으로 적는다", () => {
    expect(formatHm(9 * 60)).toBe("09:00");
    expect(formatHm(18 * 60 + 30)).toBe("18:30");
  });
});
