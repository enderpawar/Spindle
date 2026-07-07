/**
 * 주입형 RNG — 랜덤 선정은 전부 이 타입을 받아 시드 고정 테스트가 가능하게 한다
 * (algorithm 스킬 규약).
 */

export type Rng = () => number;

/** mulberry32 — 시드 고정 재현용 경량 PRNG */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
