/**
 * 흔들기 세기 측정 — 가만히 든 기기는 0, 흔들면 세기가 나오고, 기기별 이벤트 주기에
 * 좌우되지 않아야 한다 (원판 회전 물리의 입력이므로 기기 독립성이 중요).
 */
import { describe, expect, it } from "vitest";
import { SHAKE_TRIGGER, ShakeMeter } from "./shake";

const G = { x: 0, y: 0, z: 9.8 };

describe("ShakeMeter", () => {
  it("첫 표본은 비교 대상이 없어 0", () => {
    expect(new ShakeMeter().push(G, 0)).toBe(0);
  });

  it("기울여 든 채 가만히 있으면(중력만) 0 — 중력은 차분에서 상쇄된다", () => {
    const meter = new ShakeMeter();
    const tilted = { x: 4.9, y: 0, z: 8.5 };
    meter.push(tilted, 0);
    expect(meter.push(tilted, 16)).toBe(0);
    expect(meter.push(tilted, 32)).toBe(0);
  });

  it("걷는 정도의 작은 흔들림은 데드존에 걸려 0", () => {
    const meter = new ShakeMeter();
    meter.push(G, 0);
    expect(meter.push({ x: 0, y: 0, z: 12 }, 16)).toBe(0);
  });

  it("세게 흔들면 스핀을 시작시킬 세기가 나온다", () => {
    const meter = new ShakeMeter();
    meter.push(G, 0);
    const energy = meter.push({ x: 22, y: -14, z: 9.8 }, 16);
    expect(energy).toBeGreaterThan(SHAKE_TRIGGER);
  });

  it("이벤트 주기가 느린 기기에서도 같은 흔들기는 비슷한 세기로 환산된다", () => {
    const fast = new ShakeMeter();
    fast.push(G, 0);
    fast.push({ x: 10, y: 0, z: 9.8 }, 16);
    const fastEnergy = fast.push({ x: 20, y: 0, z: 9.8 }, 32);

    const slow = new ShakeMeter();
    slow.push(G, 0);
    // 같은 동작을 절반 주기로 관측 — 표본 간 변화량은 두 배가 된다
    const slowEnergy = slow.push({ x: 20, y: 0, z: 9.8 }, 32);

    expect(slowEnergy).toBeCloseTo(fastEnergy, 5);
  });

  it("reset 후에는 이력이 끊겨 다음 표본이 다시 0", () => {
    const meter = new ShakeMeter();
    meter.push(G, 0);
    meter.reset();
    expect(meter.push({ x: 30, y: 0, z: 9.8 }, 16)).toBe(0);
  });
});
