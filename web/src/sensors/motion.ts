/**
 * 흔들기(DeviceMotion) 권한·구독 — 휴대폰을 흔들어 원판을 돌리기 위한 센서 (sensors 스킬 규약).
 * 나침반과 같은 원칙: 값은 단말 내 물리 계산에만 쓰고 밖으로 내보내지 않는다 (절대 원칙 1).
 */
import { ShakeMeter } from "../engine/shake";

export type MotionPermission = "granted" | "denied" | "unsupported";

/** iOS 13+ 에만 존재하는 정적 권한 요청 (표준 타입에는 없어 별도 선언) */
interface DeviceMotionEventStatic {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
}

/** DeviceMotion API 자체가 있는가 — 데스크톱·구형 브라우저 폴백 판정 */
export function isMotionSupported(): boolean {
  return typeof window !== "undefined" && "DeviceMotionEvent" in window;
}

/**
 * 사용자 제스처로 권한을 먼저 켜야 하는 환경인가 (iOS 13+).
 * false면 안드로이드·데스크톱처럼 바로 구독해도 되는 환경이다.
 */
export function motionNeedsPermission(): boolean {
  if (!isMotionSupported()) return false;
  const ctor = window.DeviceMotionEvent as unknown as DeviceMotionEventStatic;
  return typeof ctor.requestPermission === "function";
}

/**
 * iOS 13+ 모션 권한 요청 — 나침반과 마찬가지로 **사용자 제스처 핸들러 안에서** 호출한다.
 * 모션 권한은 방위 권한과 별개라 `requestOrientationPermission`을 통과했어도 따로 물어야 한다.
 */
export async function requestMotionPermission(): Promise<MotionPermission> {
  if (!isMotionSupported()) return "unsupported";
  const ctor = window.DeviceMotionEvent as unknown as DeviceMotionEventStatic;
  if (typeof ctor.requestPermission === "function") {
    try {
      const res = await ctor.requestPermission();
      return res === "granted" ? "granted" : "denied";
    } catch {
      // 제스처 밖 호출 등으로 예외 → 거부로 처리하고 드래그 스핀만 남긴다
      return "denied";
    }
  }
  return "granted";
}

/**
 * 흔들기 구독. 콜백에는 데드존을 넘은 흔들림 세기만 전달하며, 해제 함수를 반환한다.
 * 가속도 원값은 이 모듈 밖으로 나가지 않는다.
 */
export function subscribeShake(onShake: (energy: number) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const meter = new ShakeMeter();
  const handler = (event: DeviceMotionEvent): void => {
    const a = event.accelerationIncludingGravity ?? event.acceleration;
    if (!a || a.x === null || a.y === null || a.z === null) return;
    const energy = meter.push({ x: a.x, y: a.y, z: a.z }, performance.now());
    if (energy > 0) onShake(energy);
  };
  window.addEventListener("devicemotion", handler);
  return () => window.removeEventListener("devicemotion", handler);
}
