/**
 * 운영 상태 축 — SPEC 4장 점수 산식의 네 번째 요소.
 * 후보 점수 = 방향 일치도 × 접근 가능성 × **운영 상태** × 분산 가중치.
 *
 * `detailIntro2`의 이용시간·휴무일은 자유 텍스트라 파싱이 불완전하다.
 * tourapi 스킬 규약대로 **파싱 실패·모호한 값은 보수적으로 통과**(1.0)시키고,
 * 우리가 확실히 읽어낸 경우에만 감점·제외한다. 억지 추정은 하지 않는다.
 *
 * 도착 시각의 근거는 존-교량 모델의 보정 이동시간(zones.ts `travelMinutes`)뿐이다.
 * 라우팅 API는 출발지 좌표를 서버로 보내야 해서 쓸 수 없다 (절대 원칙 1,
 * docs/competition.md 2026-08-02 결정). 그래서 분 단위 도착 시각을 단정하지 않고,
 * 모델에 없는 비용(신호·경사·계단·환승 대기)을 흡수할 안전 마진을 얹어 보수적으로 판정한다.
 * 모든 계산은 단말 내에서만 수행한다.
 */

/** 보정 이동시간에 더하는 안전 마진(분) — 모델이 세지 않는 신호·경사·환승 대기 몫 */
export const ARRIVAL_MARGIN_MIN = 10;
/** 도착 후 이만큼도 안 남으면 "아슬한" 방문으로 본다(분) */
export const TIGHT_STAY_MIN = 30;
/** 아슬한 후보의 감점 계수 — 제외하지는 않되 뒤로 밀린다 */
export const TIGHT_SCORE = 0.55;

export type OperationKind =
  /** 오늘이 휴무일 */
  | "closedToday"
  /** 지금 출발하면 마감 이후 도착 */
  | "tooLate"
  /** 도착은 하지만 머무를 시간이 거의 없음 */
  | "tight"
  /** 여유 있게 방문 가능 */
  | "open"
  /** 상시 개방(마감 없음) */
  | "alwaysOpen"
  /** 정보 없음·모호 — 보수적 통과 */
  | "unknown";

/** TourAPI detailIntro2에서 가져온 운영 관련 원문 */
export interface OperationInfo {
  /** 이용시간·관람시간·영업시간 원문 */
  usetime?: string;
  /** 휴무일 원문 */
  restdate?: string;
}

