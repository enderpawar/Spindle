/**
 * Spindle TourAPI 프록시 (Cloudflare Workers)
 * 역할은 두 가지뿐: serviceKey 환경변수 주입, 요청 중계 (tourapi 스킬 규약).
 * 요청·응답을 어디에도 저장·로깅하지 않는다 (AGENTS.md 절대 원칙 3·4).
 */
import {
  TOURAPI_BASE,
  isAllowedImageHost,
  isValidContentId,
  normalizeImageUrl,
  tourApiBaseFor,
  validateRequest,
} from "./validate";

export interface Env {
  /** TourAPI 디코딩된 인증키 — .dev.vars(로컬) / wrangler secret(프로덕션)에만 존재 */
  TOURAPI_SERVICE_KEY: string;
  /** CORS 허용 오리진. 미설정 시 "*" (Phase 6에서 Pages 도메인으로 좁힘) */
  ALLOWED_ORIGIN?: string;
}

const UPSTREAM_TIMEOUT_MS = 10_000;

function corsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN ?? "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonError(env: Env, status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(env) },
  });
}

/** 공통 파라미터를 붙인 TourAPI upstream URL */
function tourApiUrl(endpoint: string, contentId: string, key: string): string {
  const u = new URL(`${TOURAPI_BASE}/${endpoint}`);
  u.searchParams.set("contentId", contentId);
  u.searchParams.set("serviceKey", key);
  u.searchParams.set("MobileOS", "ETC");
  u.searchParams.set("MobileApp", "Spindle");
  u.searchParams.set("_type", "json");
  return u.toString();
}

function firstItem(data: unknown): Record<string, unknown> | undefined {
  const items = (data as { response?: { body?: { items?: { item?: unknown } | "" } } })?.response
    ?.body?.items;
  if (!items) return undefined; // 빈 결과는 items가 "" (falsy)로 온다
  const item = items.item;
  const first = Array.isArray(item) ? item[0] : item;
  return (first as Record<string, unknown>) ?? undefined;
}

function cleanUrl(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? normalizeImageUrl(value) : null;
}

/**
 * contentId의 대표 이미지 URL 해석 — detailCommon2 firstimage 우선,
 * 비어 있으면 detailImage2 첫 장으로 보충 (details.ts와 동일 규칙).
 */
async function resolveFirstImageUrl(contentId: string, env: Env): Promise<string | null> {
  const commonRes = await fetch(tourApiUrl("detailCommon2", contentId, env.TOURAPI_SERVICE_KEY), {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  const fromCommon = cleanUrl(firstItem(await commonRes.json())?.firstimage);
  if (fromCommon) return fromCommon;

  // firstimage가 빈 POI는 detailImage2에서 첫 이미지를 보충
  const imageRes = await fetch(tourApiUrl("detailImage2", contentId, env.TOURAPI_SERVICE_KEY), {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  const img = firstItem(await imageRes.json());
  return cleanUrl(img?.originimgurl) ?? cleanUrl(img?.smallimageurl);
}

/**
 * 공유 카드 canvas용 이미지 same-origin 릴레이.
 * 클라이언트는 contentId만 보내고, 워커가 대표 이미지를 해석·검증 후 스트리밍한다.
 * 저장·로깅하지 않으며 no-store로만 흘려보낸다 (절대 원칙 3).
 */
async function handleImage(url: URL, env: Env): Promise<Response> {
  const contentId = url.searchParams.get("contentId") ?? "";
  if (!isValidContentId(contentId)) return jsonError(env, 400, "invalid contentId");
  if (!env.TOURAPI_SERVICE_KEY) return jsonError(env, 500, "service key not configured");

  let imageUrl: string | null;
  try {
    imageUrl = await resolveFirstImageUrl(contentId, env);
  } catch {
    return jsonError(env, 502, "upstream unreachable");
  }
  if (!imageUrl) return jsonError(env, 404, "no image");
  if (!isAllowedImageHost(imageUrl)) return jsonError(env, 502, "image host not allowed");

  let imgRes: Response;
  try {
    imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  } catch {
    return jsonError(env, 502, "image unreachable");
  }
  if (!imgRes.ok) return jsonError(env, 502, "image fetch failed");

  return new Response(imgRes.body, {
    status: 200,
    headers: {
      "Content-Type": imgRes.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "no-store",
      ...corsHeaders(env),
    },
  });
}

/**
 * Capacitor 네이티브 셸의 오리진. 웹 자산을 로컬 번들로 로드하므로 Pages 도메인이 아니다
 * (iOS `capacitor://localhost`, Android `https://localhost`).
 * ALLOWED_ORIGIN(쉼표 구분)에 이 값들을 더해 허용하고, 목록에 있으면 요청 오리진을 그대로 반향한다.
 */
const APP_SHELL_ORIGINS = ["capacitor://localhost", "https://localhost"] as const;

function resolveAllowedOrigin(env: Env, request: Request): string {
  const configured = env.ALLOWED_ORIGIN;
  if (configured === undefined || configured === "") return "*";

  const requestOrigin = request.headers.get("Origin");
  if (requestOrigin === null) return configured.split(",")[0]!.trim();

  const allowlist = [
    ...configured.split(",").map((value) => value.trim()).filter((value) => value !== ""),
    ...APP_SHELL_ORIGINS,
  ];
  return allowlist.includes(requestOrigin) ? requestOrigin : configured.split(",")[0]!.trim();
}

/**
 * 내부 핸들러들은 `corsHeaders(env)`로 기본값을 넣는다. 실제 허용 오리진은 요청마다 달라지므로
 * 최종 응답에서 한 번에 덮어쓴다 — 핸들러 시그니처에 request를 흘리지 않기 위한 선택.
 */
function withResolvedCors(response: Response, origin: string): Response {
  const withCors = new Response(response.body, response);
  withCors.headers.set("Access-Control-Allow-Origin", origin);
  withCors.headers.set("Vary", "Origin");
  return withCors;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return withResolvedCors(await handleRequest(request, env), resolveAllowedOrigin(env, request));
  },
};

async function handleRequest(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    if (request.method !== "GET") {
      return jsonError(env, 405, "GET only");
    }

    const url = new URL(request.url);

    // 공유 카드용 이미지 릴레이 — TourAPI 엔드포인트가 아니므로 화이트리스트 검증 전에 분기
    if (url.pathname === "/api/img") {
      return handleImage(url, env);
    }

    const result = validateRequest(url.pathname, url.searchParams);
    if (!result.ok) return jsonError(env, result.status, result.message);

    if (!env.TOURAPI_SERVICE_KEY) {
      return jsonError(env, 500, "service key not configured");
    }

    const upstream = new URL(`${tourApiBaseFor(result.endpoint)}/${result.endpoint}`);
    for (const [key, value] of result.params) upstream.searchParams.set(key, value);
    // 디코딩된 키를 넣으면 URLSearchParams가 인코딩을 수행한다
    upstream.searchParams.set("serviceKey", env.TOURAPI_SERVICE_KEY);
    upstream.searchParams.set("MobileOS", "ETC");
    upstream.searchParams.set("MobileApp", "Spindle");
    upstream.searchParams.set("_type", "json");

    let res: Response;
    try {
      res = await fetch(upstream.toString(), {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch {
      return jsonError(env, 502, "upstream unreachable");
    }

    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/json; charset=utf-8",
        // TourAPI 응답이 브라우저 HTTP 캐시에도 남지 않게 명시 (실시간 호출 규정)
        "Cache-Control": "no-store",
        ...corsHeaders(env),
      },
    });
}
