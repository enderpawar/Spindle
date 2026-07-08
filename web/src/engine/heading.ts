/**
 * 나침반 방위각 수학 — sensors 스킬 규약. (현장 모드 전용)
 * DeviceOrientation 이벤트에서 진북 기준 heading 추출 + 원형 평균 스무딩.
 * 전부 단말 내 계산이며 방위각은 어떤 네트워크 요청에도 싣지 않는다 (절대 원칙 1).
 */
import { normalizeHeading } from "./compass";

/** DeviceOrientationEvent에서 읽는 최소 필드 — 테스트를 위해 평범한 객체로 대체 가능 */
export interface OrientationSample {
  /** iOS: 진북 기준 시계방향 0–360 (이미 방위값) */
  webkitCompassHeading?: number | null;
  /** 표준: z축 회전각. 절대값 여부는 absolute로 판단 */
  alpha?: number | null;
  absolute?: boolean;
}

/**
 * 이벤트 → 진북 기준 heading(0–360). 절대 방위를 얻을 수 없으면 null.
 * - iOS `webkitCompassHeading` 우선 (이미 진북·시계방향).
 * - 표준은 `absolute === true`일 때만 사용하고 `360 - alpha`로 시계방향 heading으로 변환.
 *   (`alpha`는 반시계 증가) — 절대 방위가 아니면 방향을 신뢰할 수 없어 null.
 */
export function headingFromOrientation(e: OrientationSample): number | null {
  if (typeof e.webkitCompassHeading === "number" && Number.isFinite(e.webkitCompassHeading)) {
    return normalizeHeading(e.webkitCompassHeading);
  }
  if (e.absolute === true && typeof e.alpha === "number" && Number.isFinite(e.alpha)) {
    return normalizeHeading(360 - e.alpha);
  }
  return null;
}

/** 각도 표본들을 단위벡터로 더한 합 (원형 통계 공용 계산) */
function sumUnitVectors(samples: readonly number[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const deg of samples) {
    const r = (deg * Math.PI) / 180;
    x += Math.cos(r);
    y += Math.sin(r);
  }
  return { x, y };
}

/**
 * 각도 표본의 원형 평균 (0/360 경계 안전). 빈 배열이거나 정확히 상쇄되면 null.
 * 방위각은 산술 평균 금지 — [350°, 10°]의 평균은 0°이지 180°가 아니다 (sensors 스킬).
 */
export function circularMeanDeg(samples: readonly number[]): number | null {
  if (samples.length === 0) return null;
  const { x, y } = sumUnitVectors(samples);
  // 합벡터 크기가 사실상 0이면(정반대 표본 상쇄) 평균 각도가 정의되지 않는다.
  if (Math.hypot(x, y) < 1e-9) return null;
  return normalizeHeading((Math.atan2(y, x) * 180) / Math.PI);
}

/**
 * 표본의 원형 집중도 R̄ (0 = 완전 분산, 1 = 완전 일치). 값이 클수록 방위가 안정적이다.
 * 빈 배열은 0. 방위 잠금(스핀 정지) 판정에 사용한다.
 */
export function circularConcentration(samples: readonly number[]): number {
  if (samples.length === 0) return 0;
  const { x, y } = sumUnitVectors(samples);
  return Math.hypot(x, y) / samples.length;
}

/**
 * 최근 N개 표본으로 방위각을 스무딩하는 링버퍼.
 * DeviceOrientation 이벤트를 push하면 원형 평균을 유지하고, 집중도로 안정 여부를 판정한다.
 */
export class HeadingSmoother {
  private readonly buf: number[] = [];
  private readonly size: number;

  constructor(size = 8) {
    this.size = size;
  }

  push(deg: number): void {
    this.buf.push(normalizeHeading(deg));
    if (this.buf.length > this.size) this.buf.shift();
  }

  /** 현재 스무딩된 방위각 (표본 없으면 null) */
  get value(): number | null {
    return circularMeanDeg(this.buf);
  }

  get sampleCount(): number {
    return this.buf.length;
  }

  /** 버퍼가 가득 차고 집중도가 임계 이상이면 안정 (기기 회전이 멈춘 상태) */
  isStable(minConcentration = 0.995): boolean {
    return this.buf.length >= this.size && circularConcentration(this.buf) >= minConcentration;
  }

  reset(): void {
    this.buf.length = 0;
  }
}