export interface OperationStatus {
  kind: OperationKind;
  /** 점수 산식에 곱해지는 계수 (0이면 후보에서 제외) */
  score: number;
  /** 결과 카드에 노출할 조용한 한 줄 — 없으면 아무것도 표시하지 않는다 */
  line?: string;
  /** 파싱에 성공한 마감 시각(자정 기준 분) */
  closeMinutes?: number;
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 자정 기준 분 → "19:00" */
export function formatHm(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toMinutes(hour: number, minute: number): number | null {
  if (hour < 0 || hour > 24 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

const ALWAYS_OPEN_RE = /상시\s*개방|상시\s*운영|24\s*시간|연중\s*무휴|항상\s*개방/;
const NEVER_CLOSED_RE = /연중\s*무휴|무휴|없음|없슴|연중\s*개방|상시\s*개방/;

/** "입장 마감 17:30" 처럼 실제 방문 가능 하한을 알려주는 표기 */
const LAST_ADMISSION_RE = /(?:입장\s*마감|입장\s*종료|매표\s*마감|마지막\s*입장)\D{0,6}(\d{1,2})\s*[:시]\s*(\d{1,2})?/;

/** "09:00~18:00" / "09시~18시" / "10:00 - 21:00" 등 시간 구간 */
const TIME_RANGE_RE =
  /(\d{1,2})\s*[:시]\s*(\d{1,2})?\s*(?:분)?\s*[~\-–—∼]\s*(\d{1,2})\s*[:시]\s*(\d{1,2})?/g;

/**
 * 이용시간 원문에서 오늘의 마감 시각을 읽는다.
 *
 * 하절기·동절기처럼 **마감이 서로 다른 구간이 섞여 있으면 어느 쪽이 오늘인지 알 수 없으므로
 * 판단을 포기한다**(null → 보수적 통과). 값을 지어내느니 축을 끄는 쪽이 안전하다.
 */
export function parseCloseMinutes(usetime: string | undefined): number | null {
  if (!usetime) return null;
  const text = usetime.replace(/\s+/g, " ");

  // 입장 마감이 명시돼 있으면 그쪽이 실제 방문 가능 하한이다.
  const lastAdmission = LAST_ADMISSION_RE.exec(text);
  if (lastAdmission) {
    const minutes = toMinutes(Number(lastAdmission[1]), Number(lastAdmission[2] ?? 0));
    if (minutes !== null) return minutes;
  }

  const closes = new Set<number>();
  TIME_RANGE_RE.lastIndex = 0;
  for (let m = TIME_RANGE_RE.exec(text); m !== null; m = TIME_RANGE_RE.exec(text)) {
    const open = toMinutes(Number(m[1]), Number(m[2] ?? 0));
    const close = toMinutes(Number(m[3]), Number(m[4] ?? 0));
    if (open === null || close === null) continue;
    if (close <= open) continue; // 자정 넘김·오타 구간은 판단 보류
    closes.add(close);
  }

  if (closes.size !== 1) return null; // 0개(파싱 실패) 또는 2개 이상(계절별 상이) → 판단 보류
  return [...closes][0];
}

/** 휴무일 원문에서 정기 휴무 요일을 읽는다 (읽어내지 못하면 빈 집합) */
export function parseClosedWeekdays(restdate: string | undefined): ReadonlySet<string> {
  const closed = new Set<string>();
  if (!restdate) return closed;
  const text = restdate.replace(/\s+/g, " ");
  if (NEVER_CLOSED_RE.test(text)) return closed;

  for (const m of text.matchAll(/매주\s*([월화수목금토일])/g)) closed.add(m[1]);
  for (const m of text.matchAll(/([월화수목금토일])\s*요일/g)) closed.add(m[1]);
  return closed;
}

/** 마감 개념이 없는 상시 개방 장소인가 */
export function isAlwaysOpen(info: OperationInfo | undefined): boolean {
  if (!info) return false;
  return ALWAYS_OPEN_RE.test((info.usetime ?? "").replace(/\s+/g, " "));
}

export interface EvaluateOperationInput {
  /** detailIntro2 원문 — 아직 모르면 undefined (보수적 통과) */
  info: OperationInfo | undefined;
  /** 존-교량 모델의 보정 이동시간(분) */
  travelMinutes: number;
  /** 기준 시각 (테스트 주입용) */
  now?: Date;
}

/**
 * 운영 상태 평가 — 점수 계수와 결과 카드 문구를 함께 낸다.
 *
 * 문구는 확실한 값(TourAPI 마감 시각)과 추정치(우리 이동시간 근사)를 문장에서 구분한다:
 * 마감 시각은 단정하고, 도착은 "지금 출발하면"으로 우리 추정임을 드러낸다.
 */
export function evaluateOperation(input: EvaluateOperationInput): OperationStatus {
  const now = input.now ?? new Date();
  const info = input.info;

  if (!info || (!info.usetime && !info.restdate)) {
    return { kind: "unknown", score: 1 };
  }

  const closedWeekdays = parseClosedWeekdays(info.restdate);
  if (closedWeekdays.has(WEEKDAY_KO[now.getDay()])) {
    return { kind: "closedToday", score: 0, line: "오늘은 쉬는 날이에요" };
  }

  if (isAlwaysOpen(info)) {
    return { kind: "alwaysOpen", score: 1, line: "언제 가도 열려 있는 곳이에요" };
  }

  const closeMinutes = parseCloseMinutes(info.usetime);
  if (closeMinutes === null) return { kind: "unknown", score: 1 };

  const arrival =
    now.getHours() * 60 +
    now.getMinutes() +
    Math.ceil(Math.max(0, input.travelMinutes)) +
    ARRIVAL_MARGIN_MIN;
  const remaining = closeMinutes - arrival;
  const closeText = formatHm(closeMinutes);

  if (remaining <= 0) {
    return {
      kind: "tooLate",
      score: 0,
      line: `오늘 ${closeText} 마감 · 지금 출발하면 늦어요`,
      closeMinutes,
    };
  }
  if (remaining < TIGHT_STAY_MIN) {
    return {
      kind: "tight",
      score: TIGHT_SCORE,
      line: `오늘 ${closeText} 마감 · 지금 출발하면 아슬해요`,
      closeMinutes,
    };
  }
  return {
    kind: "open",
    score: 1,
    line: `오늘 ${closeText} 마감 · 지금 출발해도 여유 있어요`,
    closeMinutes,
  };
}
