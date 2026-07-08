/**
 * 나침반(DeviceOrientation) 권한·구독 — 현장 모드 전용 (sensors 스킬 규약).
 * 방위각은 단말 내에서만 사용하고 어떤 네트워크 요청·로그·에러 리포팅에도 싣지 않는다 (절대 원칙 1).
 */
import { headingFromOrientation, type OrientationSample } from "../engine/heading";

export type OrientationPermission = "granted" | "denied" | "unsupported";

/** iOS 13+ 에만 존재하는 정적 권한 요청 (표준 타입에는 없어 별도 선언) */
interface DeviceOrientationEventStatic {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
}

/** DeviceOrientation API 자체가 있는가 — 데스크톱·구형 브라우저 폴백 판정 */
export function isOrientationSupported(): boolean {
  return typeof window !== "undefined" && "DeviceOrientationEvent" in window;
}

/**
 * iOS 13+ 방위 권한 요청 — 반드시 **사용자 제스처(버튼 클릭) 핸들러 안에서** 호출한다.
 * 페이지 로드 시 자동 호출하면 조용히 거부된다 (sensors 스킬).
 * requestPermission이 없는 환경(안드로이드·데스크톱 지원 기기)은 권한 개념이 없어 granted로 본다.
 */
export async function requestOrientationPermission(): Promise<OrientationPermission> {
  if (!isOrientationSupported()) return "unsupported";
  const ctor = window.DeviceOrientationEvent as unknown as DeviceOrientationEventStatic;
  if (typeof ctor.requestPermission === "function") {
    try {
      const res = await ctor.requestPermission();
      return res === "granted" ? "granted" : "denied";
    } catch {
      // 제스처 밖 호출 등으로 예외 → 거부로 처리하고 여행 모드 폴백
      return "denied";
    }
  }
  return "granted";
}

/**
 * heading 이벤트 구독. 안드로이드 절대 방위(`deviceorientationabsolute`)를 우선 청취하고,
 * iOS는 `deviceorientation`의 `webkitCompassHeading`으로 값이 들어온다.
 * 절대 방위가 아닌 표본은 headingFromOrientation이 걸러내므로 중복 청취해도 안전하다.
 * 콜백에는 진북 기준 heading(0–360)만 전달하며, 해제 함수를 반환한다.
 */
export function subscribeHeading(onHeading: (deg: number) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event): void => {
    const deg = headingFromOrientation(event as unknown as OrientationSample);
    if (deg !== null) onHeading(deg);
  };
  window.addEventListener("deviceorientationabsolute", handler, true);
  window.addEventListener("deviceorientation", handler, true);
  return () => {
    window.removeEventListener("deviceorientationabsolute", handler, true);
    window.removeEventListener("deviceorientation", handler, true);
  };
}
