/**
 * 운영 상태 축 — SPEC 4장 점수 산식의 네 번째 요소.
 * 후보 점수 = 방향 일치도 × 접근 가능성 × **운영 상태** × 분산 가중치.
 *
 * **지금 갈 수 없는 곳을 스핀 대상에서 뺀다.** 두 경우가 있다:
 *   1. 운영 중단 — 폐업·임시 휴관처럼 기약 없이 문을 닫은 곳
 *   2. 운영시간 외 — 오늘 휴무이거나 지금이 이용시간 밖인 곳
 *
 * 판정 기준은 **현재 시각**이다. 이동에 얼마나 걸리는지는 계산하지 않는다 —
 * 라우팅 API를 쓸 수 없어(절대 원칙 1) 도착 시각을 단정할 근거가 없고,
 * 실제 소요 시간은 사용자가 길찾기에서 직접 확인하는 편이 정확하다.
 *
 * 정기 휴무 자체는 중단이 아니다(다음 주엔 열린다). 다만 **오늘이 그 요일이면**
 * 지금은 갈 수 없으므로 제외한다. 문구가 애매하면 통과시킨다 (tourapi 스킬 규약).
 * 모든 계산은 단말 내에서만 수행한다.
 */

export type OperationKind =
  /** 기약 없이 문을 닫은 곳 */
  | "closed"
  /** 오늘 휴무이거나 지금이 이용시간 밖 */
  | "offHours"
  /** 지금 갈 수 있는 곳 (근거가 없어 판단을 보류한 경우 포함) */
  | "open";

/** TourAPI에서 가져온 운영 관련 원문 */
export interface OperationInfo {
  /** detailIntro2 이용시간·관람시간·영업시간 */
  usetime?: string;
  /** detailIntro2 휴무일 */
  restdate?: string;
  /** detailCommon2 소개 — 중단 공지가 여기에만 적힌 경우가 있다 */
  overview?: string;
}

export interface OperationStatus {
  kind: OperationKind;
  /** 점수 산식에 곱해지는 계수 (0이면 후보에서 제외) */
  score: number;
  /** 화면에 노출할 안내 — 갈 수 있는 곳이면 없음 */
  notice?: string;
  /** 그렇게 판단한 근거 (테스트·디버깅용) */
  matched?: string;
}

/** 운영 중단 안내 — 결과 카드·명소 상세가 공유한다 */
export const CLOSED_NOTICE = "운영이 중단된 곳이에요!";
/** 운영시간 외 안내 */
export const OFF_HOURS_NOTICE = "지금은 운영시간이 아니에요!";

/**
 * 운영 중단으로 볼 표현들.
 *
 * 맨 "휴관"은 넣지 않는다 — "매주 월요일 휴관"이 압도적으로 흔해서 정기 휴무를
 * 중단으로 오인한다. 임시·잠정·무기한처럼 **기약 없음을 뜻하는 수식어가 붙었을 때만** 센다.
 */
const CLOSURE_PATTERNS: readonly RegExp[] = [
  /운영\s*(?:을|이)?\s*(?:중단|중지)/,
  /영업\s*(?:을|이)?\s*(?:중단|중지)/,
  /운영\s*종료/,
  /영업\s*종료/,
  /(?:임시|잠정|무기한|장기)\s*(?:휴관|휴업|폐쇄|중단)/,
  /폐업|폐관|폐점|영구\s*폐쇄/,
  /철거\s*(?:되|완료|예정)/,
  /운영(?:하지|되지)\s*않/,
];

/** "운영종료 18:00"처럼 하루 마감 시각을 뜻하는 표기는 중단이 아니다. */
const DAILY_CLOSING_RE = /(?:종료|중단)\s*(?:시간)?\s*[:은는]?\s*\d{1,2}\s*[:시]/;

const ALWAYS_OPEN_RE = /상시\s*개방|상시\s*운영|24\s*시간|항상\s*개방|일출\s*[~\-–—∼]\s*일몰/;
const NEVER_CLOSED_RE = /연중\s*무휴|무휴|없음|없슴|연중\s*개방|상시\s*개방/;

/** "09:00~18:00" / "09시~18시" / "10:00 - 21:00" 등 시간 구간 */
const TIME_RANGE_RE =
  /(\d{1,2})\s*[:시]\s*(\d{1,2})?\s*(?:분)?\s*[~\-–—∼]\s*(\d{1,2})\s*[:시]\s*(\d{1,2})?/g;

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

function normalize(text: string | undefined): string {
  return (text ?? "").replace(/\s+/g, " ");
}

