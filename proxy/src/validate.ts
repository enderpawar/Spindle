/**
 * 프록시 요청 검증 — tourapi 스킬 규약의 기계적 강제.
 * 허용 엔드포인트·파라미터 화이트리스트 밖의 요청은 전부 거부한다.
 * 좌표(mapX/mapY 등)를 받는 라우트를 만들지 않는다 (AGENTS.md 절대 원칙 1·2).
 */

export const TOURAPI_BASE = "https://apis.data.go.kr/B551011/KorService2";
export const TOURAPI_CONGESTION_BASE =
  "https://apis.data.go.kr/B551011/TatsCnctrRateService";

// tourapi 스킬 "허용 엔드포인트" 표와 1:1 — 이 목록 밖은 사용 금지
export const ALLOWED_ENDPOINTS = new Set([
  "areaBasedList2",
  "detailCommon2",
  "detailIntro2",
  "detailImage2",
  "searchFestival2",
  "areaCode2",
  "tatsCnctrRatedList",
]);

// 엔드포인트별 파라미터 화이트리스트. 두 TourAPI 서비스의 지역코드 체계를 섞지 않는다.
const ENDPOINT_PARAMS: Readonly<Record<string, ReadonlySet<string>>> = {
  areaBasedList2: new Set(["areaCode", "sigunguCode", "contentTypeId", "pageNo", "numOfRows", "arrange"]),
  detailCommon2: new Set(["contentId"]),
  detailIntro2: new Set(["contentId", "contentTypeId"]),
  detailImage2: new Set(["contentId", "pageNo", "numOfRows"]),
  searchFestival2: new Set(["areaCode", "sigunguCode", "eventStartDate", "pageNo", "numOfRows", "arrange"]),
  areaCode2: new Set(["areaCode", "pageNo", "numOfRows"]),
  tatsCnctrRatedList: new Set(["areaCd", "signguCd", "pageNo", "numOfRows"]),
};

// 파라미터 값은 짧은 영숫자만 (TourAPI 코드·ID·날짜 형태)
const VALUE_RE = /^[A-Za-z0-9]{1,32}$/;

// ── 공유 카드용 이미지 릴레이 (/api/img) ──
// TourAPI 이미지 CDN에는 CORS 헤더가 없어 브라우저 canvas.toBlob이 오염(taint)으로 실패한다.
// 그래서 이미지를 이 프록시로 same-origin 중계한다. 클라이언트는 contentId만 보내고
// (좌표·임의 URL 아님), 워커가 detailCommon2로 대표 이미지를 해석해 스트리밍한다.
// 응답은 no-store로만 흘려보내고 저장하지 않는다 (절대 원칙 3).
export const IMAGE_HOST_ALLOWLIST = new Set(["tong.visitkorea.or.kr"]);

/** 이미지 릴레이가 받는 contentId 검증 — 다른 파라미터 값과 동일 형식 */
export function isValidContentId(value: string): boolean {
  return VALUE_RE.test(value);
}

/** TourAPI 대표 이미지 URL이 http로 오면 https로 (혼합 콘텐츠 차단 회피) */
export function normalizeImageUrl(url: string): string {
  return url.startsWith("http://") ? `https://${url.slice("http://".length)}` : url;
}

/** SSRF 방지 — TourAPI 응답에서 온 URL이라도 호스트를 화이트리스트로 재확인 */
export function isAllowedImageHost(url: string): boolean {
  try {
    return IMAGE_HOST_ALLOWLIST.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export type ValidationResult =
  | { ok: true; endpoint: string; params: Array<[string, string]> }
  | { ok: false; status: number; message: string };

/** 허용된 엔드포인트가 속한 upstream을 선택한다. */
export function tourApiBaseFor(endpoint: string): string {
  return endpoint === "tatsCnctrRatedList" ? TOURAPI_CONGESTION_BASE : TOURAPI_BASE;
}

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

  const allowedParams = ENDPOINT_PARAMS[endpoint];
  const params: Array<[string, string]> = [];
  for (const [key, value] of searchParams) {
    if (!allowedParams.has(key)) {
      return { ok: false, status: 400, message: `param not allowed: ${key}` };
    }
    if (!VALUE_RE.test(value)) {
      return { ok: false, status: 400, message: `invalid value for param: ${key}` };
    }
    params.push([key, value]);
  }
  return { ok: true, endpoint, params };
}
