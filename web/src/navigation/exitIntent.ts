/** 안내를 띄운 뒤 이 시간 안에 한 번 더 누르면 종료한다. */
export const EXIT_CONFIRM_WINDOW_MS = 2000

export type ExitDecision =
  | { kind: 'notice'; armedUntil: number }
  | { kind: 'exit' }

/**
 * 홈에서 뒤로가기를 눌렀을 때 안내만 띄울지, 정말 종료할지 고른다.
 *
 * 시간을 인자로 받아 순수 함수로 유지한다 — 타이머 없이 그대로 테스트한다.
 *
 * @param now 현재 시각(ms)
 * @param armedUntil 직전 안내가 유효한 시각. 안내가 없으면 null
 */
export function decideExit(now: number, armedUntil: number | null): ExitDecision {
  if (armedUntil !== null && now <= armedUntil) return { kind: 'exit' }
  return { kind: 'notice', armedUntil: now + EXIT_CONFIRM_WINDOW_MS }
}
