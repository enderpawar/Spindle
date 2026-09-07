/**
 * 흔들기(DeviceMotion) 권한·구독 — 휴대폰을 흔들어 원판을 돌리기 위한 센서 (sensors 스킬 규약).
 * 나침반과 같은 원칙: 값은 단말 내 물리 계산에만 쓰고 밖으로 내보내지 않는다 (절대 원칙 1).
 */
import { ShakeMeter } from "../engine/shake";

export type MotionPermission = "granted" | "denied" | "unsupported" | "retryable";

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
 * 이 페이지 세션에서 이미 받은 응답. iOS는 페이지 로드마다 제스처 안에서 물어야 하지만,
 * 같은 로드 안에서는 한 번 허용받으면 이후 구독에 다시 물을 필요가 없다 —
 * 스핀 탭을 오갈 때마다 프롬프트가 다시 뜨지 않게 기억해 둔다. (영속 저장 아님, 메모리 한정)
 */
let sessionPermission: MotionPermission | null = null;

/** 이번 페이지 로드에서 이미 확정된 응답 (아직 묻지 않았으면 null) */
export function knownMotionPermission(): MotionPermission | null {
  return sessionPermission;
}

/** 테스트 사이에서 페이지 세션 권한 상태를 격리한다. */
export function clearMotionPermissionForTest(): void {
  sessionPermission = null;
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
      if (res === "granted" || res === "denied") {
        sessionPermission = res;
        return sessionPermission;
      }
      // default는 사용자의 명시적 거부가 아니다. 다음 사용자 제스처에서 다시 시도한다.
      sessionPermission = null;
      return "retryable";
    } catch {
      // 제스처 밖 호출 등은 실제 거부가 아니므로 세션에 확정하지 않는다.
      sessionPermission = null;
      return "retryable";
    }
  }
  sessionPermission = "granted";
  return sessionPermission;
}

/**
 * 흔들기 구독. 콜백에는 데드존을 넘은 흔들림 세기만 전달하며, 해제 함수를 반환한다.
 * onSample은 값 없는 생존 신호일 뿐이며 devicemotion 이벤트가 올 때마다 호출한다.
 * C9 런타임은 권한 결과로 구독 시점을 정해 이 신호에 의존하지 않지만 진단·호환성을 위해 유지한다.
 * 가속도 원값은 이 모듈 밖으로 나가지 않는다.
 */
export function subscribeShake(
  onShake: (energy: number) => void,
  onSample?: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const meter = new ShakeMeter();
  const handler = (event: DeviceMotionEvent): void => {
    onSample?.();
    const a = event.accelerationIncludingGravity ?? event.acceleration;
    if (!a || a.x === null || a.y === null || a.z === null) return;
    const energy = meter.push({ x: a.x, y: a.y, z: a.z }, performance.now());
    if (energy > 0) onShake(energy);
  };
  window.addEventListener("devicemotion", handler);
  return () => window.removeEventListener("devicemotion", handler);
}