function toMinutes(hour: number, minute: number): number | null {
  if (hour < 0 || hour > 24 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

/** 자정 기준 분 → "19:00" */
export function formatHm(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * 원문에서 운영 중단 근거를 찾는다. 없으면 null.
 * 근거 문구를 함께 돌려주므로 왜 그렇게 판단했는지 테스트로 고정할 수 있다.
 */
export function findClosureEvidence(info: OperationInfo | undefined): string | null {
  if (!info) return null;
  for (const field of [info.usetime, info.restdate, info.overview]) {
    const text = normalize(field);
    if (!text) continue;
    for (const pattern of CLOSURE_PATTERNS) {
      const match = pattern.exec(text);
      if (!match) continue;
      // 같은 문장이 하루 마감 시각을 말하는 것이면 중단으로 세지 않는다.
      if (DAILY_CLOSING_RE.test(text)) continue;
      return match[0];
    }
  }
  return null;
}

/** 마감 개념이 없는 상시 개방 장소인가 */
export function isAlwaysOpen(info: OperationInfo | undefined): boolean {
  return ALWAYS_OPEN_RE.test(normalize(info?.usetime));
}

export interface HourRange {
  open: number;
  close: number;
}

/**
 * 이용시간 원문에서 오늘의 운영 구간을 읽는다.
 *
 * 하절기·동절기처럼 **구간이 서로 다르게 여럿이면 어느 쪽이 오늘인지 알 수 없으므로
 * 판단을 포기한다**(null → 보수적 통과). 값을 지어내느니 축을 끄는 쪽이 안전하다.
 */
export function parseHourRange(usetime: string | undefined): HourRange | null {
  const text = normalize(usetime);
  if (!text) return null;

  const ranges = new Map<string, HourRange>();
  TIME_RANGE_RE.lastIndex = 0;
  for (let m = TIME_RANGE_RE.exec(text); m !== null; m = TIME_RANGE_RE.exec(text)) {
    const open = toMinutes(Number(m[1]), Number(m[2] ?? 0));
    const close = toMinutes(Number(m[3]), Number(m[4] ?? 0));
    if (open === null || close === null) continue;
    if (close <= open) continue; // 자정 넘김·오타 구간은 판단 보류
    ranges.set(`${open}-${close}`, { open, close });
  }

  if (ranges.size !== 1) return null; // 0개(파싱 실패) 또는 2개 이상(계절·요일별 상이)
  return [...ranges.values()][0];
}

/** 휴무일 원문에서 정기 휴무 요일을 읽는다 (읽어내지 못하면 빈 집합) */
export function parseClosedWeekdays(restdate: string | undefined): ReadonlySet<string> {
  const closed = new Set<string>();
  const text = normalize(restdate);
  if (!text || NEVER_CLOSED_RE.test(text)) return closed;

  for (const m of text.matchAll(/매주\s*([월화수목금토일])/g)) closed.add(m[1]);
  for (const m of text.matchAll(/([월화수목금토일])\s*요일/g)) closed.add(m[1]);
  return closed;
}

/**
 * 운영 상태 평가 — 지금 갈 수 없는 곳만 0점(후보 제외)이다.
 *
 * @param now 기준 시각 (테스트 주입용). 기본은 단말의 현재 시각.
 */
export function evaluateOperation(
  info: OperationInfo | undefined,
  now: Date = new Date(),
): OperationStatus {
  const closure = findClosureEvidence(info);
  if (closure !== null) {
    return { kind: "closed", score: 0, notice: CLOSED_NOTICE, matched: closure };
  }
  if (!info) return { kind: "open", score: 1 };

  const closedWeekdays = parseClosedWeekdays(info.restdate);
  const today = WEEKDAY_KO[now.getDay()];
  if (closedWeekdays.has(today)) {
    return {
      kind: "offHours",
      score: 0,
      notice: OFF_HOURS_NOTICE,
      matched: `${today}요일 휴무`,
    };
  }

  if (isAlwaysOpen(info)) return { kind: "open", score: 1 };

  const range = parseHourRange(info.usetime);
  if (range === null) return { kind: "open", score: 1 }; // 읽지 못했으면 보수적 통과

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (nowMinutes < range.open || nowMinutes >= range.close) {
    return {
      kind: "offHours",
      score: 0,
      notice: OFF_HOURS_NOTICE,
      matched: `${formatHm(range.open)}~${formatHm(range.close)}`,
    };
  }
  return { kind: "open", score: 1 };
}
