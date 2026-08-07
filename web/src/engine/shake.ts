/**
 * 흔들기 세기 측정 — 가속도 표본에서 "흔든 정도"만 뽑아낸다 (sensors 스킬 규약).
 * 가속도 값은 원판 회전 물리 계산에만 단말 내에서 쓰고, 어떤 네트워크 요청·로그에도 싣지 않는다
 * (절대 원칙 1). 방위각과 달리 위치를 유추할 수 없는 값이지만 취급 원칙은 동일하게 적용한다.
 */

/** DeviceMotionEvent.accelerationIncludingGravity에서 읽는 최소 필드 */
export interface AccelSample {
  x: number;
  y: number;
  z: number;
}

/** 이 미만의 변화는 손떨림·걸음걸이로 보고 버린다 (m/s², 60Hz 프레임 간 변화량 기준) */
export const SHAKE_DEADZONE = 4.5;

/** 멈춰 있던 원판을 새로 돌리기 시작할 만큼 분명한 흔들기 (데드존 차감 전 원값) */
export const SHAKE_TRIGGER = 12;

/** 세기를 환산하는 기준 주기 — 기기별 devicemotion 이벤트 간격 편차를 흡수한다 */
const FRAME_MS = 16;

/** 표본 간격이 비정상적으로 짧을 때 세기가 폭발하지 않도록 하는 하한 */
const MIN_STEP_MS = 4;

/**
 * 연속된 가속도 표본에서 흔들림 세기를 계산한다.
 *
 * 중력 성분은 기기를 가만히 들고 있으면 상수이므로, **직전 표본과의 차이**만 보면
 * 기울기는 상쇄되고 흔든 성분만 남는다 (accelerationIncludingGravity를 그대로 쓸 수 있는 이유).
 * 이벤트 주기는 기기마다 다르므로 60Hz 기준으로 정규화해 세기를 기기 독립적으로 만든다.
 */
export class ShakeMeter {
  private prev: AccelSample | null = null;
  private prevAt = 0;

  /** 표본 하나를 넣고 흔들림 세기를 돌려준다. 데드존 이하면 0 (= 흔들지 않음) */
  push(sample: AccelSample, at: number): number {
    const prev = this.prev;
    const prevAt = this.prevAt;
    this.prev = sample;
    this.prevAt = at;
    if (!prev) return 0;

    const step = Math.max(at - prevAt, MIN_STEP_MS);
    const delta = Math.hypot(sample.x - prev.x, sample.y - prev.y, sample.z - prev.z);
    const energy = (delta / step) * FRAME_MS;
    return energy > SHAKE_DEADZONE ? energy - SHAKE_DEADZONE : 0;
  }

  /** 구독을 다시 시작할 때처럼 이력을 끊어야 하는 경우 */
  reset(): void {
    this.prev = null;
    this.prevAt = 0;
  }
}
