/**
 * TourAPI 실패를 사용자 문구 한 줄로 옮긴다.
 *
 * 화면마다 "무엇을 못 불러왔는가"는 이미 각자 쓰고 있으므로, 여기서는 **원인 절만**
 * 돌려주고 화면이 그 뒤에 붙인다 — 기존 시각 처리를 그대로 두면서 사유만 읽히게 한다.
 *
 * `resultMsg`·HTTP 상태 같은 기술 문자열은 노출하지 않는다 (docs/ui.md 카피 톤:
 * 짧고 다정한 존댓말). 원문은 tourapi.ts가 콘솔에만 남긴다.
 */
import { TourApiError, type TourApiFailureKind } from "./tourapi";

const CAUSE_LINES: Readonly<Record<TourApiFailureKind, string>> = {
  offline: "네트워크 연결이 끊겨 있어요",
  timeout: "응답이 늦어지고 있어요",
  network: "잠시 연결이 어려워요",
  http: "관광정보 서버가 잠시 불안정해요",
  api: "관광정보를 받아오지 못했어요",
};

/** 원인을 특정할 수 없을 때의 안전한 기본값 — 기존 화면들이 쓰던 문구 그대로다. */
const DEFAULT_LINE = CAUSE_LINES.network;

export function failureCauseLine(error: unknown): string {
  if (error instanceof TourApiError) return CAUSE_LINES[error.kind] ?? DEFAULT_LINE;
  // TourAPI를 거치지 않은 실패(변환 오류 등)라도 단말이 확실히 오프라인이면 그렇게 말해 준다.
  // navigator.onLine은 false일 때만 신뢰한다.
  if (typeof navigator !== "undefined" && navigator.onLine === false) return CAUSE_LINES.offline;
  return DEFAULT_LINE;
}
