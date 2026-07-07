/**
 * 프록시 요청 검증 — tourapi 스킬 규약의 기계적 강제.
 * 허용 엔드포인트·파라미터 화이트리스트 밖의 요청은 전부 거부한다.
 * 좌표(mapX/mapY 등)를 받는 라우트를 만들지 않는다 (AGENTS.md 절대 원칙 1·2).
 */

export const TOURAPI_BASE = "https://apis.data.go.kr/B551011/KorService2";

// tourapi 스킬 "허용 엔드포인트" 표와 1:1 — 이 목록 밖은 사용 금지
export const ALLOWED_ENDPOINTS = new Set([
  "areaBasedList2",
  "detailCommon2",
  "detailIntro2",
  "detailImage2",
  "searchFestival2",
  "areaCode2",
]);

// 클라이언트가 보낼 수 있는 파라미터 화이트리스트 — 좌표 파라미터는 여기 없으므로 자동 거부
export const ALLOWED_PARAMS = new Set([
  "areaCode",
  "sigunguCode",
  "contentId",
  "contentTypeId",
  "pageNo",
  "numOfRows",
  "eventStartDate",
  "arrange",
]);

// 파라미터 값은 짧은 영숫자만 (TourAPI 코드·ID·날짜 형태)
const VALUE_RE = /^[A-Za-z0-9]{1,32}$/;

export type ValidationResult =
  | { ok: true; endpoint: string; params: Array<[string, string]> }
  | { ok: false; status: number; message: string };

export function validateRequest(
  pathname: string,
  searchParams: URLSearchParams,
): ValidationResult {
  const match = /^\/api\/([A-Za-z0-9]+)$/.exec(pathname);
  if (!match) return { ok: false, status: 404, message: "unknown route" };

  const endpoint = match[1];
  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return { ok: false, status: 400, message: `endpoint not allowed: ${endpoint}` };
  }

  const params: Array<[string, string]> = [];
  for (const [key, value] of searchParams) {
    if (!ALLOWED_PARAMS.has(key)) {
      return { ok: false, status: 400, message: `param not allowed: ${key}` };
    }
    if (!VALUE_RE.test(value)) {
      return { ok: false, status: 400, message: `invalid value for param: ${key}` };
    }
    params.push([key, value]);
  }
  return { ok: true, endpoint, params };
}
