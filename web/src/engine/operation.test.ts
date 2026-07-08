import { describe, expect, it } from "vitest";
import { parseOperationStatus } from "./operation";

/** getDay() === dayIdx(0=일…6=토)인 날짜를 만든다 — 기준일 요일에 의존하지 않게 */
function dateOnWeekday(dayIdx: number): Date {
  const d = new Date(2026, 6, 5); // 임의 기준일
  d.setDate(d.getDate() + ((dayIdx - d.getDay() + 7) % 7));
  return d;
}

const MON = dateOnWeekday(1);
const TUE = dateOnWeekday(2);
const WED = dateOnWeekday(3);

describe("parseOperationStatus — 보수적 판정", () => {
  it("연중무휴는 open", () => {
    expect(parseOperationStatus("연중무휴", MON).kind).toBe("open");
  });

  it("빈 값·undefined는 unknown", () => {
    expect(parseOperationStatus(undefined, MON).kind).toBe("unknown");
    expect(parseOperationStatus("", MON).kind).toBe("unknown");
    expect(parseOperationStatus("   ", MON).kind).toBe("unknown");
  });

  it("매주 월요일 휴무 — 월요일 closed, 화요일 open", () => {
    expect(parseOperationStatus("매주 월요일", MON).kind).toBe("closed");
    expect(parseOperationStatus("매주 월요일", TUE).kind).toBe("open");
  });

  it("월·화요일 휴무 — 여러 요일 판정", () => {
    expect(parseOperationStatus("월·화요일 휴무", MON).kind).toBe("closed");
    expect(parseOperationStatus("월·화요일 휴무", WED).kind).toBe("open");
  });

  it("월 단위·명절 규칙은 판정하지 않고 원문을 보존한다", () => {
    const r = parseOperationStatus("매월 첫째·셋째 월요일 휴관", MON);
    expect(r.kind).toBe("unknown");
    expect(r.raw).toContain("첫째");
    expect(parseOperationStatus("설날·추석 당일 휴무", MON).kind).toBe("unknown");
  });

  it("휴무 단어 없이 요일만 언급되면 unknown (오판 방지)", () => {
    expect(parseOperationStatus("월요일 정상 운영", MON).kind).toBe("unknown");
  });

  it("HTML 태그를 제거한 뒤 판정한다", () => {
    expect(parseOperationStatus("<p>매주 월요일</p>", MON).kind).toBe("closed");
  });
});
