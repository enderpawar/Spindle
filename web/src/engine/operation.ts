/**
 * 운영 상태(쉬는날) 파싱 — algorithm 스킬 규약:
 * 자유 텍스트라 파싱이 불완전하다 → 확실한 패턴만 판정하고, 나머지는 전부
 * "unknown"으로 보수적 통과시켜 원문을 그대로 노출한다 (후보를 죽이지 않는다).
 */

export type OperationKind = "open" | "closed" | "unknown";

export interface OperationStatus {
  kind: OperationKind;
  /** 표시용 원문 (unknown일 때 카드에 그대로 노출) */
  raw?: string;
}

const WEEKDAY_CHARS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/**
 * restdate 원문과 기준 날짜로 오늘 휴무 여부를 판정한다.
 * 판정 가능 패턴: "연중무휴" / "매주 X요일(·Y요일)" / "X요일 휴무·휴관".
 * "매월 첫째/둘째/…", 명절 등 나머지는 전부 unknown (보수적 통과).
 */
export function parseOperationStatus(
  restdateRaw: string | undefined,
  today: Date,
): OperationStatus {
  if (!restdateRaw) return { kind: "unknown" };
  const text = restdateRaw
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text === "") return { kind: "unknown" };

  if (/연중\s*무휴|없음/.test(text)) return { kind: "open", raw: text };

  // 월 단위·n번째 주·명절 규칙은 판정하지 않는다 (오판 시 후보가 죽으므로)
  if (/(첫|둘|셋|넷|다섯)\s*째|매월|마지막\s*주|명절|설날|추석|공휴일/.test(text)) {
    return { kind: "unknown", raw: text };
  }

  // "매주 월요일", "월·화요일 휴무", "월요일, 화요일 휴관" 류
  const weekly = /(?:매주\s*)?((?:[일월화수목금토](?:\s*[·,、/및와과\s]\s*)?)+)요일/.exec(text);
  const mentionsClosure = /매주|휴무|휴관|휴원|휴장|정기\s*휴일|쉼/.test(text);
  if (weekly && mentionsClosure) {
    const days = new Set([...weekly[1]].filter((ch) => (WEEKDAY_CHARS as readonly string[]).includes(ch)));
    if (days.size > 0) {
      const todayChar = WEEKDAY_CHARS[today.getDay()];
      return { kind: days.has(todayChar) ? "closed" : "open", raw: text };
    }
  }

  return { kind: "unknown", raw: text };
}
